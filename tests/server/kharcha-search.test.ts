import { eq, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ImportRow } from "@/features/kharcha/schema";
import { SPEND_GROUP_BY } from "@/features/kharcha/search";
import { QUERY_FIELDS } from "@/features/kharcha/spend/query/ast";
import { parseQuery } from "@/features/kharcha/spend/query/parse";
import { khActivity, khExpense, khImport } from "@/server/db/schema";
import * as expenses from "@/server/kharcha/expenses/service";
import * as friends from "@/server/kharcha/friends/service";
import * as groups from "@/server/kharcha/groups/service";
import * as lists from "@/server/kharcha/lists/service";
import * as me from "@/server/kharcha/me/service";
import * as payments from "@/server/kharcha/payments/service";
import { bulkExpenses } from "@/server/kharcha/spend/bulk";
import { compileQuery } from "@/server/kharcha/spend/compile";
import { importSpend } from "@/server/kharcha/spend/import";
import * as saved from "@/server/kharcha/spend/saved";
import * as spend from "@/server/kharcha/spend/service";
import { createFakeCloudinary } from "../utils/fake-cloudinary";
import { createTestDb } from "../utils/test-db";
import { caller, code, expectLedgerConsistent, insertUsers, uploadReceipt } from "./kharcha-helpers";

/**
 * Task 93 on PGlite (docs/guides/kharcha.md "Spend's search"): the search language compiled
 * to SQL, field by field and against injection; payments in Spend; the chart; the CSV; bulk
 * actions; saved searches; the import, once per key.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
const cloudinary = createFakeCloudinary();

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) => insertUsers(db, ["maya", "asha", "bikash"], ["guest"]));
}, 60_000);
afterAll(() => env.close());
beforeEach(() => env.reset());

const as = (id: string) => caller(env.db, id, { guest: id === "guest", imageStore: cloudinary.store });
const personOf = async (id: string) => (await me.getMe(as(id))).person.id;
const base = {
	groupId: null,
	kind: "expense" as const,
	title: "",
	merchant: "",
	notes: "",
	currency: "NPR" as const,
	spentOn: "2026-11-02",
};

/**
 * Maya's November: rice at Bhatbhateni (groceries, tagged work, paid by cash, a receipt), the
 * trip's dinner she paid for the three (Asha paid her back, Bikash hasn't), a refund, a taxi in
 * dollars Asha paid for the two of them, and the same rice twice (a possible duplicate).
 */
async function world() {
	const [maya, asha, bikash] = [await personOf("maya"), await personOf("asha"), await personOf("bikash")];
	await friends.addFriend(as("maya"), { name: "Asha", email: "asha@example.com" });
	await friends.addFriend(as("maya"), { name: "Bikash", email: "bikash@example.com" });
	await friends.updateFriend(as("maya"), { personId: bikash, nickname: "Bikku" });
	const trip = await groups.createGroup(as("maya"), {
		name: "Pokhara trip",
		kind: "trip",
		color: "teal",
		currency: "NPR",
		startOn: null,
		endOn: null,
		memberIds: [asha, bikash],
	});
	// Groceries and Cash are among the defaults; work is a tag of her own.
	const own = await lists.getLists(as("maya"));
	const groceries = own.categories.find((each) => each.name === "Groceries")?.id ?? null;
	const cash = own.methods.find((each) => each.name === "Cash")?.id ?? null;
	const work = (await lists.createTag(as("maya"), "work")).tags.find((tag) => tag.name === "work")?.id ?? "";
	const receipt = await uploadReceipt(as("maya"), cloudinary);
	const rice = await expenses.createExpense(as("maya"), {
		...base,
		title: "Rice",
		merchant: "Bhatbhateni",
		amountMinor: 100_000,
		categoryId: groceries,
		tagIds: [work],
		methodId: cash,
		receiptIds: [receipt],
	});
	const dinner = await expenses.createExpense(as("maya"), {
		...base,
		groupId: trip.id,
		title: "Dinner",
		notes: "lakeside momo",
		amountMinor: 300_000,
		spentOn: "2026-11-03",
		split: { method: "equal", people: [maya, asha, bikash] },
	});
	await payments.createPayment(as("asha"), {
		groupId: trip.id,
		fromId: asha,
		toId: maya,
		amountMinor: 100_000,
		currency: "NPR",
		paid: null,
		method: "eSewa",
		note: "for dinner",
		paidOn: "2026-11-04",
	});
	const refund = await expenses.createExpense(as("maya"), {
		...base,
		kind: "refund",
		title: "Daraz return",
		amountMinor: 20_000,
		spentOn: "2026-11-05",
		categoryId: null,
	});
	const taxi = await expenses.createExpense(as("asha"), {
		...base,
		title: "Taxi",
		currency: "USD",
		amountMinor: 1_250,
		spentOn: "2026-10-20",
		split: { method: "equal", people: [maya, asha] },
	});
	const again = await expenses.createExpense(as("maya"), {
		...base,
		title: "",
		merchant: "Bhatbhateni Store",
		amountMinor: 100_000,
		categoryId: null,
	});
	return { maya, asha, bikash, trip: trip.id, groceries, work, cash, rice, dinner, refund, taxi, again };
}

