import "@tanstack/react-start/server-only";
import type { CreateNoteInput, SetNoteFlagsInput, UpdateNoteInput } from "@/features/apps/notes/schema";
import { NOTES_QUOTAS, type Note, type NoteList, type NoteSummary, type SharedNote } from "@/features/apps/notes/types";
import type { ImageAsset, UploadTicket } from "@/features/attachments/schema";
import { ruleError } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import type { AppServices } from "@/server/apps/ownership";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { toImageAsset } from "@/server/attachments/images";
import { AttachmentLinkError } from "@/server/attachments/repository";
import { confirmUpload, discardUpload, purge, signUpload } from "@/server/attachments/service";
import { notFound } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import type { NoteRow } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { richTextToText, sanitizeRichText } from "@/server/rich-text/sanitize";
import * as repo from "./repository";

/**
 * Notes' rules (decision 0190): every call acts on the caller's own notes only (the
 * repository scopes by owner), quotas per user, bodies sanitized before they're
 * stored, and only an account (not a guest) can make a note public. Not audited:
 * app data isn't an admin action (0186).
 */

/** What Notes works with: an app's services and the image store (null when Cloudinary isn't configured). */
export type NoteServices = AppServices & { imageStore: ImageStore | null };

/** Where a note's uploads go (src/features/attachments/constants.ts). */
const SCOPE = "notes";

const quotaError = () =>
	ruleError("CONFLICT", "Notes quota reached", m.notes_quota({ max: formatNumber(NOTES_QUOTAS.notes) }));

export async function listNotes({ db, user, imageStore }: NoteServices): Promise<NoteList> {
	return { notes: await repo.listNotes(db, imageStore, user.id), now: new Date().toISOString() };
}

export async function searchNotes({ db, user }: Pick<NoteServices, "db" | "user">, q: string) {
	return { ids: await repo.searchNotes(db, user.id, q) };
}

const toNote = (store: ImageStore | null, row: NoteRow, images: Awaited<ReturnType<typeof repo.noteImages>>): Note => ({
	id: row.id,
	title: row.title,
	body: sanitizeRichText(row.body),
	tags: row.tags,
	pinned: row.pinned,
	archived: row.archived,
	shareToken: row.shareToken,
	images: store ? images.map((image) => ({ id: image.id, alt: image.alt, preview: toImageAsset(store, image) })) : [],
	updatedAt: row.updatedAt.toISOString(),
});

export async function getNote({ db, user, imageStore }: NoteServices, id: string): Promise<Note> {
	const row = await repo.getNote(db, user.id, id);
	if (!row) throw notFound("Note");
	return toNote(imageStore, row, await repo.noteImages(db, imageStore, id));
}

/** A new, empty note (the editor opens on it). */
export async function createNote({ db, user }: NoteServices, input: CreateNoteInput): Promise<NoteSummary> {
	return db.transaction(async (tx) => {
		await lockQuota(tx, `notes:${user.id}`);
		if ((await repo.countNotes(tx, user.id)) >= NOTES_QUOTAS.notes) throw quotaError();
		const [row] = await repo.insertNotes(tx, user.id, [input]);
		if (!row) throw new Error("Note insert returned no row");
		return {
			id: row.id,
			title: row.title,
			excerpt: "",
			tags: [],
			pinned: false,
			archived: false,
			shared: false,
			cover: null,
			updatedAt: row.updatedAt.toISOString(),
		};
	});
}

/** The editor's save: fields and images, against the version it started from. */
export async function updateNote({ db, user, imageStore }: NoteServices, input: UpdateNoteInput): Promise<Note> {
	const body = sanitizeRichText(input.body);
	const { row, removed } = await db
		.transaction(async (tx) => {
			const saved = await repo.updateNote(tx, user.id, input.id, input.updatedAt, {
				title: input.title,
				body,
				bodyText: richTextToText(body),
				tags: input.tags,
			});
			if (!saved) throw notFound("Note");
			return { row: saved, removed: await repo.syncNoteImages(tx, user.id, saved.id, input.images) };
		})
		.catch((error: unknown) => {
			throw error instanceof AttachmentLinkError
				? ruleError("BAD_REQUEST", error.message, m.attachments_error_link())
				: error;
		});
	await purge(db, imageStore, removed);
	return toNote(imageStore, row, await repo.noteImages(db, imageStore, row.id));
}

export async function setNoteFlags({ db, user }: NoteServices, { id, ...flags }: SetNoteFlagsInput): Promise<void> {
	await db.transaction(async (tx) => {
		if (!(await repo.setFlags(tx, user.id, id, flags))) throw notFound("Note");
	});
}

