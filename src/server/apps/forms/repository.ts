import "@tanstack/react-start/server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { Answers, FormField } from "@/features/apps/forms/fields";
import { staleError } from "@/lib/concurrency";
import { ownedBy } from "@/server/apps/ownership";
import { sameVersion } from "@/server/db/concurrency";
import { type FormRow, form, formResponse, user } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * Forms' data access (decision 0195). Every function of the app takes the owner and
 * scopes by it (`ownedBy`); the public page and its submission read by slug, and
 * only a published form of an account.
 */

const responseCounts = (db: Db | Tx) =>
	db
		.select({ formId: formResponse.formId, total: count().as("responses") })
		.from(formResponse)
		.groupBy(formResponse.formId)
		.as("response_counts");

/** The owner's forms, the latest changed first, with their response counts. */
export async function listForms(db: Db, ownerId: string): Promise<Array<FormRow & { responses: number }>> {
	const responses = responseCounts(db);
	const rows = await db
		.select({ form, responses: sql<number>`coalesce(${responses.total}, 0)`.mapWith(Number) })
		.from(form)
		.leftJoin(responses, eq(responses.formId, form.id))
		.where(ownedBy(form, ownerId))
		.orderBy(desc(form.updatedAt), desc(form.id));
	return rows.map((row) => ({ ...row.form, responses: row.responses }));
}

export async function getForm(db: Db | Tx, ownerId: string, id: string): Promise<FormRow | null> {
	const [row] = await db
		.select()
		.from(form)
		.where(and(eq(form.id, id), ownedBy(form, ownerId)));
	return row ?? null;
}

export const countForms = async (tx: Tx, ownerId: string) =>
	(await tx.select({ total: count() }).from(form).where(ownedBy(form, ownerId)))[0]?.total ?? 0;

export const countResponses = async (db: Db | Tx, formId: string) =>
	(await db.select({ total: count() }).from(formResponse).where(eq(formResponse.formId, formId)))[0]?.total ?? 0;

export const slugTaken = async (tx: Tx, slug: string) =>
	(await tx.select({ id: form.id }).from(form).where(eq(form.slug, slug))).length > 0;

export type NewForm = {
	id?: string;
	slug: string;
	title: string;
	description?: string;
	fields?: FormField[];
	status?: "draft" | "published";
	createdAt?: Date;
};

export async function insertForm(tx: Tx, ownerId: string, values: NewForm): Promise<FormRow> {
	const [row] = await tx
		.insert(form)
		.values({ ...values, ownerId, ...(values.status === "published" ? { publishedAt: new Date() } : {}) })
		.returning();
	if (!row) throw new Error("Form insert returned no row");
	return row;
}

/**
 * The builder's save, only while the form still has `version` (its `updatedAt` when
 * the builder loaded it): null when it isn't the owner's (or is gone), a stale
 * CONFLICT when it changed since.
 */
export async function saveForm(
	tx: Tx,
	ownerId: string,
	id: string,
	version: string,
	set: { title: string; description: string; fields: FormField[] },
): Promise<FormRow | null> {
	const [row] = await tx
		.update(form)
		.set(set)
		.where(and(eq(form.id, id), ownedBy(form, ownerId), sameVersion(form.updatedAt, version)))
		.returning();
	if (row) return row;
	if (await getForm(tx, ownerId, id)) throw staleError("Form");
	return null;
}

export async function setStatus(
	tx: Tx,
	ownerId: string,
	id: string,
	status: "draft" | "published",
): Promise<FormRow | null> {
	const [row] = await tx
		.update(form)
		// Keeps the version: publishing isn't an edit of the questions, so an open builder can still save.
		.set({ status, updatedAt: sql`${form.updatedAt}`, ...(status === "published" ? { publishedAt: new Date() } : {}) })
		.where(and(eq(form.id, id), ownedBy(form, ownerId)))
		.returning();
	return row ?? null;
}

export async function deleteForm(tx: Tx, ownerId: string, id: string): Promise<boolean> {
	const rows = await tx
		.delete(form)
		.where(and(eq(form.id, id), ownedBy(form, ownerId)))
		.returning({ id: form.id });
	return rows.length > 0;
}

/** Every answer set of one of the owner's forms, the newest first (for the results and the CSV). */
export async function responses(db: Db, ownerId: string, formId: string, page?: { limit: number; offset: number }) {
	const query = db
		.select({ id: formResponse.id, data: formResponse.data, submittedAt: formResponse.submittedAt })
		.from(formResponse)
		.where(and(eq(formResponse.formId, formId), ownedBy(formResponse, ownerId)))
		.orderBy(desc(formResponse.submittedAt), desc(formResponse.id));
	return page ? query.limit(page.limit).offset(page.offset) : query;
}

/** A published form of an account, by its public slug (a guest's form is never public, 0186). */
export async function findPublished(db: Db | Tx, slug: string): Promise<FormRow | null> {
	const [row] = await db
		.select({ form })
		.from(form)
		.innerJoin(user, eq(user.id, form.ownerId))
		.where(and(eq(form.slug, slug), eq(form.status, "published"), sql`not coalesce(${user.isAnonymous}, false)`));
	return row?.form ?? null;
}

export async function insertResponses(
	tx: Db | Tx,
	ownerId: string,
	formId: string,
	rows: ReadonlyArray<{ data: Answers; ipHash?: string | null; submittedAt?: Date }>,
) {
	if (rows.length === 0) return;
	await tx.insert(formResponse).values(rows.map((row) => ({ ...row, formId, ownerId })));
}

/** Moves every form and response of a guest to an account (decision 0186). */
export async function transferForms(tx: Tx, fromUserId: string, toUserId: string): Promise<void> {
	await tx.update(formResponse).set({ ownerId: toUserId }).where(ownedBy(formResponse, fromUserId));
	await tx.update(form).set({ ownerId: toUserId }).where(ownedBy(form, fromUserId));
}

/** Usage for /admin/apps: how many accounts and guests have a form, and the rows. */
export async function formsUsage(db: Db) {
	const [owners] = await db
		.select({
			accounts:
				sql<number>`count(distinct ${form.ownerId}) filter (where not coalesce(${user.isAnonymous}, false))`.mapWith(
					Number,
				),
			guests: sql<number>`count(distinct ${form.ownerId}) filter (where ${user.isAnonymous})`.mapWith(Number),
			forms: count(),
			published: sql<number>`count(*) filter (where ${form.status} = 'published')`.mapWith(Number),
		})
		.from(form)
		.innerJoin(user, eq(user.id, form.ownerId));
	const [responseRows] = await db.select({ total: count() }).from(formResponse);
	return {
		accounts: owners?.accounts ?? 0,
		guests: owners?.guests ?? 0,
		rows: { forms: owners?.forms ?? 0, published: owners?.published ?? 0, responses: responseRows?.total ?? 0 },
	};
}
