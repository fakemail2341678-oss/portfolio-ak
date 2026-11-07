import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ImportTaskRow } from "@/features/taskline/schema";
import { isAppError } from "@/lib/errors";
import * as schema from "@/server/db/schema";
import type { TasklineServices } from "@/server/taskline/access";
import * as projects from "@/server/taskline/projects/service";
import { claimSandbox, seedSandbox } from "@/server/taskline/sandbox";
import { prefixQuery } from "@/server/taskline/search/repository";
import * as search from "@/server/taskline/search/service";
import { importTasks } from "@/server/taskline/tasks/import";
import * as tasks from "@/server/taskline/tasks/service";
import * as views from "@/server/taskline/views/service";
import * as workflow from "@/server/taskline/workflow/service";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import { createTestDb } from "../utils/test-db";

/**
 * Finding things on PGlite (Task 51): search sees only what the caller may see (a
 * reference jumps, ranks put title matches first, Devanagari works), saved views
 * (own, shared, replaced by name, who deletes what, the claim), and the CSV import
 * (names matched, numbers in order, once per idempotency key, quotas).
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values([
			{ id: "lead", name: "Lena Lead", email: "lead@example.com" },
			{ id: "member", name: "Mohan Member", email: "member@example.com" },
			{ id: "viewer", name: "Vera Viewer", email: "viewer@example.com" },
			{ id: "outsider", name: "Otto Outsider", email: "outsider@example.com" },
			{ id: "account", name: "Arun Account", email: "account@example.com" },
			{ id: "guest", name: "Guest", email: "guest@anonymous.placeholder.invalid", isAnonymous: true },
		]);
	});
}, 60_000);
afterAll(() => env.close());

const as = (id: string): TasklineServices => ({ db: env.db, user: { id, isGuest: id === "guest", permissions: [] } });
const ws = "team";

const code = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "ok";
	} catch (error) {
		if (isAppError(error)) return error.code;
		throw error;
	}
};

/** The team (lead, member, viewer); WEB (team-visible) and SEC (private, the lead's alone). */
async function setUp() {
	await env.reset();
	const team = await workspaceRepo.ensureTeamWorkspace(env.db);
	await env.db.transaction((tx) =>
		workspaceRepo.insertMembers(tx, [
			{ workspaceId: team.id, userId: "lead", displayName: "Lena Lead" },
			{ workspaceId: team.id, userId: "member", displayName: "Mohan Member" },
			{ workspaceId: team.id, userId: "viewer", displayName: "Vera Viewer", role: "viewer" },
		]),
	);
	await env.db
		.update(schema.tlWorkspace)
		.set({ settings: { projectCreation: "members" } })
		.where(eq(schema.tlWorkspace.id, team.id));
	await projects.createProject(as("lead"), { ws, key: "WEB", name: "Website" });
	await projects.createProject(as("lead"), { ws, key: "SEC", name: "Security", visibility: "private" });
}

const row = (values: Partial<ImportTaskRow> & { title: string }): ImportTaskRow => ({
	description: "",
	type: null,
	status: "",
	assignee: "",
	priority: 0,
	labels: [],
	startOn: null,
	dueOn: null,
	...values,
});

describe("search", () => {
	it("builds prefix queries from words only", () => {
		expect(prefixQuery("Desig home")).toBe("desig:* & home:*");
		expect(prefixQuery("sign-up & !x:*")).toBe("sign:* & up:* & x:*");
		expect(prefixQuery("  ?!  ")).toBeNull();
	});

	it("finds tasks of visible projects only, title matches first, open before closed, never the trash", async () => {
		await setUp();
		const design = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Design the homepage" });
		const described = await tasks.createTask(as("lead"), {
			ws,
			key: "WEB",
			title: "Footer",
			description: "<p>Match the homepage design</p>",
		});
		const closed = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Design review" });
		const { statuses } = await tasks.listTasks(as("lead"), ws, "WEB");
		const done = statuses.find((status) => status.category === "completed");
		await tasks.moveTask(as("lead"), { ws, ref: closed.ref, statusId: done?.id ?? "", position: "a0" });
		const trashed = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Design old" });
		await tasks.trashTask(as("lead"), ws, trashed.ref);
		await tasks.createTask(as("lead"), { ws, key: "SEC", title: "Design the vault" });

		const memberSees = await search.searchTasks(as("member"), { ws, q: "desig", page: 1 });
		expect(memberSees.items.map((task) => task.ref)).toEqual([design.ref, described.ref, closed.ref]);
		expect(memberSees.items[2]?.closed).toBe(true);
		expect(memberSees.items[1]?.excerpt).toContain("homepage design");
		expect(memberSees.total).toBe(3);
		const leadSees = await search.searchTasks(as("lead"), { ws, q: "design", page: 1 });
		expect(leadSees.items.map((task) => task.project.key)).toContain("SEC");
		expect(await code(search.searchTasks(as("outsider"), { ws, q: "design", page: 1 }))).toBe("NOT_FOUND");
		expect(await code(search.searchTasks(as("guest"), { ws, q: "design", page: 1 }))).toBe("NOT_FOUND");
	});

	it("jumps to an exact reference the caller may see, in any case", async () => {
		await setUp();
		const open = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Open one" });
		const hidden = await tasks.createTask(as("lead"), { ws, key: "SEC", title: "Hidden one" });
		expect((await search.searchTasks(as("member"), { ws, q: open.ref.toLowerCase(), page: 1 })).jump).toBe(open.ref);
		expect((await search.searchTasks(as("member"), { ws, q: hidden.ref, page: 1 })).jump).toBeNull();
		expect((await search.searchTasks(as("lead"), { ws, q: hidden.ref, page: 1 })).jump).toBe(hidden.ref);
		expect((await search.searchTasks(as("member"), { ws, q: "WEB-999", page: 1 })).jump).toBeNull();
	});

	it("finds Devanagari words, and the palette looks in every workspace of the caller's", async () => {
		await setUp();
		await tasks.createTask(as("lead"), { ws, key: "WEB", title: "गृहपृष्ठ बनाउने" });
		await env.db.transaction((tx) => seedSandbox(tx, "lead", "ne"));
		const found = await search.findTasks(as("lead"), { q: "गृह" });
		expect(found.map((task) => task.title)).toContain("गृहपृष्ठ बनाउने");
		const both = await search.findTasks(as("lead"), { q: "WEB-1" });
		// The team's WEB-1 and the sandbox's WEB-1: exact references first.
		expect(both.slice(0, 2).map((task) => [task.project.ws, task.ref])).toEqual([
			["team", "WEB-1"],
			["sandbox", "WEB-1"],
		]);
		expect(await search.findTasks(as("outsider"), { q: "गृह" })).toEqual([]);
	});
});

