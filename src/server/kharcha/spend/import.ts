import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Split } from "@/features/kharcha/money/split";
import { IMPORT_ROWS_MAX, type ImportInput } from "@/features/kharcha/schema";
import { type ImportResult, KHARCHA_COLORS } from "@/features/kharcha/types";
import { AppError } from "@/lib/errors";
import { getLocale } from "@/paraglide/runtime";
import {
	khActivity,
	khCategory,
	khExpense,
	khExpensePayer,
	khExpenseShare,
	khImport,
	khMethod,
	khShareTag,
	khTag,
} from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { type KharchaServices, type Me, resolveMe } from "../access";
import * as lists from "../lists/repository";
import { bumpRevs } from "../rev";
import { assertCurrencyOffered } from "../rules";
import { assertQuota, getSettings, quotasFor } from "../settings";

/**
 * A CSV import into Spend (Task 93, decision 0287; Expenses' pipeline, 0192, moved and
 * extended): up to 1,000 personal expenses, once per idempotency key. The key is claimed in
 * the rows' transaction, so a repeat (a double click, a retry after a lost answer) waits
 * for the first and gets its result; the same key with other rows, or another's key, is a
 * CONFLICT. Categories, tags and methods are matched by name in any case and made when
 * missing. The rows go in in batches: an import is personal, so it has no ledger rows and
 * tells nobody; its history is one "added" line per expense, as the dialog writes.
 */

/** Imports one person may run in an hour (a repeat of a finished one isn't counted). */
export const IMPORTS_PER_HOUR = 10;
/** Rows per insert: well under Postgres' parameter limit. */
const BATCH = 250;

const batches = <T>(rows: ReadonlyArray<T>): T[][] => {
	const out: T[][] = [];
	for (let at = 0; at < rows.length; at += BATCH) out.push(rows.slice(at, at + BATCH));
	return out;
};

const fingerprintOf = (input: ImportInput) => createHash("sha256").update(JSON.stringify(input.rows)).digest("hex");

const replay = (result: Omit<ImportResult, "replayed">): ImportResult => ({ ...result, replayed: true });

/** Each name once, spelled as it first appears, that isn't among `have` (lower-cased). */
function missingNames(names: Iterable<string>, have: ReadonlySet<string>): string[] {
	const missing = new Map<string, string>();
	for (const name of names) {
		const key = name.toLocaleLowerCase();
		if (name !== "" && !have.has(key) && !missing.has(key)) missing.set(key, name);
	}
	return [...missing.values()];
}

/** The caller's names → ids for one list, making the missing ones (within the list's quota). */
async function ensureNamed(
	tx: Tx,
	me: Me,
	kind: "categories" | "tags" | "methods",
	names: Iterable<string>,
	max: number,
): Promise<{ ids: Map<string, string>; made: number }> {
	const table = kind === "categories" ? khCategory : kind === "tags" ? khTag : khMethod;
	const rows = await tx.select({ id: table.id, name: table.name }).from(table).where(eq(table.ownerId, me.personId));
	const ids = new Map(rows.map((row) => [row.name.toLocaleLowerCase(), row.id]));
	const missing = missingNames(names, new Set(ids.keys()));
	if (missing.length === 0) return { ids, made: 0 };
	await assertQuota(tx, `${me.personId}:${kind}`, {
		table,
		where: eq(table.ownerId, me.personId),
		max,
		adding: missing.length,
	});
	// After the caller's own, in the file's order.
	const start =
		kind === "tags" ? 0 : await lists.nextPosition(tx, kind === "methods" ? khMethod : khCategory, me.personId);
	const made =
		kind === "tags"
			? await tx
					.insert(khTag)
					.values(missing.map((name) => ({ ownerId: me.personId, name })))
					.returning({ id: khTag.id, name: khTag.name })
			: kind === "methods"
				? await tx
						.insert(khMethod)
						.values(missing.map((name, index) => ({ ownerId: me.personId, name, position: start + index })))
						.returning({ id: khMethod.id, name: khMethod.name })
				: await tx
						.insert(khCategory)
						.values(
							missing.map((name, index) => ({
								ownerId: me.personId,
								name,
								// Made by an import: the palette's colours in turn, and a receipt for an icon.
								color: KHARCHA_COLORS[(index % (KHARCHA_COLORS.length - 1)) + 1] ?? "gray",
								icon: "receipt" as const,
								position: start + index,
							})),
						)
						.returning({ id: khCategory.id, name: khCategory.name });
	for (const row of made) ids.set(row.name.toLocaleLowerCase(), row.id);
	return { ids, made: made.length };
}

