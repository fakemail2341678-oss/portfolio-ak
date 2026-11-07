import { z } from "zod";
import { ALT_MAX, attachmentRefSchema, type ImageAsset } from "@/features/attachments/schema";
import { versionSchema } from "@/lib/concurrency";
import { localizedText, required, richText, tags } from "@/lib/validation";
import { NOTE_QUERY_MAX } from "./search";
import { NOTES_QUOTAS } from "./types";

/**
 * Notes' inputs (decision 0190), checked on the server and by the editor. Ids come
 * from the browser (`crypto.randomUUID()`), so an optimistic row in the list and the
 * saved one share their key.
 */
const id = z.uuid();

export const NOTE_TITLE_MAX = 200;
/** Visible characters of the body (rich text). */
export const NOTE_BODY_MAX = 20_000;
export const NOTE_TAGS_MAX = 10;
export const NOTE_TAG_LENGTH = 32;

export const noteTitle = () => required({ max: NOTE_TITLE_MAX });

export const noteIdInput = z.strictObject({ id });
export const createNoteInput = z.strictObject({ id, title: noteTitle() });

/** The editor's save: every editable field, against the version it started from. */
export const updateNoteInput = z.strictObject({
	id,
	updatedAt: versionSchema(),
	title: noteTitle(),
	/** Rich-text HTML; the server sanitizes it before storing. */
	body: richText({ required: false, max: NOTE_BODY_MAX }),
	tags: tags({ max: NOTE_TAGS_MAX, maxLength: NOTE_TAG_LENGTH }),
	images: z.array(attachmentRefSchema).max(NOTES_QUOTAS.imagesPerNote),
});

/** The list's quick changes (pin, archive): no version, they touch one flag. */
export const setNoteFlagsInput = z.strictObject({
	id,
	pinned: z.boolean().optional(),
	archived: z.boolean().optional(),
});

export const searchNotesInput = z.strictObject({ q: z.string().trim().min(1).max(NOTE_QUERY_MAX) });
export const sharedNoteInput = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/) });

export type CreateNoteInput = z.infer<typeof createNoteInput>;
export type UpdateNoteInput = z.infer<typeof updateNoteInput>;
export type SetNoteFlagsInput = z.infer<typeof setNoteFlagsInput>;

/** The editor's form: the save's fields, with image previews (not sent). */
export const noteFormSchema = updateNoteInput.omit({ id: true, updatedAt: true }).extend({
	images: z
		.array(z.object({ id, alt: localizedText({ max: ALT_MAX, optional: true }), preview: z.custom<ImageAsset>() }))
		.max(NOTES_QUOTAS.imagesPerNote),
});
export type NoteFormValues = z.input<typeof noteFormSchema>;
