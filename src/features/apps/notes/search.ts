import { z } from "zod";
import { enumParam, searchParam } from "@/lib/list/params";

/** The longest search query (the URL and the server input). */
export const NOTE_QUERY_MAX = 120;

/** /apps/notes: the search box (full text, on the server), the archive and one tag. */
export const notesSearchSchema = z.object({
	q: searchParam(NOTE_QUERY_MAX),
	view: enumParam(["notes", "archive"] as const, "notes"),
	tag: searchParam(32),
});
export type NotesSearch = z.output<typeof notesSearchSchema>;

/** The editor's path: a note id (UUID) or no match at all. */
export const noteParamsSchema = z.object({ noteId: z.uuid() });

/** The shared page's path: a token as shareNote makes them. */
export const sharedNoteParamsSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/) });
