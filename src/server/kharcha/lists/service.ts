import "@tanstack/react-start/server-only";
import { and, asc, eq } from "drizzle-orm";
import type {
	CreateCategoryInput,
	CreateRuleInput,
	UpdateCategoryInput,
	UpdateMethodInput,
	UpdateRuleInput,
} from "@/features/kharcha/schema";
import type { KharchaLists, MerchantSuggestion } from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { uniqueViolation } from "@/server/db/crud";
import { khCategory, khMerchantRule, khMethod, khTag } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import { type KharchaServices, type Me, resolveMe } from "../access";
import { bumpRevs } from "../rev";
import { assertQuota, getSettings, quotasFor } from "../settings";
import * as repo from "./repository";

/**
 * The caller's own lists (docs/guides/kharcha.md "Lists", Task 89): categories, tags,
 * payment methods and merchant rules, private to them. Their categories and methods are
 * made from the defaults on first use. Each change answers with the lists as they are now,
 * so Settings and the expense dialog redraw from one reply.
 */

const nameTaken = (error: unknown) =>
	uniqueViolation(error, {
		kh_category_name_unique: { field: "name", message: () => m.kharcha_error_name_taken() },
		kh_tag_name_unique: { field: "name", message: () => m.kharcha_error_name_taken() },
		kh_method_name_unique: { field: "name", message: () => m.kharcha_error_name_taken() },
	});

/** Runs a change to the caller's lists in one transaction (their lists made first) and answers with them. */
async function change(services: KharchaServices, work: (tx: Tx, me: Me) => Promise<void>): Promise<KharchaLists> {
	try {
		return await services.db.transaction(async (tx) => {
			const me = await resolveMe(tx, services.user);
			await repo.ensureLists(
				tx,
				{ userId: services.user.id, personId: me.personId },
				await getSettings(tx),
				getLocale(),
			);
			await work(tx, me);
			await bumpRevs(tx, [me.personId]);
			return listsOf(tx, me.personId);
		});
	} catch (error) {
		throw nameTaken(error);
	}
}

async function listsOf(tx: Tx, personId: string): Promise<KharchaLists> {
	const used = await repo.usage(tx, personId);
	const categories = await tx
		.select()
		.from(khCategory)
		.where(eq(khCategory.ownerId, personId))
		.orderBy(asc(khCategory.position), asc(khCategory.createdAt));
	const tags = await tx.select().from(khTag).where(eq(khTag.ownerId, personId)).orderBy(asc(khTag.name));
	const methods = await tx
		.select()
		.from(khMethod)
		.where(eq(khMethod.ownerId, personId))
		.orderBy(asc(khMethod.position), asc(khMethod.createdAt));
	const rules = await repo.rulesOf(tx, personId);
	const tagIds = new Set(tags.map((tag) => tag.id));
	return {
		categories: categories.map((row) => ({
			id: row.id,
			key: row.key,
			name: row.name,
			icon: row.icon,
			color: row.color,
			position: row.position,
			archived: row.archivedAt !== null,
			used: used.categories.get(row.id) ?? 0,
		})),
		tags: tags.map((row) => ({ id: row.id, name: row.name, used: used.tags.get(row.id) ?? 0 })),
		methods: methods.map((row) => ({
			id: row.id,
			name: row.name,
			position: row.position,
			archived: row.archivedAt !== null,
			used: used.methods.get(row.id) ?? 0,
		})),
		rules: rules.map((row) => ({
			id: row.id,
			match: row.match,
			pattern: row.pattern,
			categoryId: row.categoryId,
			// A tag deleted since the rule was made is skipped (the column has no foreign key).
			tagIds: row.tagIds.filter((id) => tagIds.has(id)),
			methodId: row.methodId,
			position: row.position,
		})),
	};
}

/** The caller's lists, made from the defaults on their first visit. */
export const getLists = (services: KharchaServices): Promise<KharchaLists> => change(services, async () => {});

/** The merchants of the caller's history for the expense dialog's completion. */
export async function getMerchants({ db, user }: KharchaServices): Promise<MerchantSuggestion[]> {
	const me = await resolveMe(db, user);
	return repo.merchantsOf(db, me.personId);
}

const quota = async (tx: Tx, me: Me, kind: "categories" | "tags" | "methods" | "rules") => {
	const table = { categories: khCategory, tags: khTag, methods: khMethod, rules: khMerchantRule }[kind];
	await assertQuota(tx, `${me.personId}:${kind}`, {
		table,
		where: eq(table.ownerId, me.personId),
		max: quotasFor(await getSettings(tx), me)[kind],
	});
};

/**
 * A new order for one of the caller's lists: `ids` must be all of it, each once.
 * Anything else (another's id, one left out) is refused: the page reloads its list.
 */
async function reorder(
	tx: Tx,
	table: typeof khCategory | typeof khMethod | typeof khMerchantRule,
	ownerId: string,
	ids: ReadonlyArray<string>,
): Promise<void> {
	const rows = await tx.select({ id: table.id }).from(table).where(eq(table.ownerId, ownerId));
	const mine = new Set(rows.map((row) => row.id));
	if (new Set(ids).size !== ids.length || ids.length !== mine.size || !ids.every((id) => mine.has(id))) {
		throw ruleError("CONFLICT", "Kharcha: stale order", m.kharcha_error_stale_order());
	}
	for (const [position, id] of ids.entries()) {
		await tx
			.update(table)
			.set({ position })
			.where(and(eq(table.id, id), eq(table.ownerId, ownerId)));
	}
}

