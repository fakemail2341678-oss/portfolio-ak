import "@tanstack/react-start/server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { ImageAsset, UploadTicket } from "@/features/attachments/schema";
import type { ReceiptDraftView } from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { toImageAsset } from "@/server/attachments/images";
import { AttachmentLinkError, removeForEntities, syncEntityAttachments } from "@/server/attachments/repository";
import { confirmUpload, discardUpload, signUpload } from "@/server/attachments/service";
import { notFound } from "@/server/db/crud";
import { attachment, khReceiptDraft } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { type KharchaServices, type Me, resolveMe } from "../access";
import { bumpRevs } from "../rev";
import { assertQuota, getSettings, quotasFor } from "../settings";

/**
 * Receipts (docs/guides/kharcha.md "Receipts", Task 89): images and PDFs on an expense, or
 * on a receipt draft waiting for its details. The attachments flow (decision 0098) through
 * Kharcha's own functions, since its users, guests included, hold no `attachments:upload`
 * (as Notes' and Taskline's, 0190): a signed direct upload, verified, pending until an
 * expense or a draft takes it.
 */

export const RECEIPT_SCOPE = "kharcha";
/** Where receipts are attached (`attachment.entity_type`). */
export const EXPENSE_RECEIPTS = "kh_expense";
export const DRAFT_RECEIPTS = "kh_receipt_draft";
/** Uploads per person per hour (PLAN 14.5 "Rate limits"): `kh_settings.uploadsPerHour`, 60 unless the admin changed it. */
const UPLOAD_WINDOW_SECONDS = 60 * 60;

const uploader = (user: KharchaServices["user"]) => ({ id: user.id, permissions: [] });
const noAlt = { en: "", ne: "" };

export async function signReceiptUpload({ db, user, imageStore }: KharchaServices): Promise<UploadTicket> {
	const { uploadsPerHour } = await getSettings(db);
	await enforceRateLimit(db, `kharcha-upload:${user.id}`, {
		max: uploadsPerHour,
		windowSeconds: UPLOAD_WINDOW_SECONDS,
	});
	return signUpload(imageStore ?? null, RECEIPT_SCOPE, uploader(user));
}

export const confirmReceiptUpload = (
	{ db, user, imageStore }: KharchaServices,
	publicId: string,
): Promise<ImageAsset> => confirmUpload(db, imageStore ?? null, { publicId, scope: RECEIPT_SCOPE }, uploader(user));

/** Throws away the caller's own upload that no expense or draft took. */
export const discardReceiptUpload = ({ db, user, imageStore }: KharchaServices, id: string): Promise<void> =>
	discardUpload(db, imageStore ?? null, id, user.id);

/** The receipts of some expenses or drafts, in order; none without a store (uploads aren't configured). */
export async function receiptsOf(
	db: Db | Tx,
	store: ImageStore | null | undefined,
	entityType: string,
	ids: ReadonlyArray<string>,
): Promise<Map<string, ImageAsset[]>> {
	const result = new Map<string, ImageAsset[]>();
	if (!store || ids.length === 0) return result;
	const rows = await db
		.select()
		.from(attachment)
		.where(
			and(eq(attachment.entityType, entityType), inArray(attachment.entityId, [...ids]), isNull(attachment.deletedAt)),
		)
		.orderBy(attachment.position);
	for (const row of rows) {
		if (!row.entityId) continue;
		result.set(row.entityId, [...(result.get(row.entityId) ?? []), toImageAsset(store, row)]);
	}
	return result;
}

/** How many receipts each expense has, for lists that show a count. */
export async function receiptCounts(db: Db | Tx, ids: ReadonlyArray<string>): Promise<Map<string, number>> {
	if (ids.length === 0) return new Map();
	const rows = await db
		.select({ id: attachment.entityId, count: sql<number>`count(*)`.mapWith(Number) })
		.from(attachment)
		.where(
			and(
				eq(attachment.entityType, EXPENSE_RECEIPTS),
				inArray(attachment.entityId, [...ids]),
				isNull(attachment.deletedAt),
			),
		)
		.groupBy(attachment.entityId);
	return new Map(rows.flatMap((row) => (row.id ? [[row.id, row.count] as const] : [])));
}

/** The attachment ids of one expense or draft, in order. */
export async function receiptIdsOf(db: Db | Tx, entityType: string, entityId: string): Promise<string[]> {
	const rows = await db
		.select({ id: attachment.id })
		.from(attachment)
		.where(and(eq(attachment.entityType, entityType), eq(attachment.entityId, entityId), isNull(attachment.deletedAt)))
		.orderBy(attachment.position);
	return rows.map((row) => row.id);
}