/** A token nobody can guess: 144 random bits, URL-safe. */
const newShareToken = () => Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url");

/** Makes the note readable by anyone with the link (accounts only, 0186); returns the token. */
export async function shareNote({ db, user }: NoteServices, id: string): Promise<{ token: string }> {
	if (user.isGuest) throw ruleError("FORBIDDEN", "Guests can't share notes", m.notes_share_guest());
	return db.transaction(async (tx) => {
		const current = await repo.getNote(tx, user.id, id);
		if (!current) throw notFound("Note");
		if (current.shareToken) return { token: current.shareToken };
		const row = await repo.setShareToken(tx, user.id, id, newShareToken());
		if (!row?.shareToken) throw notFound("Note");
		return { token: row.shareToken };
	});
}

/** Stops sharing: the old link is a 404 from now on, and sharing again makes a new one. */
export async function unshareNote({ db, user }: NoteServices, id: string): Promise<void> {
	await db.transaction(async (tx) => {
		if (!(await repo.setShareToken(tx, user.id, id, null))) throw notFound("Note");
	});
}

export async function deleteNote({ db, user, imageStore }: NoteServices, id: string): Promise<void> {
	const removed = await db.transaction(async (tx) => {
		const images = await repo.deleteNote(tx, user.id, id);
		if (!images) throw notFound("Note");
		return images;
	});
	await purge(db, imageStore, removed);
}

/** The public page of a shared note; anything else (never shared, revoked, a guest's) is a 404. */
export async function getSharedNote(
	{ db, imageStore }: { db: Db; imageStore: ImageStore | null },
	token: string,
): Promise<SharedNote> {
	const row = await repo.getSharedNote(db, token);
	if (!row) throw notFound("Note");
	const images = await repo.noteImages(db, imageStore, row.id);
	return {
		title: row.title,
		body: sanitizeRichText(row.body),
		images: imageStore ? images.map((image): ImageAsset => toImageAsset(imageStore, image)) : [],
		updatedAt: row.updatedAt.toISOString(),
	};
}

// ---------------------------------------------------------------------------
// Images: the attachments flow (decision 0098) for app users, who hold no permission
// ---------------------------------------------------------------------------

const uploader = (user: NoteServices["user"]) => ({ id: user.id, permissions: [] });

export async function signNoteUpload({ db, user, imageStore }: NoteServices): Promise<UploadTicket> {
	await enforceRateLimit(db, `notes-upload:${user.id}`, { max: NOTES_QUOTAS.uploadsPerHour, windowSeconds: 3600 });
	return signUpload(imageStore, SCOPE, uploader(user));
}

export const confirmNoteUpload = ({ db, user, imageStore }: NoteServices, publicId: string) =>
	confirmUpload(db, imageStore, { publicId, scope: SCOPE }, uploader(user));

export const discardNoteUpload = ({ db, user, imageStore }: NoteServices, id: string) =>
	discardUpload(db, imageStore, id, user.id);

// ---------------------------------------------------------------------------
// Guests and /admin/apps
// ---------------------------------------------------------------------------

/** A new guest's sample notes (decision 0186), in the language they started in. */
export async function seedNotes(tx: Tx, userId: string, locale: Locale): Promise<void> {
	const t = { locale };
	const notes = [
		{
			title: m.notes_seed_welcome({}, t),
			body: `<p>${m.notes_seed_welcome_body({}, t)}</p><ul><li><p>${m.notes_seed_welcome_format({}, t)}</p></li><li><p>${m.notes_seed_welcome_tags({}, t)}</p></li></ul>`,
			tags: [m.notes_seed_tag_start({}, t)],
			pinned: true,
		},
		{
			title: m.notes_seed_search({}, t),
			body: `<p>${m.notes_seed_search_body({}, t)}</p><p><code>"${m.notes_seed_search_phrase({}, t)}"</code></p>`,
			tags: [m.notes_seed_tag_start({}, t)],
		},
		{
			title: m.notes_seed_ideas({}, t),
			body: `<h2>${m.notes_seed_ideas_heading({}, t)}</h2><ol><li><p>${m.notes_seed_ideas_one({}, t)}</p></li><li><p>${m.notes_seed_ideas_two({}, t)}</p></li></ol>`,
			tags: [m.notes_seed_tag_ideas({}, t)],
		},
	];
	await repo.insertNotes(
		tx,
		userId,
		notes.map((each) => {
			const body = sanitizeRichText(each.body);
			return { ...each, body, bodyText: richTextToText(body) };
		}),
	);
}

export const claimNotes = (tx: Tx, fromUserId: string, toUserId: string) =>
	repo.transferNotes(tx, fromUserId, toUserId);

export const notesUsage = repo.notesUsage;
