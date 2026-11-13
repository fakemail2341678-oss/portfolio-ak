import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { listBudgets } from "@/server/kharcha/budgets/service";
import { getExpense } from "@/server/kharcha/expenses/service";
import { colorFor } from "@/server/kharcha/people";
import { listSpend } from "@/server/kharcha/spend/service";
import { caller } from "./kharcha-helpers";

/**
 * The Expenses app's rows moved into Kharcha (Task 95, decision 0289): the database as it was
 * before `0056_expenses_to_kharcha` (every migration up to it), fixture Expenses rows for
 * three owners, then the migration itself and the drop that follows it:
 * - an account with a verified address somebody already added as a contact (its person is taken over);
 * - an account with an unverified address (a new person, no address);
 * - a guest already in Kharcha, with a "food" category and a monthly budget on it.
 */
const MIGRATIONS = "./drizzle";
const MIGRATION = "0056_expenses_to_kharcha";
const DROP = "0057_drop_expenses";

let client: PGlite;
let folder: string;

const statements = (tag: string) =>
	readFileSync(join(MIGRATIONS, `${tag}.sql`), "utf8")
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter(Boolean);

const rows = async <T>(sql: string, params: unknown[] = []) => (await client.query<T>(sql, params)).rows;

const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-00000000000${n}`;
const WAITING = id("aaaaaaaa", 1);
const GUEST_PERSON = id("aaaaaaaa", 2);
const GUEST_FOOD = id("aaaaaaaa", 3);
const GUEST_BUDGET = id("aaaaaaaa", 4);
const FOOD = id("cccccccc", 1);
const MISC = id("cccccccc", 2);
const GUEST_EXPENSES_FOOD = id("cccccccc", 3);
const MOMO = id("eeeeeeee", 1);
const DOLLARS = id("eeeeeeee", 2);
const TEA = id("eeeeeeee", 3);
const GUEST_MEAL = id("eeeeeeee", 4);
const budget = (n: number) => id("bbbbbbbb", n);
const KEY = id("dddddddd", 1);
const UNFINISHED_KEY = id("dddddddd", 2);

beforeAll(async () => {
	// The migrations up to (not including) the one under test.
	folder = mkdtempSync(join(tmpdir(), "expenses-migration-"));
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
			('owner', 'Owner Person', 'Owner@Example.com', true, now(), now(), false),
			('plain', 'Plain', 'plain@example.com', false, now(), now(), false),
			('guest', 'Guest', 'g@anonymous.placeholder.invalid', false, now(), now(), true);

		-- Somebody added the owner's address as a contact; the guest already uses Kharcha.
		insert into kh_person (id, email, display_name, color) values ('${WAITING}', 'owner@example.com', 'Owny', 'red');
		insert into kh_person (id, user_id, display_name, color) values ('${GUEST_PERSON}', 'guest', 'Guest', 'teal');
		insert into kh_profile (user_id, person_id) values ('guest', '${GUEST_PERSON}');
		insert into kh_category (id, owner_id, name, color, icon, position) values
			('${GUEST_FOOD}', '${GUEST_PERSON}', 'food', 'amber', 'utensils', 0);
		insert into kh_budget (id, owner_id, category_id, currency, period, amount_minor, starts_on) values
			('${GUEST_BUDGET}', '${GUEST_PERSON}', '${GUEST_FOOD}', 'NPR', 'month', 700000, '2026-01-01');

		insert into expense_category (id, owner_id, name, color, icon, created_at) values
			('${FOOD}', 'owner', 'Food', 'orange', 'utensils', '2026-01-01T00:00:00Z'),
			('${MISC}', 'owner', 'Misc', 'slate', 'tag', '2026-01-02T00:00:00Z'),
			('${GUEST_EXPENSES_FOOD}', 'guest', 'Food', 'green', 'coffee', '2026-01-03T00:00:00Z');
		insert into expense_transaction (id, owner_id, category_id, amount_minor, currency, occurred_on, note, import_key, created_at, updated_at) values
			('${MOMO}', 'owner', '${FOOD}', 125000, 'NPR', '2026-03-05', 'Momo', '${KEY}', '2026-03-05T10:00:00Z', '2026-03-06T10:00:00Z'),
			('${DOLLARS}', 'owner', null, 5000, 'USD', '2026-03-06', '', null, '2026-03-06T10:00:00Z', '2026-03-06T10:00:00Z'),
			('${TEA}', 'plain', null, 2000, 'NPR', '2026-03-07', 'Tea', null, '2026-03-07T10:00:00Z', '2026-03-07T10:00:00Z'),
			('${GUEST_MEAL}', 'guest', '${GUEST_EXPENSES_FOOD}', 3000, 'NPR', '2026-03-08', 'Meal', null, '2026-03-08T10:00:00Z', '2026-03-08T10:00:00Z');
		insert into expense_budget (id, owner_id, category_id, month, currency, amount_minor) values
			('${budget(1)}', 'owner', '${FOOD}', '2026-01-01', 'NPR', 500000),
			('${budget(2)}', 'owner', '${FOOD}', '2026-02-01', 'NPR', 600000),
			('${budget(3)}', 'owner', '${FOOD}', '2026-03-01', 'NPR', 600000),
			('${budget(4)}', 'owner', '${FOOD}', '2026-02-01', 'USD', 10000),
			('${budget(5)}', 'guest', '${GUEST_EXPENSES_FOOD}', '2026-02-01', 'NPR', 900000);
		insert into expense_import (key, owner_id, fingerprint, result) values
			('${KEY}', 'owner', 'abc', '{"inserted":1,"categoriesCreated":1}'),
			('${UNFINISHED_KEY}', 'owner', 'def', null);

		insert into portfolio_project (slug, title, client, year, role, duration, summary, glyph, app_slug) values
			('expenses-case', 'Expenses', '{"en":"Me","ne":"म"}', 2026, '{"en":"All","ne":"सबै"}', '{"en":"A week","ne":"एक हप्ता"}', '{"en":"A tracker","ne":"ट्र्याकर"}', 'E', 'expenses');
	`);

	for (const statement of statements(MIGRATION)) await client.exec(statement);
}, 120_000);