export async function importSpend({ db, user }: KharchaServices, input: ImportInput): Promise<ImportResult> {
	const fingerprint = fingerprintOf(input);
	const me = await resolveMe(db, user);
	// A retry of an import that went through gets its result back before the rate limit counts it.
	const [done] = await db.select().from(khImport).where(eq(khImport.key, input.key));
	if (done?.result && done.ownerId === me.personId && done.fingerprint === fingerprint) return replay(done.result);
	await enforceRateLimit(db, `kharcha-import:${me.personId}`, { max: IMPORTS_PER_HOUR, windowSeconds: 3600 });
	return db.transaction(async (tx) => {
		const claimed = await tx
			.insert(khImport)
			.values({ key: input.key, ownerId: me.personId, fingerprint })
			.onConflictDoNothing()
			.returning({ key: khImport.key });
		if (claimed.length === 0) {
			const [earlier] = await tx.select().from(khImport).where(eq(khImport.key, input.key));
			if (earlier?.ownerId !== me.personId || earlier.fingerprint !== fingerprint || !earlier.result) {
				throw new AppError("CONFLICT", "Kharcha: idempotency key reused for a different import");
			}
			return replay(earlier.result);
		}
		const rows = input.rows.slice(0, IMPORT_ROWS_MAX);
		const settings = await getSettings(tx);
		for (const currency of new Set(rows.map((row) => row.currency))) assertCurrencyOffered(settings, currency);
		const quotas = quotasFor(settings, user);
		// The defaults first, as every list change makes them: a file's "Cash" is the caller's Cash.
		await lists.ensureLists(tx, { userId: user.id, personId: me.personId }, settings, getLocale());
		await assertQuota(tx, `${me.personId}:expenses`, {
			table: khExpense,
			where: eq(khExpense.createdBy, me.personId),
			max: quotas.expenses,
			adding: rows.length,
		});
		const categories = await ensureNamed(
			tx,
			me,
			"categories",
			rows.map((row) => row.category),
			quotas.categories,
		);
		const tags = await ensureNamed(
			tx,
			me,
			"tags",
			rows.flatMap((row) => row.tags),
			quotas.tags,
		);
		const methods = await ensureNamed(
			tx,
			me,
			"methods",
			rows.map((row) => row.method),
			quotas.methods,
		);
		const idOf = (ids: Map<string, string>, name: string) =>
			name === "" ? null : (ids.get(name.toLocaleLowerCase()) ?? null);
		const split: Split = { method: "full", person: me.personId };
		const made: Array<{ id: string; title: string }> = [];
		for (const batch of batches(rows)) {
			const inserted = await tx
				.insert(khExpense)
				.values(
					batch.map((row) => ({
						createdBy: me.personId,
						kind: row.kind,
						title: row.title,
						merchant: row.merchant,
						notes: row.notes,
						amountMinor: row.amountMinor,
						currency: row.currency,
						spentOn: row.spentOn,
						split,
						importKey: input.key,
					})),
				)
				.returning({ id: khExpense.id, title: khExpense.title, merchant: khExpense.merchant });
			await tx.insert(khExpensePayer).values(
				inserted.map((expense, index) => ({
					expenseId: expense.id,
					personId: me.personId,
					amountMinor: batch[index]?.amountMinor ?? 0,
					position: 0,
					methodId: idOf(methods.ids, batch[index]?.method ?? ""),
				})),
			);
			await tx.insert(khExpenseShare).values(
				inserted.map((expense, index) => ({
					expenseId: expense.id,
					personId: me.personId,
					owedMinor: batch[index]?.amountMinor ?? 0,
					position: 0,
					categoryId: idOf(categories.ids, batch[index]?.category ?? ""),
				})),
			);
			const tagRows = inserted.flatMap((expense, index) =>
				[...new Set((batch[index]?.tags ?? []).flatMap((name) => idOf(tags.ids, name) ?? []))].map((tagId) => ({
					expenseId: expense.id,
					personId: me.personId,
					tagId,
				})),
			);
			if (tagRows.length > 0) await tx.insert(khShareTag).values(tagRows);
			made.push(...inserted.map((expense) => ({ id: expense.id, title: expense.title || expense.merchant })));
		}
		// The history the dialog would write (`addExpense`): a personal expense's scope is neither a group nor a pair.
		for (const batch of batches(made)) {
			await tx.insert(khActivity).values(
				batch.map((expense) => ({
					groupId: null,
					personLo: null,
					personHi: null,
					expenseId: expense.id,
					actorId: me.personId,
					kind: "expense.created" as const,
					data: { title: expense.title },
				})),
			);
		}
		await bumpRevs(tx, [me.personId]);
		const result = {
			inserted: made.length,
			categories: categories.made,
			tags: tags.made,
			methods: methods.made,
		};
		await tx.update(khImport).set({ result }).where(eq(khImport.key, input.key));
		return { ...result, replayed: false };
	});
}