describe("saved views", () => {
	it("keeps each member's own views, shares an editor's, and replaces a view saved under the same name", async () => {
		await setUp();
		const mine = await views.saveView(as("member"), {
			ws,
			key: "WEB",
			view: "list",
			name: "Mine",
			search: "?due=week",
			shared: false,
		});
		await views.saveView(as("lead"), { ws, key: "WEB", view: "list", name: "Team", search: "?sort=due", shared: true });
		const again = await views.saveView(as("member"), {
			ws,
			key: "WEB",
			view: "list",
			name: "MINE",
			search: "?priority=4",
			shared: false,
		});
		expect(again.id).toBe(mine.id);
		const memberViews = await views.listViews(as("member"), { ws, key: "WEB", view: "list" });
		expect(memberViews.views.map((view) => [view.name, view.search, view.shared, view.canDelete])).toEqual([
			["Team", "?sort=due", true, false],
			["MINE", "?priority=4", false, true],
		]);
		expect(memberViews.canShare).toBe(true);
		const viewerViews = await views.listViews(as("viewer"), { ws, key: "WEB", view: "list" });
		expect(viewerViews.views.map((view) => view.name)).toEqual(["Team"]);
		expect(viewerViews.canShare).toBe(false);
		// Views of another kind are apart.
		expect((await views.listViews(as("member"), { ws, key: "WEB", view: "board" })).views).toEqual([]);
	});

	it("lets a viewer save their own but not share, and only the author or the lead delete a shared one", async () => {
		await setUp();
		const input = { ws, key: "WEB", view: "board" as const, search: "" };
		expect(await code(views.saveView(as("viewer"), { ...input, name: "Mine", shared: false }))).toBe("ok");
		expect(await code(views.saveView(as("viewer"), { ...input, name: "Ours", shared: true }))).toBe("FORBIDDEN");
		const shared = await views.saveView(as("member"), { ...input, name: "Shared", shared: true });
		const personal = await views.saveView(as("member"), { ...input, name: "Personal", shared: false });
		expect(await code(views.deleteView(as("viewer"), { ws, key: "WEB", id: shared.id }))).toBe("FORBIDDEN");
		expect(await code(views.deleteView(as("lead"), { ws, key: "WEB", id: personal.id }))).toBe("NOT_FOUND");
		expect(await code(views.deleteView(as("lead"), { ws, key: "WEB", id: shared.id }))).toBe("ok");
		expect(await code(views.deleteView(as("member"), { ws, key: "WEB", id: personal.id }))).toBe("ok");
	});

	it("caps a member's views per project", async () => {
		await setUp();
		const member = await env.db.select().from(schema.tlMember).where(eq(schema.tlMember.userId, "member"));
		const [project] = await env.db.select().from(schema.tlProject).where(eq(schema.tlProject.key, "WEB"));
		await env.db.insert(schema.tlSavedView).values(
			Array.from({ length: 50 }, (_, index) => ({
				workspaceId: project?.workspaceId ?? "",
				projectId: project?.id ?? "",
				memberId: member[0]?.id ?? "",
				name: `View ${index}`,
				view: "list" as const,
				search: "",
			})),
		);
		const input = { ws, key: "WEB", view: "list" as const, search: "", shared: false };
		expect(await code(views.saveView(as("member"), { ...input, name: "One more" }))).toBe("CONFLICT");
		// Replacing one by its name still works.
		expect(await code(views.saveView(as("member"), { ...input, name: "View 3" }))).toBe("ok");
	});

	it("comes with the sandbox, and moves with the claim", async () => {
		await setUp();
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "en"));
		const seeded = await views.listViews(as("guest"), { ws: "sandbox", key: "WEB", view: "list" });
		expect(seeded.views.map((view) => [view.name, view.shared, view.author])).toEqual([
			["Due this week", true, "Asha Gurung"],
		]);
		await views.saveView(as("guest"), {
			ws: "sandbox",
			key: "WEB",
			view: "calendar",
			name: "Weeks",
			search: "?mode=week",
			shared: false,
		});
		await env.db.transaction((tx) => seedSandbox(tx, "account", "en"));
		await env.db.transaction((tx) => claimSandbox(tx, "guest", "account"));
		const moved = await views.listViews(as("account"), { ws: "sandbox", key: "WEB2", view: "calendar" });
		expect(moved.views.map((view) => [view.name, view.mine])).toEqual([["Weeks", true]]);
	});
});