afterAll(async () => {
	await client?.close();
	if (folder) rmSync(folder, { recursive: true, force: true });
});

const personOf = async (userId: string) =>
	(
		await rows<{ id: string; email: string | null; display_name: string; color: string }>(
			`select id, email, display_name, color from kh_person where user_id = $1`,
			[userId],
		)
	)[0];

describe("the Expenses migration", () => {
	it("gives each owner a person and a profile as ensurePerson would, taking over a contact of their verified address", async () => {
		expect(await personOf("owner")).toEqual({
			id: WAITING,
			email: "owner@example.com",
			display_name: "Owner Person",
			color: "red",
		});
		// An unverified address is never claimed: a person of their own, coloured by colorFor.
		const plain = await personOf("plain");
		expect(plain).toMatchObject({ email: null, display_name: "Plain", color: colorFor("plain") });
		expect((await personOf("guest"))?.id).toBe(GUEST_PERSON);
		const profiles = await rows<{ user_id: string; person_id: string; rev: number; onboarded_at: Date | null }>(
			`select user_id, person_id, rev, onboarded_at from kh_profile order by user_id`,
		);
		expect(profiles).toEqual([
			{ user_id: "guest", person_id: GUEST_PERSON, rev: 1, onboarded_at: null },
			{ user_id: "owner", person_id: WAITING, rev: 1, onboarded_at: null },
			{ user_id: "plain", person_id: plain?.id, rev: 1, onboarded_at: null },
		]);
	});

	it("keeps categories' ids in Kharcha's palette and icons, ahead of the defaults, and uses a name they already have", async () => {
		const categories = await rows<{ id: string; name: string; color: string; icon: string; position: number }>(
			`select id, name, color, icon, position from kh_category where owner_id = $1 order by position`,
			[WAITING],
		);
		expect(categories).toEqual([
			{ id: FOOD, name: "Food", color: "orange", icon: "utensils", position: -2 },
			{ id: MISC, name: "Misc", color: "gray", icon: "receipt", position: -1 },
		]);
		// The guest's "Food" is the "food" they had.
		expect(await rows(`select id from kh_category where owner_id = $1`, [GUEST_PERSON])).toEqual([{ id: GUEST_FOOD }]);
	});

	it("turns expenses into personal ones with the same ids: one payer, one share, the note as the title", async () => {
		const [momo] = await rows<Record<string, unknown>>(
			`select group_id, created_by, kind, title, amount_minor, currency, spent_on::text as spent_on, split, import_key, version, deleted_at
			from kh_expense where id = $1`,
			[MOMO],
		);
		expect(momo).toEqual({
			group_id: null,
			created_by: WAITING,
			kind: "expense",
			title: "Momo",
			amount_minor: 125000,
			currency: "NPR",
			spent_on: "2026-03-05",
			split: { method: "full", person: WAITING },
			import_key: KEY,
			version: 1,
			deleted_at: null,
		});
		expect(
			await rows(`select person_id, amount_minor, position, method_id from kh_expense_payer where expense_id = $1`, [
				MOMO,
			]),
		).toEqual([{ person_id: WAITING, amount_minor: 125000, position: 0, method_id: null }]);
		const shares = await rows<{
			expense_id: string;
			person_id: string;
			owed_minor: number;
			category_id: string | null;
		}>(`select expense_id, person_id, owed_minor, category_id from kh_expense_share order by expense_id`);
		const plain = (await personOf("plain"))?.id;
		expect(shares).toEqual([
			{ expense_id: MOMO, person_id: WAITING, owed_minor: 125000, category_id: FOOD },
			{ expense_id: DOLLARS, person_id: WAITING, owed_minor: 5000, category_id: null },
			{ expense_id: TEA, person_id: plain, owed_minor: 2000, category_id: null },
			{ expense_id: GUEST_MEAL, person_id: GUEST_PERSON, owed_minor: 3000, category_id: GUEST_FOOD },
		]);
		// Personal: nobody owes anybody.
		expect(await rows(`select id from kh_ledger`)).toEqual([]);
	});

	it("leaves each expense's history, dated when it was made", async () => {
		const history = await rows<{ expense_id: string; actor_id: string; kind: string; data: unknown; at: Date }>(
			`select expense_id, actor_id, kind, data, at from kh_activity where expense_id = $1`,
			[MOMO],
		);
		expect(history).toEqual([
			{
				expense_id: MOMO,
				actor_id: WAITING,
				kind: "expense.created",
				data: { title: "Momo" },
				at: new Date("2026-03-05T10:00:00Z"),
			},
		]);
		expect(await rows(`select id from kh_activity`)).toHaveLength(4);
	});

	it("makes one monthly budget per category and currency from its first month, earlier amounts its own months", async () => {
		const budgets = await rows<Record<string, unknown>>(
			`select id, category_id, currency, period, amount_minor, starts_on::text as starts_on
			from kh_budget where owner_id = $1 order by currency`,
			[WAITING],
		);
		expect(budgets).toEqual([
			{
				id: budget(3),
				category_id: FOOD,
				currency: "NPR",
				period: "month",
				amount_minor: 600000,
				starts_on: "2026-01-01",
			},
			{
				id: budget(4),
				category_id: FOOD,
				currency: "USD",
				period: "month",
				amount_minor: 10000,
				starts_on: "2026-02-01",
			},
		]);
		// February had the latest amount already: only January is a month of its own.
		expect(
			await rows(`select budget_id, month::text as month, amount_minor from kh_budget_month order by month`),
		).toEqual([{ budget_id: budget(3), month: "2026-01-01", amount_minor: 500000 }]);
		// The guest's own budget on that category and currency stays as it was.
		expect(await rows(`select id, amount_minor from kh_budget where owner_id = $1`, [GUEST_PERSON])).toEqual([
			{ id: GUEST_BUDGET, amount_minor: 700000 },
		]);
	});

	it("keeps import keys with their answers", async () => {
		expect(await rows(`select key, owner_id, fingerprint, result from kh_import order by key`)).toEqual([
			{ key: KEY, owner_id: WAITING, fingerprint: "abc", result: { inserted: 1, categories: 1, tags: 0, methods: 0 } },
			{ key: UNFINISHED_KEY, owner_id: WAITING, fingerprint: "def", result: null },
		]);
	});

	it("points a portfolio project's app at Kharcha", async () => {
		expect(await rows(`select app_slug from portfolio_project`)).toEqual([{ app_slug: "kharcha" }]);
	});

	it("is followed by dropping the Expenses tables, and Kharcha's services read what moved", async () => {
		for (const statement of statements(DROP)) await client.exec(statement);
		expect(await rows(`select tablename from pg_tables where tablename like 'expense\\_%'`)).toEqual([]);

		const db: Db = drizzle({ client, schema, casing: "snake_case" });
		const owner = caller(db, "owner");
		const spend = await listSpend(owner, { q: "date:2026-03", sort: "-date", page: 1, pageSize: 20 });
		expect(
			spend.items.map((item) => item.source === "expense" && [item.id, item.title, item.category?.name ?? null]),
		).toEqual([
			[DOLLARS, "", null],
			[MOMO, "Momo", "Food"],
		]);
		expect(spend.totals).toEqual([
			{ currency: "NPR", amountMinor: 125000 },
			{ currency: "USD", amountMinor: 5000 },
		]);
		const detail = await getExpense(owner, MOMO);
		expect([detail.title, detail.activity.length]).toEqual(["Momo", 1]);
		const budgets = await listBudgets(owner);
		expect(budgets.map((view) => [view.id, view.category?.name, view.currency, view.amountMinor, view.months])).toEqual(
			[
				[budget(3), "Food", "NPR", 600000, [{ month: "2026-01", amountMinor: 500000 }]],
				[budget(4), "Food", "USD", 10000, []],
			],
		);
	});
});
