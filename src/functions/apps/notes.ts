import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	createNoteInputSchema,
	noteIdInputSchema,
	searchNotesInputSchema,
	setNoteFlagsInputSchema,
	updateNoteInputSchema,
} from "@/features/apps/notes/schema";
import type { Note, NoteList, NoteSearchResult, NoteSummary } from "@/features/apps/notes/types";
import type { ImageAsset, UploadTicket } from "@/features/attachments/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requireAppsUser, withAppsServices } from "@/middleware/apps";
import * as notes from "@/server/apps/notes/service";

/**
 * Notes (/apps/notes, decision 0190): any signed-in user, guests included
 * (`requireAppsUser`), each acting on their own notes only; the input validated with
 * the shared schema, then one call into the service. Sharing refuses guests there.
 */

export const listNotes = createServerFn({ method: "GET" })
	.middleware([requireAppsUser, withAppsServices])
	.handler(({ context }): Promise<NoteList> => notes.listNotes(context));

export const searchNotes = createServerFn({ method: "GET" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(searchNotesInputSchema))
	.handler(({ data, context }): Promise<NoteSearchResult> => notes.searchNotes(context, data.q));

export const getNote = createServerFn({ method: "GET" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(noteIdInputSchema))
	.handler(({ data, context }): Promise<Note> => notes.getNote(context, data.id));

export const createNote = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(createNoteInputSchema))
	.handler(({ data, context }): Promise<NoteSummary> => notes.createNote(context, data));

export const updateNote = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(updateNoteInputSchema))
	.handler(({ data, context }): Promise<Note> => notes.updateNote(context, data));

export const setNoteFlags = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(setNoteFlagsInputSchema))
	.handler(({ data, context }): Promise<void> => notes.setNoteFlags(context, data));

export const shareNote = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(noteIdInputSchema))
	.handler(({ data, context }): Promise<{ token: string }> => notes.shareNote(context, data.id));

export const unshareNote = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(noteIdInputSchema))
	.handler(({ data, context }): Promise<void> => notes.unshareNote(context, data.id));

export const deleteNote = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(noteIdInputSchema))
	.handler(({ data, context }): Promise<void> => notes.deleteNote(context, data.id));

/** Whether image uploads are configured (the editor shows a note instead of the picker when not). */
export const getNoteUploadSettings = createServerFn({ method: "GET" })
	.middleware([requireAppsUser, withAppsServices])
	.handler(({ context }): { enabled: boolean } => ({ enabled: context.imageStore !== null }));

export const signNoteImageUpload = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.handler(({ context }): Promise<UploadTicket> => notes.signNoteUpload(context));

export const confirmNoteImageUpload = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(z.strictObject({ publicId: z.string().min(1).max(255) })))
	.handler(({ data, context }): Promise<ImageAsset> => notes.confirmNoteUpload(context, data.publicId));

/** Removes the caller's own image that was never saved with a note. */
export const discardNoteImageUpload = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(noteIdInputSchema))
	.handler(({ data, context }): Promise<void> => notes.discardNoteUpload(context, data.id));