describe("the CSV import", () => {
	it("matches names without case, numbers the tasks in order, and reports what matched nothing", async () => {
		await setUp();
		const first = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Already here" });
		await workflow.createLabel(as("lead"), { ws, key: "WEB", name: "Design" });
		const result = await importTasks(as("member"), {
			ws,
			key: "WEB",
			idempotencyKey: crypto.randomUUID(),
			rows: [
				row({ title: "One", status: "in progress", assignee: "mohan member", labels: ["design", "Nope"], priority: 3 }),
				row({ title: "Two", status: "Somewhere", assignee: "Nobody", type: "bug", dueOn: "2030-01-02" }),
				row({ title: "Three", status: "done", description: "Line <one>\nLine two" }),
			],
		});
		expect(result).toMatchObject({
			inserted: 3,
			replayed: false,
			unmatched: { statuses: ["Somewhere"], assignees: ["Nobody"], labels: ["Nope"] },
		});
		const project = await tasks.listTasks(as("member"), ws, "WEB");
		const byTitle = new Map(project.tasks.map((task) => [task.title, task]));
		const status = (id: string | undefined) => project.statuses.find((each) => each.id === id)?.name;
		expect([...byTitle.values()].map((task) => task.number).sort()).toEqual([first.number, 2, 3, 4]);
		expect(status(byTitle.get("One")?.statusId)).toBe("In progress");
		expect(byTitle.get("One")?.assigneeId).toBe(project.members.find((member) => member.name === "Mohan Member")?.id);
		expect(byTitle.get("One")?.labelIds).toHaveLength(1);
		expect(byTitle.get("One")?.priority).toBe(3);
		expect(status(byTitle.get("Two")?.statusId)).toBe("To do");
		expect(byTitle.get("Two")).toMatchObject({ assigneeId: null, type: "bug", dueOn: "2030-01-02" });
		expect(byTitle.get("Three")?.completedAt).not.toBeNull();
		const three = await tasks.getTask(as("member"), ws, byTitle.get("Three")?.ref ?? "");
		expect(three.description).toBe("<p>Line &lt;one&gt;</p><p>Line two</p>");
		expect(three.watcherIds).toHaveLength(1);
		expect(three.activity.map((entry) => entry.kind)).toEqual(["task.created"]);
		expect(project.project.rev).toBeGreaterThan(first.number);
	});

	it("runs once per idempotency key: a retry gets the first result, other rows or someone else are refused", async () => {
		await setUp();
		const key = crypto.randomUUID();
		const input = { ws, key: "WEB", idempotencyKey: key, rows: [row({ title: "Once" })] };
		expect((await importTasks(as("member"), input)).replayed).toBe(false);
		expect(await importTasks(as("member"), input)).toMatchObject({ inserted: 1, replayed: true });
		expect((await tasks.listTasks(as("member"), ws, "WEB")).tasks).toHaveLength(1);
		expect(await code(importTasks(as("member"), { ...input, rows: [row({ title: "Other" })] }))).toBe("CONFLICT");
		expect(await code(importTasks(as("lead"), input))).toBe("CONFLICT");
		// Two at once: one imports, the other waits and replays.
		const both = await Promise.all([
			importTasks(as("member"), { ...input, idempotencyKey: crypto.randomUUID() }),
			importTasks(as("member"), { ...input, idempotencyKey: key }),
		]);
		expect(both.map((each) => each.inserted)).toEqual([1, 1]);
		expect((await tasks.listTasks(as("member"), ws, "WEB")).tasks).toHaveLength(2);
	});

	it("is refused to readers and past the quota", async () => {
		await setUp();
		const input = { ws, key: "WEB", idempotencyKey: crypto.randomUUID(), rows: [row({ title: "No" })] };
		expect(await code(importTasks(as("viewer"), input))).toBe("FORBIDDEN");
		expect(await code(importTasks(as("outsider"), input))).toBe("NOT_FOUND");
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "en"));
		const many = Array.from({ length: 995 }, (_, index) => row({ title: `Task ${index}` }));
		expect(
			await code(
				importTasks(as("guest"), { ws: "sandbox", key: "WEB", idempotencyKey: crypto.randomUUID(), rows: many }),
			),
		).toBe("CONFLICT");
	});
});