/** The titles (or merchants) Spend lists for a query, newest first; payments by their note. */
async function titles(by: string, q: string, sort: "-date" | "-amount" = "-date") {
	const page = await spend.listSpend(as(by), { q, sort, page: 1, pageSize: 100 });
	return page.items.map((item) => (item.source === "expense" ? item.title || item.merchant : `payment: ${item.note}`));
}

describe("Spend's search: every field", () => {
	it("compiles each field, the words and the operators to the rows they name", async () => {
		await world();
		const all = ["Bhatbhateni Store", "Daraz return", "Dinner", "Rice", "Taxi"];
		expect([...(await titles("maya", ""))].sort()).toEqual(all);
		expect(await titles("maya", "type:refund")).toEqual(["Daraz return"]);
		expect(await titles("maya", "-type:refund date:2026-11")).toEqual(["Dinner", "Bhatbhateni Store", "Rice"]);
		expect(await titles("maya", "category:groceries")).toEqual(["Rice"]);
		expect(await titles("maya", "category:GROCERIES,nothing")).toEqual(["Rice"]);
		expect(await titles("maya", "tag:work")).toEqual(["Rice"]);
		expect(await titles("maya", "merchant:bhat")).toEqual(["Bhatbhateni Store", "Rice"]);
		expect(await titles("maya", "merchant=bhatbhateni")).toEqual(["Rice"]);
		expect(await titles("maya", 'merchant="Bhatbhateni Store"')).toEqual(["Bhatbhateni Store"]);
		// Amounts in the currency's major units, against the expense's amount.
		expect(await titles("maya", "amount>1000")).toEqual(["Dinner"]);
		expect(await titles("maya", "amount>=1000")).toEqual(["Dinner", "Bhatbhateni Store", "Rice"]);
		expect(await titles("maya", "amount=12.50")).toEqual(["Taxi"]);
		expect(await titles("maya", "amount<200.01 currency:npr")).toEqual(["Daraz return"]);
		expect(await titles("maya", "currency:usd")).toEqual(["Taxi"]);
		expect(await titles("maya", "date:2026-10")).toEqual(["Taxi"]);
		expect(await titles("maya", "date:2026-11-03")).toEqual(["Dinner"]);
		expect(await titles("maya", "date>2026-11-03")).toEqual(["Daraz return"]);
		expect(await titles("maya", "date>=2026-11-03 date<=2026-11-04")).toEqual(["Dinner"]);
		expect(await titles("maya", "date<2026-11")).toEqual(["Taxi"]);
		expect(await titles("maya", 'group:"pokhara trip"')).toEqual(["Dinner"]);
		expect(await titles("maya", "with:asha")).toEqual(["Dinner", "Taxi"]);
		// The caller's nickname for someone, and a name's first word.
		expect(await titles("maya", "with:bikku")).toEqual(["Dinner"]);
		expect(await titles("maya", "paid-by:me date:2026-11")).toEqual([
			"Daraz return",
			"Dinner",
			"Bhatbhateni Store",
			"Rice",
		]);
		expect(await titles("maya", "paid-by:asha")).toEqual(["Taxi"]);
		expect(await titles("maya", "method:cash")).toEqual(["Rice"]);
		expect(await titles("maya", "has:receipt")).toEqual(["Rice"]);
		expect(await titles("maya", "is:shared")).toEqual(["Dinner", "Taxi"]);
		expect(await titles("maya", "is:personal")).toEqual(["Daraz return", "Bhatbhateni Store", "Rice"]);
		expect(await titles("maya", "is:duplicate")).toEqual(["Bhatbhateni Store", "Rice"]);
		expect(await titles("maya", "is:uncategorized date:2026-11")).toEqual([
			"Daraz return",
			"Dinner",
			"Bhatbhateni Store",
		]);
		// Words: prefixes of the title, merchant and notes; a phrase; a word left out.
		expect(await titles("maya", "lake")).toEqual(["Dinner"]);
		expect(await titles("maya", '"lakeside momo"')).toEqual(["Dinner"]);
		expect(await titles("maya", '"momo lakeside"')).toEqual([]);
		expect(await titles("maya", "bhat -store")).toEqual(["Rice"]);
		expect(await titles("maya", "-is:shared -is:duplicate")).toEqual(["Daraz return"]);
		// A term the bar marks as not understood is left out, not an error.
		expect(await titles("maya", "amount>abc is:whatever category:groceries")).toEqual(["Rice"]);
	});

	it("knows what is still owed: the dinner for Maya (Bikash owes), the taxi for both, never a payment", async () => {
		await world();
		expect(await titles("maya", "is:unsettled")).toEqual(["Dinner", "Taxi"]);
		// Asha paid Maya back for the dinner; she still has the taxi to be paid for.
		expect(await titles("asha", "is:unsettled")).toEqual(["Taxi"]);
		expect(await titles("asha", "is:unsettled type:expense,payment")).toEqual(["Taxi"]);
	});

	it("lists payments only when asked, never counts them as spending, and orders them with the expenses", async () => {
		await world();
		expect(await titles("maya", "date:2026-11-04")).toEqual([]);
		expect(await titles("maya", "type:payment")).toEqual(["payment: for dinner"]);
		expect(await titles("maya", "type:payment,expense date>=2026-11-03 -type:refund")).toEqual([
			"payment: for dinner",
			"Dinner",
		]);
		expect(await titles("maya", "type:payment with:asha method:esewa")).toEqual(["payment: for dinner"]);
		expect(await titles("maya", "type:payment paid-by:asha amount=1000 dinner")).toEqual(["payment: for dinner"]);
		expect(await titles("maya", "type:payment category:groceries")).toEqual([]);
		const page = await spend.listSpend(as("maya"), {
			q: "type:payment,expense,refund date:2026-11",
			sort: "-amount",
			page: 1,
			pageSize: 2,
		});
		expect(page.total).toBe(5);
		expect(page.pageCount).toBe(3);
		// The largest amount first: the payment's 1,000 beside the shares (Maya's of the dinner is 1,000 too).
		expect(page.items.map((item) => item.source)).toHaveLength(2);
		expect(page.totals).toEqual([{ currency: "NPR", amountMinor: 100_000 + 100_000 + 100_000 - 20_000 }]);
	});

	it("lets nothing through but parameters: no field outside the list, no value in the SQL", async () => {
		const hostile = [
			"'; drop table kh_expense; --",
			`category:"x') or 1=1 --"`,
			"amount>1);delete from kh_expense;--",
			'merchant="%" date:2026-11-01\'',
			`with:"' or ''='" paid-by:me`,
			"is:shared'or'1'='1 has:receipt;--",
			`tag:"\\"); drop table kh_tag; --"`,
		];
		await world();
		for (const q of hostile) {
			const compiled = compileQuery(parseQuery(q), {
				personId: "00000000-0000-4000-8000-000000000000",
				today: "2026-11-13",
				duplicateIds: [],
			});
			const rendered = new PgDialect().sqlToQuery(compiled.expense);
			expect(rendered.sql, q).not.toMatch(/drop table|delete from|1=1|''=/i);
			expect(await code(spend.listSpend(as("maya"), { q, sort: "-date", page: 1, pageSize: 10 })), q).toBe("ok");
		}
		expect((await env.db.select({ count: sql<number>`count(*)` }).from(khExpense))[0]?.count).toBeDefined();
		// Every field of the language compiles and runs, with each operator.
		for (const field of QUERY_FIELDS) {
			for (const op of [":", "=", ">", "<"]) {
				const q = `${field}${op}x -${field}${op}2026-11`;
				expect(await code(spend.listSpend(as("maya"), { q, sort: "-date", page: 1, pageSize: 5 })), q).toBe("ok");
			}
		}
	});
});

