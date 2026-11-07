import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Kanban's data moved into Taskline (decision 0210): the database as it was before
 * `0017_kanban_to_taskline` (every migration up to it), fixture Kanban rows for two
 * owners (an account, and a guest who already started a sandbox holding a KB1), then
 * the migration itself and the drop that follows it.
 */
const MIGRATIONS = "./drizzle";
const MIGRATION = "0017_kanban_to_taskline";
const DROP = "0018_drop_kanban";

let client: PGlite;
let folder: string;

const statements = (tag: string) =>
	readFileSync(join(MIGRATIONS, `${tag}.sql`), "utf8")
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter(Boolean);

const rows = async <T>(sql: string, params: unknown[] = []) => (await client.query<T>(sql, params)).rows;

const BOARD = "11111111-1111-4111-8111-111111111111";
const EMPTY_BOARD = "22222222-2222-4222-8222-222222222222";
const GUEST_BOARD = "33333333-3333-4333-8333-333333333333";
const col = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const card = (n: number) => `cccccccc-0000-4000-8000-00000000000${n}`;

beforeAll(async () => {
	// The migrations up to (not including) the one under test.
	folder = mkdtempSync(join(tmpdir(), "kanban-migration-"));
	cpSync(MIGRATIONS, folder, { recursive: true });
	const journalPath = join(folder, "meta", "_journal.json");
	const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: Array<{ tag: string }> };
	journal.entries = journal.entries.slice(
		0,
		journal.entries.findIndex((entry) => entry.tag === MIGRATION),
	);
	writeFileSync(journalPath, JSON.stringify(journal));
	client = new PGlite();
	await migrate(drizzle({ client }), { migrationsFolder: folder });

	await client.exec(`
		insert into "user" (id, name, email, email_verified, created_at, updated_at, is_anonymous) values
			('owner', 'Owner Person', 'owner@example.com', true, now(), now(), false),
			('guest', 'Guest', 'g@anonymous.placeholder.invalid', false, now(), now(), true);

		-- The guest already has a sandbox with a KB1 project (and its member row).
		insert into tl_workspace (id, kind, slug, name, owner_id) values
			('44444444-4444-4444-8444-444444444444', 'sandbox', 'sandbox', 'Sandbox', 'guest');
		insert into tl_member (id, workspace_id, user_id, display_name) values
			('55555555-5555-4555-8555-555555555555', '44444444-4444-4444-8444-444444444444', 'guest', 'Guest');
		insert into tl_project (workspace_id, key, name) values ('44444444-4444-4444-8444-444444444444', 'KB1', 'Taken');

		insert into kanban_board (id, owner_id, name, created_at) values
			('${BOARD}', 'owner', 'Getting started', '2026-01-01T00:00:00Z'),
			('${EMPTY_BOARD}', 'owner', 'Empty', '2026-02-01T00:00:00Z'),
			('${GUEST_BOARD}', 'guest', 'Guest board', '2026-03-01T00:00:00Z');
		insert into kanban_column (id, owner_id, board_id, name, position) values
			('${col(1)}', 'owner', '${BOARD}', 'Doing', 'a1'),
			('${col(2)}', 'owner', '${BOARD}', 'To do', 'a0'),
			('${col(3)}', 'owner', '${BOARD}', 'Done', 'a2'),
			('${col(4)}', 'guest', '${GUEST_BOARD}', 'Only', 'a0');
		insert into kanban_card (id, owner_id, board_id, column_id, title, description, labels, due_on, checklist, position, created_at, updated_at) values
			('${card(1)}', 'owner', '${BOARD}', '${col(2)}', 'Second made', 'Use <b>bold</b> & more\nnext line\n\nNew paragraph', '{red,blue}', '2026-11-05', '[{"id":"c1","text":"Step","done":true}]', 'a0', '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z'),
			('${card(2)}', 'owner', '${BOARD}', '${col(3)}', 'First made', '', '{blue}', null, '[]', 'a0', '2026-01-02T00:00:00Z', '2026-01-09T00:00:00Z'),
			('${card(3)}', 'owner', '${BOARD}', '${col(1)}', 'Third made', '', '{}', null, '[]', 'a0', '2026-01-04T00:00:00Z', '2026-01-04T00:00:00Z'),
			('${card(4)}', 'guest', '${GUEST_BOARD}', '${col(4)}', 'Guest card', '', '{violet}', null, '[]', 'a0', '2026-03-02T00:00:00Z', '2026-03-02T00:00:00Z');

		insert into portfolio_project (slug, title, client, year, role, duration, summary, glyph, app_slug) values
			('kanban-case', 'Kanban', '{"en":"Me","ne":"म"}', 2026, '{"en":"All","ne":"सबै"}', '{"en":"A week","ne":"एक हप्ता"}', '{"en":"A board","ne":"बोर्ड"}', 'K', 'kanban');
	`);

	for (const statement of statements(MIGRATION)) await client.exec(statement);
}, 120_000);

afterAll(async () => {
	await client?.close();
	if (folder) rmSync(folder, { recursive: true, force: true });
});

type Project = { id: string; key: string; name: string; lead_id: string; task_seq: number; workspace_id: string };

const sandboxOf = async (owner: string) =>
	(await rows<{ id: string }>(`select id from tl_workspace where kind = 'sandbox' and owner_id = $1`, [owner]))[0]?.id;