// Categories.

export const createCategory = (services: KharchaServices, input: CreateCategoryInput) =>
	change(services, async (tx, me) => {
		await quota(tx, me, "categories");
		await tx.insert(khCategory).values({
			...(input.id ? { id: input.id } : {}),
			ownerId: me.personId,
			name: input.name,
			icon: input.icon,
			color: input.color,
			position: await repo.nextPosition(tx, khCategory, me.personId),
		});
	});

export const updateCategory = (services: KharchaServices, input: UpdateCategoryInput) =>
	change(services, async (tx, me) => {
		const row = await repo.ownCategory(tx, me.personId, input.id);
		await tx
			.update(khCategory)
			.set({
				name: input.name,
				icon: input.icon,
				color: input.color,
				archivedAt: input.archived ? (row.archivedAt ?? new Date()) : null,
			})
			.where(eq(khCategory.id, row.id));
	});

/** Deleting a category leaves its expenses uncategorized and its rules without one (`set null`). */
export const deleteCategory = (services: KharchaServices, id: string) =>
	change(services, async (tx, me) => {
		const row = await repo.ownCategory(tx, me.personId, id);
		await tx.delete(khCategory).where(eq(khCategory.id, row.id));
	});

export const reorderCategories = (services: KharchaServices, ids: ReadonlyArray<string>) =>
	change(services, (tx, me) => reorder(tx, khCategory, me.personId, ids));

// Tags.

export const createTag = (services: KharchaServices, name: string) =>
	change(services, async (tx, me) => {
		await quota(tx, me, "tags");
		await tx.insert(khTag).values({ ownerId: me.personId, name });
	});

export const updateTag = (services: KharchaServices, input: { id: string; name: string }) =>
	change(services, async (tx, me) => {
		const [row] = await repo.ownTags(tx, me.personId, [input.id]);
		if (row) await tx.update(khTag).set({ name: input.name }).where(eq(khTag.id, row.id));
	});

/** Deleting a tag takes it off every share (`cascade`) and out of the rules (when they are read). */
export const deleteTag = (services: KharchaServices, id: string) =>
	change(services, async (tx, me) => {
		const [row] = await repo.ownTags(tx, me.personId, [id]);
		if (row) await tx.delete(khTag).where(eq(khTag.id, row.id));
	});

// Payment methods.

export const createMethod = (services: KharchaServices, name: string) =>
	change(services, async (tx, me) => {
		await quota(tx, me, "methods");
		await tx
			.insert(khMethod)
			.values({ ownerId: me.personId, name, position: await repo.nextPosition(tx, khMethod, me.personId) });
	});

export const updateMethod = (services: KharchaServices, input: UpdateMethodInput) =>
	change(services, async (tx, me) => {
		const row = await repo.ownMethod(tx, me.personId, input.id);
		await tx
			.update(khMethod)
			.set({ name: input.name, archivedAt: input.archived ? (row.archivedAt ?? new Date()) : null })
			.where(eq(khMethod.id, row.id));
	});

export const deleteMethod = (services: KharchaServices, id: string) =>
	change(services, async (tx, me) => {
		const row = await repo.ownMethod(tx, me.personId, id);
		await tx.delete(khMethod).where(eq(khMethod.id, row.id));
	});

export const reorderMethods = (services: KharchaServices, ids: ReadonlyArray<string>) =>
	change(services, (tx, me) => reorder(tx, khMethod, me.personId, ids));

// Merchant rules.

/** A rule names only the caller's own category, tags and method. */
async function ruleValues(tx: Tx, me: Me, input: CreateRuleInput) {
	if (input.categoryId) await repo.ownCategory(tx, me.personId, input.categoryId);
	if (input.methodId) await repo.ownMethod(tx, me.personId, input.methodId);
	const tags = await repo.ownTags(tx, me.personId, input.tagIds);
	if (!input.categoryId && !input.methodId && tags.length === 0) {
		throw ruleError("BAD_REQUEST", "Kharcha rule: nothing to set", m.kharcha_error_rule_empty());
	}
	return {
		match: input.match,
		pattern: input.pattern,
		categoryId: input.categoryId,
		methodId: input.methodId,
		tagIds: tags.map((tag) => tag.id),
	};
}

export const createRule = (services: KharchaServices, input: CreateRuleInput) =>
	change(services, async (tx, me) => {
		await quota(tx, me, "rules");
		await tx.insert(khMerchantRule).values({
			ownerId: me.personId,
			...(await ruleValues(tx, me, input)),
			position: await repo.nextPosition(tx, khMerchantRule, me.personId),
		});
	});

export const updateRule = (services: KharchaServices, input: UpdateRuleInput) =>
	change(services, async (tx, me) => {
		const row = await repo.ownRule(tx, me.personId, input.id);
		await tx
			.update(khMerchantRule)
			.set(await ruleValues(tx, me, input))
			.where(eq(khMerchantRule.id, row.id));
	});

export const deleteRule = (services: KharchaServices, id: string) =>
	change(services, async (tx, me) => {
		const row = await repo.ownRule(tx, me.personId, id);
		await tx.delete(khMerchantRule).where(eq(khMerchantRule.id, row.id));
	});

export const reorderRules = (services: KharchaServices, ids: ReadonlyArray<string>) =>
	change(services, (tx, me) => reorder(tx, khMerchantRule, me.personId, ids));