describe("Spend's chart and CSV", () => {
	it("sums the caller's share by each grouping, per currency, refunds against it", async () => {
		const w = await world();
		for (const groupBy of SPEND_GROUP_BY) {
			expect(await code(spend.spendChart(as("maya"), { q: "", groupBy })), groupBy).toBe("ok");
		}
		const byCategory = await spend.spendChart(as("maya"), { q: "date:2026-11", groupBy: "category" });
		expect(byCategory.currencies.map((each) => each.currency)).toEqual(["NPR"]);
		const npr = byCategory.currencies[0];
		expect(npr?.total).toBe(100_000 + 100_000 + 100_000 - 20_000);
		expect(npr?.buckets).toEqual([
			{ key: "", label: "", amountMinor: 180_000 },
			{ key: w.groceries, label: "Groceries", amountMinor: 100_000 },
		]);
		const byFriend = await spend.spendChart(as("maya"), { q: "", groupBy: "friend" });
		const usd = byFriend.currencies.find((each) => each.currency === "USD");
		expect(usd?.buckets).toEqual([{ key: w.asha, label: "Asha", amountMinor: 625 }]);
		const months = await spend.spendChart(as("maya"), { q: "-currency:usd", groupBy: "month" });
		expect(months.currencies[0]?.buckets.map((each) => each.key)).toEqual(["2026-11"]);
		const weeks = await spend.spendChart(as("maya"), { q: "date:2026-11-02", groupBy: "week" });
		// Weeks start on Sunday: Monday the 2nd is in the week of the 1st.
		expect(weeks.currencies[0]?.buckets.map((each) => each.key)).toEqual(["2026-11-01"]);
		const tags = await spend.spendChart(as("maya"), { q: "merchant:bhat", groupBy: "tag" });
		// The same amount either way: by name, "none" first.
		expect(tags.currencies[0]?.buckets).toEqual([
			{ key: "", label: "", amountMinor: 100_000 },
			{ key: w.work, label: "work", amountMinor: 100_000 },
		]);
	});

	it("exports the search, or the rows chosen, with the total, the share and the caller's own names", async () => {
		const w = await world();
		const rows = await spend.exportSpend(as("maya"), { q: "date:2026-11" });
		expect(rows.map((row) => row.title || row.merchant)).toEqual([
			"Daraz return",
			"Dinner",
			"Bhatbhateni Store",
			"Rice",
		]);
		expect(rows.find((row) => row.title === "Rice")).toMatchObject({
			kind: "expense",
			category: "Groceries",
			tags: ["work"],
			method: "Cash",
			amountMinor: 100_000,
			shareMinor: 100_000,
			paidBy: ["Maya"],
			group: "",
		});
		expect(rows.find((row) => row.title === "Dinner")).toMatchObject({
			amountMinor: 300_000,
			shareMinor: 100_000,
			group: "Pokhara trip",
		});
		// A selection: only what the caller is on (Bikash's own expense isn't Maya's to export).
		const theirs = await expenses.createExpense(as("bikash"), { ...base, title: "Bikash's", amountMinor: 5_000 });
		const chosen = await spend.exportSpend(as("maya"), { q: "", ids: [w.taxi.id, theirs.id] });
		expect(chosen.map((row) => [row.title, row.currency, row.shareMinor])).toEqual([["Taxi", "USD", 625]]);
	});
});

