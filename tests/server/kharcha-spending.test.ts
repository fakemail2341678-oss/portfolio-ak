import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, DEFAULT_METHODS } from "@/features/kharcha/settings";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime";
import * as schema from "@/server/db/schema";
import * as expenses from "@/server/kharcha/expenses/service";
import * as friends from "@/server/kharcha/friends/service";
import * as home from "@/server/kharcha/home/service";
import * as lists from "@/server/kharcha/lists/service";
import * as me from "@/server/kharcha/me/service";
import * as receipts from "@/server/kharcha/receipts/service";
import * as spend from "@/server/kharcha/spend/service";
import { createFakeCloudinary } from "../utils/fake-cloudinary";
import { createTestDb } from "../utils/test-db";
import { caller, code, expectLedgerConsistent, insertUsers, reason, uploadReceipt } from "./kharcha-helpers";

/**
 * Task 89 on PGlite (docs/guides/kharcha.md "Lists", "Receipts", "Spend"): the caller's own
 * categories, tags, methods and rules, the helpers without AI (rules, the last category, possible
 * duplicates), receipts and drafts, an expense's history, and a first Spend.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
const cloudinary = createFakeCloudinary();

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) => insertUsers(db, ["maya", "asha"], ["guest"]));
}, 60_000);
afterAll(() => env.close());
beforeEach(() => env.reset());

const as = (id: string) => caller(env.db, id, { guest: id === "guest", imageStore: cloudinary.store });
const today = "2026-11-12";
const base = {
	groupId: null,
	kind: "expense" as const,
	title: "",
	merchant: "",
	notes: "",
	currency: "NPR" as const,
	spentOn: today,
};
const spendOf = (id: string, input: Partial<Parameters<typeof spend.listSpend>[1]> = {}) =>
	spend.listSpend(as(id), { q: "", category: [], sort: "-date", page: 1, pageSize: 25, month: "2026-11", ...input });

describe("Kharcha: lists", () => {
	it("are made from the defaults once, in the language of the first visit, and are the caller's own", async () => {
		const locale = getLocale;
		overwriteGetLocale(() => "ne");
		const first = await lists.getLists(as("maya")).finally(() => overwriteGetLocale(locale));
		expect(first.categories.map((category) => category.name)).toEqual(
			DEFAULT_CATEGORIES.map((category) => category.name.ne),
		);
		expect(first.methods.map((method) => method.name)).toEqual(DEFAULT_METHODS.map((method) => method.ne));
		// Deleting them all doesn't bring them back.
		for (const category of first.categories) await lists.deleteCategory(as("maya"), category.id);
		expect((await lists.getLists(as("maya"))).categories).toEqual([]);
		expect((await lists.getLists(as("asha"))).categories[0]?.name).toBe(DEFAULT_CATEGORIES[0]?.name.en);
	});

	it("keep names unique in any case, order as asked, archive, and delete to uncategorized", async () => {
		const start = await lists.getLists(as("maya"));
		const food = start.categories[0];
		if (!food) throw new Error("no categories");
		expect(
			await code(lists.createCategory(as("maya"), { name: food.name.toUpperCase(), icon: "gift", color: "red" })),
		).toBe("CONFLICT");
		expect(await code(lists.createTag(as("maya"), "Trip"))).toBe("ok");
		expect(await code(lists.createTag(as("maya"), "trip"))).toBe("CONFLICT");

		const ids = start.categories.map((category) => category.id);
		const reordered = await lists.reorderCategories(as("maya"), [...ids].reverse());
		expect(reordered.categories.map((category) => category.id)).toEqual([...ids].reverse());
		expect(await code(lists.reorderCategories(as("maya"), ids.slice(1)))).toBe("CONFLICT");

		const expense = await expenses.createExpense(as("maya"), { ...base, amountMinor: 5_000, categoryId: food.id });
		expect(expense.category?.name).toBe(food.name);
		const archived = await lists.updateCategory(as("maya"), { ...food, archived: true });
		expect(archived.categories.find((category) => category.id === food.id)).toMatchObject({ archived: true, used: 1 });

		await lists.deleteCategory(as("maya"), food.id);
		const after = await expenses.getExpense(as("maya"), expense.id);
		expect(after.category).toBeNull();
		expect(after.fixes).toEqual(["uncategorized"]);
	});

	it("refuse a rule that sets nothing, and lists with another's ids", async () => {
		await lists.getLists(as("maya"));
		expect(
			await reason(
				lists.createRule(as("maya"), {
					match: "contains",
					pattern: "Mart",
					categoryId: null,
					tagIds: [],
					methodId: null,
				}),
			),
		).toBe("Choose what the rule sets: a category, tags or a payment method.");
		const asha = await lists.getLists(as("asha"));
		expect(
			await code(
				lists.createRule(as("maya"), {
					match: "contains",
					pattern: "Mart",
					categoryId: asha.categories[0]?.id ?? null,
					tagIds: [],
					methodId: null,
				}),
			),
		).toBe("NOT_FOUND");
	});
});

describe("Kharcha: the helpers without AI", () => {
	it("a merchant's rule sets a new expense's category, tags and method; else the category last given it", async () => {
		const mine = await lists.getLists(as("maya"));
		const [food, groceries] = mine.categories;
		const cash = mine.methods[0];
		const tag = (await lists.createTag(as("maya"), "home")).tags[0];
		if (!food || !groceries || !cash || !tag) throw new Error("no lists");
		await lists.createRule(as("maya"), {
			match: "contains",
			pattern: "bhat bhateni",
			categoryId: groceries.id,
			tagIds: [tag.id],
			methodId: cash.id,
		});

		const ruled = await expenses.createExpense(as("maya"), {
			...base,
			amountMinor: 1_000,
			merchant: "Bhat-Bhateni Store",
		});
		expect(ruled.mine).toMatchObject({ categoryId: groceries.id, tagIds: [tag.id], methodId: cash.id });
		// What the caller sends wins over the rule; null is "none".
		const chosen = await expenses.createExpense(as("maya"), {
			...base,
			amountMinor: 2_000,
			merchant: "Bhatbhateni",
			categoryId: null,
			tagIds: [],
		});
		expect(chosen.mine).toMatchObject({ categoryId: null, tagIds: [], methodId: cash.id });

		await expenses.createExpense(as("maya"), {
			...base,
			amountMinor: 3_000,
			merchant: "Momo Hut",
			categoryId: food.id,
		});
		const remembered = await expenses.createExpense(as("maya"), { ...base, amountMinor: 4_000, merchant: "momo hut" });
		expect(remembered.category?.id).toBe(food.id);

		const merchants = await lists.getMerchants(as("maya"));
		expect(merchants.map((merchant) => [merchant.merchant.toLowerCase(), merchant.uses])).toEqual(
			expect.arrayContaining([
				["momo hut", 2],
				["bhatbhateni", 1],
			]),
		);
		expect(merchants.find((merchant) => merchant.merchant.toLowerCase() === "momo hut")?.categoryId).toBe(food.id);
		expect(await lists.getMerchants(as("asha"))).toEqual([]);
	});

	it("flags possible duplicates until either one is dismissed", async () => {
		const one = await expenses.createExpense(as("maya"), { ...base, amountMinor: 248_050, merchant: "Bhatbhateni" });
		const two = await expenses.createExpense(as("maya"), {
			...base,
			amountMinor: 248_050,
			merchant: "BHATBHATENI store",
			spentOn: "2026-11-11",
		});
		// Not one: another amount, two days apart, or another merchant.
		await expenses.createExpense(as("maya"), { ...base, amountMinor: 248_000, merchant: "Bhatbhateni" });
		await expenses.createExpense(as("maya"), {
			...base,
			amountMinor: 248_050,
			merchant: "Bhatbhateni",
			spentOn: "2026-11-09",
		});
		await expenses.createExpense(as("maya"), {
			...base,
			amountMinor: 248_050,
			merchant: "Salesberry",
			spentOn: "2026-11-11",
		});

		const first = await expenses.getExpense(as("maya"), one.id);
		expect(first.fixes).toContain("duplicate");
		expect(first.duplicates.map((ref) => ref.id)).toEqual([two.id]);
		const todos = (await home.getHome(as("maya"))).todos;
		expect(todos.filter((todo) => todo.kind === "duplicate")).toHaveLength(1);

		await expenses.setNotDuplicate(as("maya"), two.id, true);
		expect((await expenses.getExpense(as("maya"), one.id)).duplicates).toEqual([]);
		expect((await expenses.getExpense(as("maya"), two.id)).fixes).not.toContain("duplicate");
		expect((await home.getHome(as("maya"))).todos).toEqual([]);
	});
});

describe("Kharcha: an expense's own part and its history", () => {
	it("keeps each person's category through a change of split, and their lists out of a shared history", async () => {
		const maya = (await me.getMe(as("maya"))).person.id;
		const asha = (await me.getMe(as("asha"))).person.id;
		await friends.addFriend(as("maya"), { name: "Asha", email: "asha@example.com" });
		const mayaFood = (await lists.getLists(as("maya"))).categories[0];
		const ashaFood = (await lists.getLists(as("asha"))).categories[0];
		if (!mayaFood || !ashaFood) throw new Error("no lists");

		const shared = await expenses.createExpense(as("maya"), {
			...base,
			title: "Dinner",
			amountMinor: 90_000,
			split: { method: "equal", people: [maya, asha] },
			categoryId: mayaFood.id,
		});
		const ashaSaw = await expenses.getExpense(as("asha"), shared.id);
		// Her own category of the same built-in as Maya's (Task 90).
		expect(ashaSaw.category?.id).toBe(ashaFood.id);
		await expenses.updateExpense(as("asha"), {
			...base,
			title: "Dinner",
			expenseId: shared.id,
			version: ashaSaw.version,
			amountMinor: 90_000,
			split: {
				method: "exact",
				parts: [
					{ person: maya, amount: 30_000 },
					{ person: asha, amount: 60_000 },
				],
			},
			payers: [{ person: maya, amount: 90_000 }],
			categoryId: ashaFood.id,
		});
		expect((await expenses.getExpense(as("maya"), shared.id)).category?.id).toBe(mayaFood.id);
		const detail = await expenses.getExpense(as("asha"), shared.id);
		expect(detail.category?.id).toBe(ashaFood.id);
		expect(detail.activity.map((line) => line.data.field ?? line.kind)).toEqual(["expense.created", "split"]);
		await expectLedgerConsistent(env.db);

		// Theirs alone: the history says what their category was and became.
		const personal = await expenses.createExpense(as("maya"), { ...base, title: "Tea", amountMinor: 1_000 });
		await expenses.updateExpense(as("maya"), {
			...base,
			title: "Tea",
			expenseId: personal.id,
			version: personal.version,
			amountMinor: 1_500,
			categoryId: mayaFood.id,
		});
		const history = (await expenses.getExpense(as("maya"), personal.id)).activity.map((line) => line.data);
		expect(history).toEqual(
			expect.arrayContaining([
				{ field: "amountMinor", from: 1_000, to: 1_500 },
				{ field: "category", from: null, to: mayaFood.name },
			]),
		);
	});
});

describe("Kharcha: receipts", () => {
	it("go on an expense in order, a draft keeps them until it becomes one, and a guest's limit holds", async () => {
		const first = await uploadReceipt(as("maya"), cloudinary);
		const pdf = await uploadReceipt(as("maya"), cloudinary, "pdf");
		const expense = await expenses.createExpense(as("maya"), { ...base, amountMinor: 1_000, receiptIds: [pdf, first] });
		expect(expense.receipts.map((receipt) => [receipt.id, receipt.format])).toEqual([
			[pdf, "pdf"],
			[first, "jpg"],
		]);
		const edited = await expenses.updateExpense(as("maya"), {
			...base,
			expenseId: expense.id,
			version: expense.version,
			amountMinor: 1_000,
			receiptIds: [first],
		});
		expect(edited.receipts.map((receipt) => receipt.id)).toEqual([first]);
		expect((await expenses.getExpense(as("maya"), expense.id)).activity.at(-1)?.data).toEqual({
			field: "receipts",
			from: 2,
			to: 1,
		});
		// Someone else's upload, or one already on an expense, can't be used.
		expect(await code(expenses.createExpense(as("asha"), { ...base, amountMinor: 1, receiptIds: [first] }))).toBe(
			"BAD_REQUEST",
		);

		const draft = await receipts.createDraft(as("maya"), [await uploadReceipt(as("maya"), cloudinary)]);
		const todo = (await home.getHome(as("maya"))).todos[0];
		expect(todo).toMatchObject({ kind: "receipt", draft: { id: draft.id } });
		const made = await expenses.createExpense(as("maya"), { ...base, amountMinor: 2_000, draftId: draft.id });
		expect(made.receipts.map((receipt) => receipt.id)).toEqual(draft.receipts.map((receipt) => receipt.id));
		expect(await env.db.select().from(schema.khReceiptDraft)).toEqual([]);
		expect((await home.getHome(as("maya"))).todos).toEqual([]);

		const guest = as("guest");
		const many = [];
		for (let index = 0; index < 6; index++) many.push(await uploadReceipt(guest, cloudinary));
		expect(await reason(expenses.createExpense(guest, { ...base, amountMinor: 1, receiptIds: many }))).toBe(
			"An expense can have 5 receipts at most.",
		);
	});

	it("a thrown-away draft marks its files for the attachments cleanup", async () => {
		const draft = await receipts.createDraft(as("maya"), [await uploadReceipt(as("maya"), cloudinary)]);
		await receipts.deleteDraft(as("maya"), draft.id);
		const [row] = await env.db
			.select()
			.from(schema.attachment)
			.where(eq(schema.attachment.id, draft.receipts[0]?.id ?? ""));
		expect(row?.deletedAt).not.toBeNull();
	});
});

describe("Kharcha: Spend", () => {
	it("is this month by default, the caller's share newest first, refunds against the total", async () => {
		const maya = (await me.getMe(as("maya"))).person.id;
		const asha = (await me.getMe(as("asha"))).person.id;
		await friends.addFriend(as("maya"), { name: "Asha", email: "asha@example.com" });
		const food = (await lists.getLists(as("maya"))).categories[0];
		await expenses.createExpense(as("maya"), {
			...base,
			title: "Rice",
			amountMinor: 10_000,
			categoryId: food?.id ?? null,
		});
		await expenses.createExpense(as("maya"), {
			...base,
			title: "Dinner",
			amountMinor: 9_000,
			spentOn: "2026-11-03",
			split: { method: "equal", people: [maya, asha] },
		});
		await expenses.createExpense(as("maya"), { ...base, kind: "refund", title: "Return", amountMinor: 2_000 });
		await expenses.createExpense(as("maya"), { ...base, title: "October", amountMinor: 50_000, spentOn: "2026-10-30" });
		const trashed = await expenses.createExpense(as("maya"), { ...base, title: "Gone", amountMinor: 7_000 });
		await expenses.deleteExpense(as("maya"), trashed.id);

		const page = await spendOf("maya");
		expect(page.items.map((row) => [row.title, row.myShareMinor])).toEqual([
			["Return", 2_000],
			["Rice", 10_000],
			["Dinner", 4_500],
		]);
		expect(page.totals).toEqual([{ currency: "NPR", amountMinor: 12_500 }]);
		expect(page.items.find((row) => row.title === "Dinner")?.fixes).toEqual(["uncategorized"]);

		expect((await spendOf("maya", { month: "all" })).total).toBe(4);
		expect((await spendOf("maya", { category: ["none"] })).items.map((row) => row.title)).toEqual(["Return", "Dinner"]);
		expect((await spendOf("maya", { q: "rice" })).items.map((row) => row.title)).toEqual(["Rice"]);
		expect((await spendOf("maya", { sort: "-amount" })).items[0]?.title).toBe("Rice");
		// Asha sees her share of the dinner, nothing of Maya's own.
		expect((await spendOf("asha")).items.map((row) => [row.title, row.myShareMinor])).toEqual([["Dinner", 4_500]]);
	});
});
