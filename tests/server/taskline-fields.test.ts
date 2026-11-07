import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/features/rbac/types";
import type { FieldDefinition } from "@/features/taskline/fields";
import { taskList } from "@/features/taskline/search";
import { FIELDS_MAX, type TaskField } from "@/features/taskline/types";
import { FORM_ERROR_KEY, isAppError } from "@/lib/errors";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import * as schema from "@/server/db/schema";
import type { TasklineServices } from "@/server/taskline/access";
import * as adminFields from "@/server/taskline/admin/fields";
import * as adminProjects from "@/server/taskline/admin/projects";
import * as fields from "@/server/taskline/fields/service";
import * as projects from "@/server/taskline/projects/service";
import { claimSandbox, seedSandbox } from "@/server/taskline/sandbox";
import { importTasks } from "@/server/taskline/tasks/import";
import * as tasks from "@/server/taskline/tasks/service";
import * as workflow from "@/server/taskline/workflow/repository";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import { createTestDb } from "../utils/test-db";

/**
 * Custom fields on PGlite (Task 55, decision 0220): definitions per scope (the
 * workspace's, the admin's; a project's, its lead's), values checked against them on
 * every write, option renames keeping values and removals clearing them, archiving and
 * deleting, the completion rule for required fields, the list's filters, the import,
 * the export, and the sandbox's seed and claim.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values([
			{ id: "lead", name: "Lena Lead", email: "lead@example.com" },
			{ id: "member", name: "Mohan Member", email: "member@example.com" },
			{ id: "viewer", name: "Vera Viewer", email: "viewer@example.com" },
			{ id: "account", name: "Arun Account", email: "account@example.com" },
			{ id: "guest", name: "Guest", email: "guest@anonymous.placeholder.invalid", isAnonymous: true },
		]);
	});
}, 60_000);
afterAll(() => env.close());

const as = (id: string): TasklineServices => ({ db: env.db, user: { id, isGuest: id === "guest", permissions: [] } });
const ALL = ["taskline:read", "taskline:manage", "taskline:configure", "taskline:time"] as const;
const admin = () => ({
	db: env.db,
	actor: { id: "admin-1", isAdmin: true, permissions: [...ALL] } as Actor,
	imageStore: null,
});
const ws = "team";
const key = "WEB";

const failure = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return { code: "ok", message: "", fields: undefined };
	} catch (error) {
		if (isAppError(error)) {
			return { code: error.code, message: error.fieldErrors?.[FORM_ERROR_KEY]?.[0] ?? "", fields: error.fieldErrors };
		}
		throw error;
	}
};
const code = async (promise: Promise<unknown>) => (await failure(promise)).code;

const severity: FieldDefinition = {
	type: "select",
	name: "Severity",
	required: false,
	options: [
		{ id: "olow001", name: "Low", color: "gray" },
		{ id: "ohigh01", name: "High", color: "red" },
	],
};

/** The team (lead, member, viewer) and WEB (the member on it). */
async function setUp() {
	await env.reset();
	const team = await workspaceRepo.ensureTeamWorkspace(env.db);
	const rows = await env.db.transaction((tx) =>
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
	await projects.createProject(as("lead"), { ws, key, name: "Website" });
	const byUser = (id: string) => {
		const row = rows.find((each) => each.userId === id);
		if (!row) throw new Error(`no ${id}`);
		return row;
	};
	await projects.setProjectMember(as("lead"), { ws, key, memberId: byUser("member").id, role: "member" });
	return { team, lead: byUser("lead"), member: byUser("member"), viewer: byUser("viewer") };
}

const field = (all: ReadonlyArray<TaskField>, name: string) => {
	const found = all.find((each) => each.name === name);
	if (!found) throw new Error(`no field ${name}`);
	return found;
};

describe("definitions", () => {
	it("keeps a project's fields its lead's and the workspace's the admin's, each scope ordered and capped", async () => {
		await setUp();
		const own = await fields.createField(as("lead"), { ws, key, field: severity });
		expect(own).toMatchObject({ name: "Severity", type: "select", projectId: expect.any(String), archived: false });
		// Only whoever runs the project.
		expect(await code(fields.createField(as("member"), { ws, key, field: { ...severity, name: "Other" } }))).toBe(
			"FORBIDDEN",
		);
		// A name once per scope, in any case; the workspace may have one of the same name.
		const taken = await failure(fields.createField(as("lead"), { ws, key, field: { ...severity, name: "severity" } }));
		expect(taken.code).toBe("CONFLICT");
		expect(taken.fields?.name?.[0]).toBeTruthy();
		await adminFields.createField(admin(), { field: { ...severity, name: "Severity" } });
		await adminFields.createField(admin(), { field: { type: "checkbox", name: "Reviewed", required: false } });
		const board = await tasks.listTasks(as("member"), ws, key);
		expect(board.fields.map((each) => [each.name, each.projectId === null])).toEqual([
			["Severity", true],
			["Reviewed", true],
			["Severity", false],
		]);
		// Only select fields have options; a type never changes (it isn't an input).
		const checkbox = field((await adminFields.listFields(admin())).fields, "Reviewed");
		expect(await code(adminFields.updateField(admin(), { id: checkbox.id, options: severity.options as never }))).toBe(
			"BAD_REQUEST",
		);
		// The cap, per scope.
		for (let index = 1; index < FIELDS_MAX; index++) {
			await fields.createField(as("lead"), {
				ws,
				key,
				field: { type: "text", name: `Note ${index}`, required: false },
			});
		}
		expect(
			await code(
				fields.createField(as("lead"), { ws, key, field: { type: "text", name: "One more", required: false } }),
			),
		).toBe("CONFLICT");
		// The admin's changes are audited.
		const audits = await env.db.select().from(schema.auditEvent);
		expect(audits.map((row) => row.action)).toEqual(expect.arrayContaining(["taskline.field.create"]));
	});
});

describe("values", () => {
	it("checks values against the fields, keeps them through renames, clears removed options, and records each change", async () => {
		const { member } = await setUp();
		const area = await fields.createField(as("lead"), { ws, key, field: severity });
		const tags = await fields.createField(as("lead"), {
			ws,
			key,
			field: {
				type: "multi_select",
				name: "Platforms",
				required: false,
				options: [
					{ id: "oweb001", name: "Web", color: "blue" },
					{ id: "oios001", name: "iOS", color: "gray" },
				],
			},
		});
		const reviewer = await fields.createField(as("lead"), {
			ws,
			key,
			field: { type: "member", name: "Reviewer", required: false },
		});
		const budget = await fields.createField(as("lead"), {
			ws,
			key,
			field: { type: "number", name: "Budget", required: false },
		});
		const task = await tasks.createTask(as("member"), {
			ws,
			key,
			title: "Ship it",
			fields: { [area.id]: "ohigh01", [budget.id]: 1500 },
		});
		expect(task.fields).toEqual({ [area.id]: "ohigh01", [budget.id]: 1500 });

		// Wrong values are refused: an option the field hasn't, a type that isn't its own, an unknown field, a stranger.
		expect(await code(tasks.patchTask(as("member"), { ws, ref: task.ref, fields: { [area.id]: "onope01" } }))).toBe(
			"BAD_REQUEST",
		);
		expect(await code(tasks.patchTask(as("member"), { ws, ref: task.ref, fields: { [budget.id]: "lots" } }))).toBe(
			"BAD_REQUEST",
		);
		expect(
			await code(
				tasks.patchTask(as("member"), { ws, ref: task.ref, fields: { "00000000-0000-4000-8000-000000000000": "x" } }),
			),
		).toBe("NOT_FOUND");
		expect(
			await code(
				tasks.patchTask(as("member"), {
					ws,
					ref: task.ref,
					fields: { [reviewer.id]: "00000000-0000-4000-8000-000000000000" },
				}),
			),
		).toBe("NOT_FOUND");
		// A viewer can't change them.
		expect(await code(tasks.patchTask(as("viewer"), { ws, ref: task.ref, fields: { [area.id]: "olow001" } }))).toBe(
			"FORBIDDEN",
		);

		// Setting some keeps the others; null clears one.
		let after = await tasks.patchTask(as("member"), {
			ws,
			ref: task.ref,
			fields: { [tags.id]: ["oweb001", "oios001"], [reviewer.id]: member.id, [budget.id]: null },
		});
		expect(after.fields).toEqual({ [area.id]: "ohigh01", [tags.id]: ["oweb001", "oios001"], [reviewer.id]: member.id });
		const history = after.activity.filter((entry) => entry.data.field === "custom");
		expect(history.map((entry) => [entry.data.name, entry.data.to])).toEqual(
			expect.arrayContaining([
				["Platforms", ["oweb001", "oios001"]],
				["Reviewer", member.id],
				["Budget", null],
			]),
		);

		// Renaming an option keeps the values (they're its id); removing one takes it off every task.
		await fields.updateField(as("lead"), {
			ws,
			key,
			id: tags.id,
			options: [
				{ id: "oweb001", name: "Browser", color: "blue" },
				{ id: "oand001", name: "Android", color: "green" },
			],
		});
		await fields.updateField(as("lead"), {
			ws,
			key,
			id: area.id,
			options: [{ id: "olow001", name: "Low", color: "gray" }],
		});
		after = await tasks.getTask(as("member"), ws, task.ref);
		expect(after.fields).toEqual({ [tags.id]: ["oweb001"], [reviewer.id]: member.id });

		// Archiving keeps the values but refuses new ones; restoring brings it back; deleting removes them.
		await fields.updateField(as("lead"), { ws, key, id: tags.id, archived: true });
		expect(await code(tasks.patchTask(as("member"), { ws, ref: task.ref, fields: { [tags.id]: ["oweb001"] } }))).toBe(
			"NOT_FOUND",
		);
		expect((await tasks.getTask(as("member"), ws, task.ref)).fields[tags.id]).toEqual(["oweb001"]);
		await fields.updateField(as("lead"), { ws, key, id: tags.id, archived: false });
		await fields.deleteField(as("lead"), { ws, key, id: reviewer.id });
		expect((await tasks.getTask(as("member"), ws, task.ref)).fields).toEqual({ [tags.id]: ["oweb001"] });
	});

	it("refuses completing a task while a required field is empty (canceling is fine)", async () => {
		await setUp();
		const signed = await fields.createField(as("lead"), {
			ws,
			key,
			field: { type: "checkbox", name: "Signed off", required: true },
		});
		const task = await tasks.createTask(as("member"), { ws, key, title: "Launch" });
		const statuses = await tasks.listTasks(as("member"), ws, key).then((board) => board.statuses);
		const done = statuses.find((status) => status.category === "completed");
		const canceled = statuses.find((status) => status.category === "canceled");
		if (!done || !canceled) throw new Error("no closed statuses");
		const refused = await failure(
			tasks.moveTask(as("member"), { ws, ref: task.ref, statusId: done.id, position: "a5" }),
		);
		expect(refused.code).toBe("CONFLICT");
		expect(refused.message).toContain("Signed off");
		const bulk = await failure(tasks.bulkUpdate(as("member"), { ws, key, ids: [task.id], statusId: done.id }));
		expect(bulk.code).toBe("CONFLICT");
		expect(await code(tasks.moveTask(as("member"), { ws, ref: task.ref, statusId: canceled.id, position: "a5" }))).toBe(
			"ok",
		);
		const other = await tasks.createTask(as("member"), { ws, key, title: "Signed", fields: { [signed.id]: true } });
		expect(await code(tasks.moveTask(as("member"), { ws, ref: other.ref, statusId: done.id, position: "a6" }))).toBe(
			"ok",
		);
		// An archived required field no longer stops anyone.
		await fields.updateField(as("lead"), { ws, key, id: signed.id, archived: true });
		const third = await tasks.createTask(as("member"), { ws, key, title: "Third" });
		expect(await code(tasks.moveTask(as("member"), { ws, ref: third.ref, statusId: done.id, position: "a7" }))).toBe(
			"ok",
		);
	});
});

describe("filters, the import and the export", () => {
	it("filters the list by field, imports typed values and exports them as words", async () => {
		const { lead, member } = await setUp();
		const area = await fields.createField(as("lead"), { ws, key, field: severity });
		const reviewer = await fields.createField(as("lead"), {
			ws,
			key,
			field: { type: "member", name: "Reviewer", required: false },
		});
		const due = await fields.createField(as("lead"), {
			ws,
			key,
			field: { type: "date", name: "Review by", required: false },
		});
		const today = todayInZone(APP_TIME_ZONE);
		const high = await tasks.createTask(as("member"), {
			ws,
			key,
			title: "High",
			fields: { [area.id]: "ohigh01", [reviewer.id]: member.id, [due.id]: addDays(today, -2) },
		});
		const low = await tasks.createTask(as("member"), {
			ws,
			key,
			title: "Low",
			fields: { [area.id]: "olow001", [reviewer.id]: lead.id, [due.id]: addDays(today, 3) },
		});
		const none = await tasks.createTask(as("member"), { ws, key, title: "None" });
		const refs = async (user: string, cf: string[]) =>
			(await tasks.listTaskPage(as(user), { ...taskList.defaults, pageSize: 20, ws, key, cf })).items
				.map((task) => task.title)
				.sort();
		expect(await refs("member", [`${area.id}:ohigh01`])).toEqual(["High"]);
		expect(await refs("member", [`${area.id}:none`])).toEqual(["None"]);
		expect(await refs("member", [`${area.id}:any`])).toEqual(["High", "Low"]);
		expect(await refs("member", [`${reviewer.id}:me`])).toEqual(["High"]);
		expect(await refs("lead", [`${reviewer.id}:me`])).toEqual(["Low"]);
		expect(await refs("member", [`${due.id}:past`])).toEqual(["High"]);
		expect(await refs("member", [`${due.id}:future`])).toEqual(["Low"]);
		expect(await refs("member", [`${area.id}:any`, `${due.id}:future`])).toEqual(["Low"]);
		expect([high.ref, low.ref, none.ref]).toHaveLength(3);

		// The import takes typed values, checked like any write.
		const result = await importTasks(as("member"), {
			ws,
			key,
			idempotencyKey: crypto.randomUUID(),
			rows: [
				{
					title: "Imported",
					description: "",
					type: null,
					status: "",
					assignee: "",
					priority: 0,
					labels: [],
					startOn: null,
					dueOn: null,
					fields: { [area.id]: "ohigh01" },
				},
			],
		});
		expect(result.inserted).toBe(1);
		expect(await refs("member", [`${area.id}:ohigh01`])).toEqual(["High", "Imported"]);

		// The admin's export names the values.
		const project = (await tasks.listTasks(as("lead"), ws, key)).project;
		const csv = await adminProjects.exportProject(admin(), { id: project.id, format: "csv" });
		expect(csv.content.split("\n")[0]).toContain("Severity");
		expect(csv.content).toContain("High");
		const json = JSON.parse((await adminProjects.exportProject(admin(), { id: project.id, format: "json" })).content);
		expect(json.fields.map((each: { name: string }) => each.name)).toEqual(["Severity", "Reviewer", "Review by"]);
		expect(json.tasks.find((each: { title: string }) => each.title === "High").fields).toMatchObject({
			Severity: "High",
			Reviewer: "Mohan Member",
		});
	});
});

describe("the sandbox", () => {
	it("seeds fields in the guest's language, and the claim keeps them with the guest's person values", async () => {
		await env.reset();
		await workspaceRepo.ensureTeamWorkspace(env.db);
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "ne"));
		const board = await tasks.listTasks(as("guest"), "sandbox", key);
		expect(board.fields.map((each) => each.name)).toEqual(["क्षेत्र", "समीक्षक", "स्वीकृत"]);
		const reviewer = field(board.fields, "समीक्षक");
		expect(board.tasks.filter((task) => Object.keys(task.fields).length > 0).length).toBeGreaterThan(5);

		// The guest reviews a task, then signs up into an account that has a sandbox of its own.
		const guestMember = board.members.find((each) => each.userId === "guest");
		const first = board.tasks[0];
		if (!guestMember || !first) throw new Error("no guest member");
		await tasks.patchTask(as("guest"), { ws: "sandbox", ref: first.ref, fields: { [reviewer.id]: guestMember.id } });
		await env.db.transaction((tx) => seedSandbox(tx, "account", "en"));
		await env.db.transaction((tx) => claimSandbox(tx, "guest", "account"));
		const claimed = await tasks.listTasks(as("account"), "sandbox", "WEB2");
		expect(claimed.fields.map((each) => each.id)).toEqual(board.fields.map((each) => each.id));
		const account = claimed.members.find((each) => each.userId === "account");
		expect(claimed.tasks.find((task) => task.id === first.id)?.fields[reviewer.id]).toBe(account?.id);
		// The account's own WEB keeps its English fields.
		expect((await tasks.listTasks(as("account"), "sandbox", key)).fields.map((each) => each.name)).toEqual([
			"Area",
			"Reviewer",
			"Signed off",
		]);
		expect(await workflow.listStatuses(env.db, claimed.project.id)).not.toHaveLength(0);
	});
});