describe("Bulk actions", () => {
	it("change the caller's own part, skip what isn't theirs or is already so, and refuse another's list", async () => {
		const w = await world();
		const theirs = await expenses.createExpense(as("bikash"), { ...base, title: "Bikash's", amountMinor: 5_000 });
		const ids = [w.rice.id, w.dinner.id, w.again.id, theirs.id];
		expect(await bulkExpenses(as("maya"), { ids, action: { kind: "category", categoryId: w.groceries } })).toEqual({
			changed: 2,
			skipped: 2,
		});
		expect(await titles("maya", "category:groceries")).toEqual(["Dinner", "Bhatbhateni Store", "Rice"]);
		// Asha's share of the dinner keeps her own (none).
		expect(await titles("asha", "is:uncategorized")).toContain("Dinner");
		expect(await bulkExpenses(as("maya"), { ids, action: { kind: "tags", tagIds: [w.work] } })).toEqual({
			changed: 2,
			skipped: 2,
		});
		// The method is on the payer's row: Maya didn't pay for the taxi.
		expect(
			await bulkExpenses(as("maya"), { ids: [w.taxi.id, w.dinner.id], action: { kind: "method", methodId: w.cash } }),
		).toEqual({ changed: 1, skipped: 1 });
		const bikashCategory = (
			await lists.createCategory(as("bikash"), { name: "His", icon: "gift", color: "pink" })
		).categories.find((each) => each.name === "His")?.id;
		expect(
			await code(
				bulkExpenses(as("maya"), {
					ids: [w.rice.id],
					action: { kind: "category", categoryId: bikashCategory ?? null },
				}),
			),
		).toBe("NOT_FOUND");
	});

	it("deletes to the trash where the caller may, as the expense page does", async () => {
		const w = await world();
		const result = await bulkExpenses(as("maya"), {
			ids: [w.rice.id, w.again.id, w.taxi.id],
			action: { kind: "delete" },
		});
		expect(result.changed).toBeGreaterThanOrEqual(2);
		expect(await titles("maya", "merchant:bhat")).toEqual([]);
		const history = await env.db
			.select({ kind: khActivity.kind })
			.from(khActivity)
			.where(eq(khActivity.expenseId, w.rice.id));
		expect(history.map((row) => row.kind)).toContain("expense.deleted");
		expect(await bulkExpenses(as("maya"), { ids: [w.rice.id], action: { kind: "delete" } })).toEqual({
			changed: 0,
			skipped: 1,
		});
		await expectLedgerConsistent(env.db);
	});
});

