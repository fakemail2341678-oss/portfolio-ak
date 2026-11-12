import "@tanstack/react-start/server-only";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { DEFAULT_METHODS, type KharchaSettings } from "@/features/kharcha/settings";
import type { CategoryChip, MerchantSuggestion } from "@/features/kharcha/types";
import type { Locale } from "@/paraglide/runtime";
import { notFound } from "@/server/db/crud";
import {
	khCategory,
	khExpense,
	khExpensePayer,
	khExpenseShare,
	khMerchantRule,
	khMethod,
	khProfile,
	khReceiptDraft,
	khShareTag,
	khTag,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/** Kharcha's own lists (Task 89): a person's categories, tags, payment methods and merchant rules. */

type Conn = Db | Tx;

const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/**
 * Two people's lists become one (`mergePerson`: a guest's claim, Task 90's joining). A
 * category of the same built-in key or the same name, a tag or a method of the same name,
 * is one: what used the other's now uses the stayer's, and the other's goes. The rest,
 * the rules and the receipt drafts move, after what the stayer had.
 */
export async function mergeLists(tx: Tx, fromId: string, toId: string): Promise<void> {
	const theirs = await tx.select().from(khCategory).where(eq(khCategory.ownerId, toId));
	for (const category of await tx.select().from(khCategory).where(eq(khCategory.ownerId, fromId))) {
		const same =
			(category.key ? theirs.find((other) => other.key === category.key) : undefined) ??
			theirs.find((other) => sameName(other.name, category.name));
		if (!same) continue;
		await tx.update(khExpenseShare).set({ categoryId: same.id }).where(eq(khExpenseShare.categoryId, category.id));
		await tx.update(khMerchantRule).set({ categoryId: same.id }).where(eq(khMerchantRule.categoryId, category.id));
		await tx.delete(khCategory).where(eq(khCategory.id, category.id));
	}
	const categoryEnd = await nextPosition(tx, khCategory, toId);
	await tx
		.update(khCategory)
		.set({ ownerId: toId, position: sql`${khCategory.position} + ${categoryEnd}` })
		.where(eq(khCategory.ownerId, fromId));

	const tags = await tx.select().from(khTag).where(eq(khTag.ownerId, toId));
	for (const tag of await tx.select().from(khTag).where(eq(khTag.ownerId, fromId))) {
		const same = tags.find((other) => sameName(other.name, tag.name));
		if (!same) continue;
		await tx.execute(sql`
			insert into kh_share_tag (expense_id, person_id, tag_id)
			select expense_id, person_id, ${same.id} from kh_share_tag where tag_id = ${tag.id}
			on conflict do nothing
		`);
		await tx.execute(sql`
			update kh_merchant_rule set tag_ids = array_replace(tag_ids, ${tag.id}::uuid, ${same.id}::uuid)
			where ${tag.id}::uuid = any(tag_ids)
		`);
		await tx.delete(khTag).where(eq(khTag.id, tag.id));
	}
	await tx.update(khTag).set({ ownerId: toId }).where(eq(khTag.ownerId, fromId));

	const methods = await tx.select().from(khMethod).where(eq(khMethod.ownerId, toId));
	for (const method of await tx.select().from(khMethod).where(eq(khMethod.ownerId, fromId))) {
		const same = methods.find((other) => sameName(other.name, method.name));
		if (!same) continue;
		await tx.update(khExpensePayer).set({ methodId: same.id }).where(eq(khExpensePayer.methodId, method.id));
		await tx.update(khMerchantRule).set({ methodId: same.id }).where(eq(khMerchantRule.methodId, method.id));
		await tx.delete(khMethod).where(eq(khMethod.id, method.id));
	}
	const methodEnd = await nextPosition(tx, khMethod, toId);
	await tx
		.update(khMethod)
		.set({ ownerId: toId, position: sql`${khMethod.position} + ${methodEnd}` })
		.where(eq(khMethod.ownerId, fromId));

	const ruleEnd = await nextPosition(tx, khMerchantRule, toId);
	await tx
		.update(khMerchantRule)
		.set({ ownerId: toId, position: sql`${khMerchantRule.position} + ${ruleEnd}` })
		.where(eq(khMerchantRule.ownerId, fromId));
	await tx.update(khReceiptDraft).set({ ownerId: toId }).where(eq(khReceiptDraft.ownerId, fromId));
}

/**
 * Makes a person's categories and payment methods from the defaults, once (`kh_profile.lists_at`,
 * claimed in one UPDATE so two first requests can't both make them), named in `locale`. A
 * category or method of the same key or name they already have (a guest's, claimed) stays.
 */
export async function ensureLists(
	tx: Tx,
	{ userId, personId }: { userId: string; personId: string },
	settings: Pick<KharchaSettings, "categories">,
	locale: Locale,
): Promise<void> {
	const [claimed] = await tx
		.update(khProfile)
		.set({ listsAt: new Date(), updatedAt: sql`${khProfile.updatedAt}` })
		.where(and(eq(khProfile.userId, userId), isNull(khProfile.listsAt)))
		.returning({ userId: khProfile.userId });
	if (!claimed) return;
	await seedLists(tx, personId, settings, locale);
}

/** The default categories and methods for a person, in `locale`; what they already have stays. */
export async function seedLists(
	tx: Tx,
	personId: string,
	settings: Pick<KharchaSettings, "categories">,
	locale: Locale,
): Promise<void> {
	if (settings.categories.length > 0) {
		await tx
			.insert(khCategory)
			.values(
				settings.categories.map((category, position) => ({
					ownerId: personId,
					key: category.key,
					name: category.name[locale],
					icon: category.icon,
					color: category.color,
					position,
				})),
			)
			.onConflictDoNothing();
	}
	await tx
		.insert(khMethod)
		.values(DEFAULT_METHODS.map((method, position) => ({ ownerId: personId, name: method[locale], position })))
		.onConflictDoNothing();
}

/** The caller's category, or NOT_FOUND: a category is nobody else's to use. */
export async function ownCategory(db: Conn, ownerId: string, id: string) {
	const [row] = await db
		.select()
		.from(khCategory)
		.where(and(eq(khCategory.id, id), eq(khCategory.ownerId, ownerId)));
	if (!row) throw notFound("Category");
	return row;
}

export async function ownMethod(db: Conn, ownerId: string, id: string) {
	const [row] = await db
		.select()
		.from(khMethod)
		.where(and(eq(khMethod.id, id), eq(khMethod.ownerId, ownerId)));
	if (!row) throw notFound("Method");
	return row;
}

/** The caller's tags among `ids`, in the order asked; NOT_FOUND if one isn't theirs. */
export async function ownTags(db: Conn, ownerId: string, ids: ReadonlyArray<string>) {
	const unique = [...new Set(ids)];
	if (unique.length === 0) return [];
	const rows = await db
		.select()
		.from(khTag)
		.where(and(inArray(khTag.id, unique), eq(khTag.ownerId, ownerId)));
	if (rows.length !== unique.length) throw notFound("Tag");
	return unique.flatMap((id) => rows.filter((row) => row.id === id));
}

export async function ownRule(db: Conn, ownerId: string, id: string) {
	const [row] = await db
		.select()
		.from(khMerchantRule)
		.where(and(eq(khMerchantRule.id, id), eq(khMerchantRule.ownerId, ownerId)));
	if (!row) throw notFound("Rule");
	return row;
}

export const rulesOf = (db: Conn, ownerId: string) =>
	db.select().from(khMerchantRule).where(eq(khMerchantRule.ownerId, ownerId)).orderBy(asc(khMerchantRule.position));

/** The next position at the end of one of a person's lists. */
export async function nextPosition(
	db: Conn,
	table: typeof khCategory | typeof khMethod | typeof khMerchantRule,
	ownerId: string,
): Promise<number> {
	const [row] = await db
		.select({ max: sql<number | null>`max(${table.position})` })
		.from(table)
		.where(eq(table.ownerId, ownerId));
	return (row?.max ?? -1) + 1;
}

/**
 * The category the caller last gave this merchant (Task 89, "helpers without AI"): their
 * newest expense with the same merchant, in any case, that has one.
 */
export async function lastCategoryFor(db: Conn, personId: string, merchant: string): Promise<string | null> {
	const name = merchant.trim();
	if (!name) return null;
	const [row] = await db
		.select({ id: khExpenseShare.categoryId })
		.from(khExpenseShare)
		.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
		.innerJoin(khCategory, eq(khCategory.id, khExpenseShare.categoryId))
		.where(
			and(
				eq(khExpenseShare.personId, personId),
				sql`lower(${khExpense.merchant}) = lower(${name})`,
				isNull(khExpense.deletedAt),
				isNull(khCategory.archivedAt),
			),
		)
		.orderBy(desc(khExpense.spentOn), desc(khExpense.createdAt))
		.limit(1);
	return row?.id ?? null;
}

/** How many merchants the dialog's completion offers. */
export const MERCHANTS_LIMIT = 200;

/**
 * The merchants in the caller's history (the expenses they are on, outside the trash), the
 * most recently used first, each with how often and the category they last gave it.
 */
export async function merchantsOf(db: Conn, personId: string): Promise<MerchantSuggestion[]> {
	const newest = sql`order by ${khExpense.spentOn} desc, ${khExpense.createdAt} desc`;
	return db
		.select({
			merchant: sql<string>`(array_agg(${khExpense.merchant} ${newest}))[1]`,
			uses: sql<number>`count(*)`.mapWith(Number),
			categoryId: sql<
				string | null
			>`(array_agg(${khExpenseShare.categoryId} ${newest}) filter (where ${khExpenseShare.categoryId} is not null))[1]`,
		})
		.from(khExpenseShare)
		.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
		.where(and(eq(khExpenseShare.personId, personId), ne(khExpense.merchant, ""), isNull(khExpense.deletedAt)))
		.groupBy(sql`lower(${khExpense.merchant})`)
		.orderBy(sql`max(${khExpense.spentOn}) desc`, sql`count(*) desc`)
		.limit(MERCHANTS_LIMIT);
}

/** The caller's categories by id, as an expense shows them. */
export async function chipsOf(db: Conn, ids: ReadonlyArray<string | null>): Promise<Map<string, CategoryChip>> {
	const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
	if (wanted.length === 0) return new Map();
	const rows = await db
		.select({ id: khCategory.id, name: khCategory.name, icon: khCategory.icon, color: khCategory.color })
		.from(khCategory)
		.where(inArray(khCategory.id, wanted));
	return new Map(rows.map((row) => [row.id, row]));
}

/** How many of a person's shares carry each of their categories and tags, and payer rows each method. */
export async function usage(db: Conn, personId: string) {
	const categories = await db
		.select({ id: khExpenseShare.categoryId, count: sql<number>`count(*)`.mapWith(Number) })
		.from(khExpenseShare)
		.where(and(eq(khExpenseShare.personId, personId), sql`${khExpenseShare.categoryId} is not null`))
		.groupBy(khExpenseShare.categoryId);
	const tags = await db
		.select({ id: khShareTag.tagId, count: sql<number>`count(*)`.mapWith(Number) })
		.from(khShareTag)
		.where(eq(khShareTag.personId, personId))
		.groupBy(khShareTag.tagId);
	const methods = await db
		.select({ id: khExpensePayer.methodId, count: sql<number>`count(*)`.mapWith(Number) })
		.from(khExpensePayer)
		.where(and(eq(khExpensePayer.personId, personId), sql`${khExpensePayer.methodId} is not null`))
		.groupBy(khExpensePayer.methodId);
	const map = (rows: Array<{ id: string | null; count: number }>) =>
		new Map(rows.flatMap((row) => (row.id ? [[row.id, row.count] as const] : [])));
	return { categories: map(categories), tags: map(tags), methods: map(methods) };
}