const tooMany = (max: number) =>
	ruleError("BAD_REQUEST", "Kharcha: too many receipts", m.kharcha_error_receipts_max({ max: formatNumber(max) }));

/**
 * Makes `ids` the receipts of an expense or a draft, in order: each must be on it already or
 * the caller's own upload (else BAD_REQUEST). Receipts it no longer lists are marked removed,
 * and the attachments cron deletes their files.
 */
export async function linkReceipts(
	tx: Tx,
	me: Me,
	target: { entityType: string; entityId: string },
	ids: ReadonlyArray<string>,
): Promise<void> {
	const max = quotasFor(await getSettings(tx), me).receipts;
	if (ids.length > max) throw tooMany(max);
	try {
		await syncEntityAttachments(
			tx,
			{ ...target, ownerId: me.id },
			ids.map((id) => ({ id, alt: noAlt })),
		);
	} catch (error) {
		if (error instanceof AttachmentLinkError) {
			throw ruleError("BAD_REQUEST", "Kharcha: receipt refused", m.attachments_error_link());
		}
		throw error;
	}
}

/** The caller's receipt draft, or NOT_FOUND: a draft is nobody else's. */
async function ownDraft(db: Db | Tx, me: Me, id: string) {
	const [row] = await db
		.select()
		.from(khReceiptDraft)
		.where(and(eq(khReceiptDraft.id, id), eq(khReceiptDraft.ownerId, me.personId)));
	if (!row) throw notFound("Receipt");
	return row;
}

/**
 * An expense made from a draft takes its files: they move to the expense as they are, and
 * the draft goes. The expense's own save then orders them with any others.
 */
export async function takeDraft(tx: Tx, me: Me, draftId: string, expenseId: string): Promise<void> {
	const draft = await ownDraft(tx, me, draftId);
	await tx
		.update(attachment)
		.set({ entityType: EXPENSE_RECEIPTS, entityId: expenseId })
		.where(
			and(eq(attachment.entityType, DRAFT_RECEIPTS), eq(attachment.entityId, draft.id), isNull(attachment.deletedAt)),
		);
	await tx.delete(khReceiptDraft).where(eq(khReceiptDraft.id, draft.id));
}

/** The caller's drafts, newest first, with their receipts (Home's to-dos). */
export async function draftsOf(db: Db | Tx, store: ImageStore | null | undefined, me: Me): Promise<ReceiptDraftView[]> {
	const drafts = await db
		.select()
		.from(khReceiptDraft)
		.where(eq(khReceiptDraft.ownerId, me.personId))
		.orderBy(desc(khReceiptDraft.createdAt));
	const receipts = await receiptsOf(
		db,
		store,
		DRAFT_RECEIPTS,
		drafts.map((draft) => draft.id),
	);
	return drafts.map((draft) => ({
		id: draft.id,
		createdAt: draft.createdAt.toISOString(),
		receipts: receipts.get(draft.id) ?? [],
	}));
}

/** "Add a receipt": the caller's uploads kept as a draft, its details added later. */
export async function createDraft(
	services: KharchaServices,
	receiptIds: ReadonlyArray<string>,
): Promise<ReceiptDraftView> {
	const { db, user, imageStore } = services;
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		await assertQuota(tx, `${me.personId}:drafts`, {
			table: khReceiptDraft,
			where: eq(khReceiptDraft.ownerId, me.personId),
			max: quotasFor(await getSettings(tx), user).drafts,
		});
		const [draft] = await tx.insert(khReceiptDraft).values({ ownerId: me.personId }).returning();
		if (!draft) throw notFound("Receipt");
		await linkReceipts(tx, me, { entityType: DRAFT_RECEIPTS, entityId: draft.id }, receiptIds);
		await bumpRevs(tx, [me.personId]);
		const receipts = await receiptsOf(tx, imageStore, DRAFT_RECEIPTS, [draft.id]);
		return { id: draft.id, createdAt: draft.createdAt.toISOString(), receipts: receipts.get(draft.id) ?? [] };
	});
}

/** Throws a draft away, with its files (the attachments cron deletes them). */
export async function deleteDraft({ db, user }: KharchaServices, id: string): Promise<void> {
	await db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const draft = await ownDraft(tx, me, id);
		await removeForEntities(tx, DRAFT_RECEIPTS, [draft.id]);
		await tx.delete(khReceiptDraft).where(eq(khReceiptDraft.id, draft.id));
		await bumpRevs(tx, [me.personId]);
	});
}