describe("Saved searches", () => {
	it("are the caller's own: saved in order, renamed, reordered whole, deleted; another's is NOT_FOUND", async () => {
		await saved.saveSearch(as("maya"), { name: "Food", query: "category:food" });
		const two = await saved.saveSearch(as("maya"), { name: "Big", query: "amount>1000" });
		expect(two.map((each) => each.name)).toEqual(["Food", "Big"]);
		expect((await me.getMe(as("maya"))).searches).toEqual(two);
		const [food, big] = two;
		if (!food || !big) throw new Error("two searches");
		expect((await saved.renameSearch(as("maya"), { id: big.id, name: "Large" })).map((each) => each.name)).toEqual([
			"Food",
			"Large",
		]);
		expect((await saved.reorderSearches(as("maya"), [big.id, food.id])).map((each) => each.name)).toEqual([
			"Large",
			"Food",
		]);
		expect(await code(saved.reorderSearches(as("maya"), [big.id]))).toBe("NOT_FOUND");
		expect(await code(saved.renameSearch(as("asha"), { id: big.id, name: "Mine" }))).toBe("NOT_FOUND");
		expect(await code(saved.deleteSearch(as("asha"), big.id))).toBe("NOT_FOUND");
		expect((await saved.deleteSearch(as("maya"), big.id)).map((each) => each.name)).toEqual(["Food"]);
		expect((await me.getMe(as("asha"))).searches).toEqual([]);
	});

	it("are limited to SAVED_SEARCHES_MAX each", async () => {
		for (let at = 0; at < saved.SAVED_SEARCHES_MAX; at += 1) {
			await saved.saveSearch(as("maya"), { name: `S${at}`, query: `amount>${at}` });
		}
		expect(await code(saved.saveSearch(as("maya"), { name: "One more", query: "tag:x" }))).toBe("FORBIDDEN");
	});
});