describe("the Kanban migration", () => {
	it("gives each owner a sandbox and a member row, and keeps an existing sandbox", async () => {
		const owner = await sandboxOf("owner");
		expect(owner).toBeDefined();
		const members = await rows<{ display_name: string }>(
			`select display_name from tl_member where workspace_id = $1 and user_id = 'owner'`,
			[owner],
		);
		expect(members).toEqual([{ display_name: "Owner Person" }]);
		expect(await sandboxOf("guest")).toBe("44444444-4444-4444-8444-444444444444");
		expect(await rows(`select id from tl_member where user_id = 'guest'`)).toHaveLength(1);
	});

	it("turns each board into a project with the same id, keyed KB1, KB2… in creation order", async () => {
		const projects = await rows<Project>(`select * from tl_project where workspace_id = $1 order by key`, [
			await sandboxOf("owner"),
		]);
		expect(projects.map((project) => [project.id, project.key, project.name, project.task_seq])).toEqual([
			[BOARD, "KB1", "Getting started", 3],
			[EMPTY_BOARD, "KB2", "Empty", 0],
		]);
		const [member] = await rows<{ id: string }>(`select id from tl_member where user_id = 'owner'`);
		expect(projects.every((project) => project.lead_id === member?.id)).toBe(true);
		expect(
			await rows(`select role from tl_project_member where project_id = $1 and member_id = $2`, [BOARD, member?.id]),
		).toEqual([{ role: "lead" }]);
		// The guest's KB1 was taken: their board is KB2.
		expect(await rows(`select key from tl_project where id = $1`, [GUEST_BOARD])).toEqual([{ key: "KB2" }]);
	});

	it("turns columns into statuses with the same ids and order: first not started, last completed, the rest started", async () => {
		const statuses = await rows<{ id: string; name: string; category: string; position: string }>(
			`select id, name, category, position from tl_status where project_id = $1 order by position collate "C"`,
			[BOARD],
		);
		expect(statuses).toEqual([
			{ id: col(2), name: "To do", category: "unstarted", position: "a0" },
			{ id: col(1), name: "Doing", category: "started", position: "a1" },
			{ id: col(3), name: "Done", category: "completed", position: "a2" },
		]);
		// A one-column board: that column is where work starts. A board without any gets one status.
		expect(await rows(`select category from tl_status where project_id = $1`, [GUEST_BOARD])).toEqual([
			{ category: "unstarted" },
		]);
		expect(await rows(`select name, category from tl_status where project_id = $1`, [EMPTY_BOARD])).toEqual([
			{ name: "To do", category: "unstarted" },
		]);
	});

	it("turns cards into tasks with the same ids, numbered by creation, keeping what they held", async () => {
		const tasks = await rows<{
			id: string;
			number: number;
			title: string;
			description_html: string;
			description_text: string;
			status_id: string;
			due_on: string | null;
			checklist: unknown;
			completed_at: Date | null;
		}>(`select *, due_on::text as due_on from tl_task where project_id = $1 order by number`, [BOARD]);
		expect(tasks.map((task) => [task.number, task.id, task.title])).toEqual([
			[1, card(2), "First made"],
			[2, card(1), "Second made"],
			[3, card(3), "Third made"],
		]);
		const second = tasks[1];
		expect(second?.description_html).toBe(
			"<p>Use &lt;b&gt;bold&lt;/b&gt; &amp; more<br>next line</p><p>New paragraph</p>",
		);
		expect(second?.description_text).toBe("Use <b>bold</b> & more\nnext line\n\nNew paragraph");
		expect(second?.due_on).toBe("2026-11-05");
		expect(second?.checklist).toEqual([{ id: "c1", text: "Step", done: true }]);
		// Only the task in the completed status is closed (when the card last changed).
		expect(tasks.map((task) => task.completed_at?.toISOString() ?? null)).toEqual([
			"2026-01-09T00:00:00.000Z",
			null,
			null,
		]);
		expect(tasks[0]?.description_html).toBe("");
	});

	it("turns colour labels into project labels named after their colour", async () => {
		const labels = await rows<{ name: string; color: string }>(
			`select name, color from tl_label where project_id = $1 order by name`,
			[BOARD],
		);
		expect(labels).toEqual([
			{ name: "Blue", color: "blue" },
			{ name: "Red", color: "red" },
		]);
		const onSecond = await rows<{ name: string }>(
			`select l.name from tl_task_label tl join tl_label l on l.id = tl.label_id where tl.task_id = $1 order by l.name`,
			[card(1)],
		);
		expect(onSecond.map((label) => label.name)).toEqual(["Blue", "Red"]);
		expect(await rows(`select name from tl_label where project_id = $1`, [GUEST_BOARD])).toEqual([{ name: "Violet" }]);
	});

	it("makes the owner a watcher and leaves a history", async () => {
		const [member] = await rows<{ id: string }>(`select id from tl_member where user_id = 'owner'`);
		expect(await rows(`select task_id from tl_task_watcher where member_id = $1`, [member?.id])).toHaveLength(3);
		const kinds = await rows<{ kind: string }>(`select kind from tl_activity where project_id = $1 order by kind`, [
			BOARD,
		]);
		expect(kinds.map((row) => row.kind)).toEqual(["project.created", "task.created", "task.created", "task.created"]);
	});

	it("points a portfolio project's app at Taskline", async () => {
		expect(await rows(`select app_slug from portfolio_project`)).toEqual([{ app_slug: "taskline" }]);
	});

	it("is followed by dropping the Kanban tables", async () => {
		for (const statement of statements(DROP)) await client.exec(statement);
		const left = await rows(`select tablename from pg_tables where tablename like 'kanban_%'`);
		expect(left).toEqual([]);
		// The projects stay.
		expect(await rows(`select key from tl_project where id = $1`, [BOARD])).toEqual([{ key: "KB1" }]);
	});
});
