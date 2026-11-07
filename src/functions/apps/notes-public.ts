import { createServerFn } from "@tanstack/react-start";
import { sharedNoteInput } from "@/features/apps/notes/schema";
import type { SharedNote } from "@/features/apps/notes/types";
import { zodInput } from "@/functions/_lib/validator";
import { withPublicServices } from "@/middleware/services";
import { getSharedNote as readSharedNote } from "@/server/apps/notes/service";

/**
 * The public page of a shared note (/apps/notes/s/$token, decision 0190): anyone with
 * the link, no session. Only a note whose owner shared it, by its random token; a
 * revoked or unknown token is NOT_FOUND.
 */
export const getSharedNote = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.validator(zodInput(sharedNoteInput))
	.handler(({ data, context }): Promise<SharedNote> => readSharedNote(context, data.token));