describe("The CSV import", () => {
	const row = (overrides: Partial<ImportRow> = {}): ImportRow => ({
		spentOn: "2026-11-01",
		kind: "expense",
		amountMinor: 45_000,
		currency: "NPR",
		title: "",
		merchant: "Himalayan Java",
		notes: "",
		category: "Coffee",
		tags: ["work", "Morning"],
		method: "Card",
		...overrides,
	});

	it("makes personal expenses with the caller's lists, matching names in any case and making the rest", async () => {
		await lists.createCategory(as("maya"), { name: "coffee", icon: "coffee", color: "amber" });
		const key = crypto.randomUUID();
		const rows = [row(), row({ merchant: "Daraz", kind: "refund", category: "Shopping", tags: ["work"], method: "" })];
		const result = await importSpend(as("maya"), { key, rows });
		// Coffee is hers (in another case), Shopping and Card are defaults: only the tags are new.
		expect(result).toEqual({ inserted: 2, categories: 0, tags: 2, methods: 0, replayed: false });
		expect(await titles("maya", "category:coffee tag:morning method:card")).toEqual(["Himalayan Java"]);
		expect(await titles("maya", "type:refund category:shopping is:personal")).toEqual(["Daraz"]);
		const made = await env.db.select({ key: khExpense.importKey }).from(khExpense);
		expect(made.every((each) => each.key === key)).toBe(true);
		const history = await env.db.select({ kind: khActivity.kind }).from(khActivity);
		expect(history.filter((each) => each.kind === "expense.created")).toHaveLength(2);
		await expectLedgerConsistent(env.db);
	});

	it("runs once per key: a repeat gets the first result, other rows or another's key are a CONFLICT", async () => {
		const key = crypto.randomUUID();
		await importSpend(as("maya"), { key, rows: [row()] });
		expect(await importSpend(as("maya"), { key, rows: [row()] })).toMatchObject({ inserted: 1, replayed: true });
		expect(await code(importSpend(as("maya"), { key, rows: [row({ amountMinor: 1 })] }))).toBe("CONFLICT");
		expect(await code(importSpend(as("asha"), { key, rows: [row()] }))).toBe("CONFLICT");
		expect((await spend.listSpend(as("maya"), { q: "", sort: "-date", page: 1, pageSize: 10 })).total).toBe(1);
		expect((await env.db.select().from(khImport)).map((each) => each.result)).toEqual([
			{ inserted: 1, categories: 1, tags: 2, methods: 0 },
		]);
	});

	it("takes 1,000 rows in one go, within the caller's quota", async () => {
		const rows = Array.from({ length: 1_000 }, (_, at) => row({ amountMinor: at + 1, tags: [] }));
		expect((await importSpend(as("maya"), { key: crypto.randomUUID(), rows })).inserted).toBe(1_000);
		expect((await spend.listSpend(as("maya"), { q: "", sort: "-date", page: 1, pageSize: 10 })).total).toBe(1_000);
		// A guest's quota is smaller than a thousand.
		expect(await code(importSpend(as("guest"), { key: crypto.randomUUID(), rows }))).toBe("FORBIDDEN");
	});
});
