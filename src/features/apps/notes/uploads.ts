import type { UploadTransport } from "@/features/attachments/upload";
import {
	confirmNoteImageUpload,
	discardNoteImageUpload,
	getNoteUploadSettings,
	signNoteImageUpload,
} from "@/functions/apps/notes";

/**
 * A note's images go through Notes' own functions (decision 0190): app users, guests
 * included, hold no attachments:upload, so the admin's upload calls would refuse them.
 * Same flow (signed direct upload, verified, pending until the note's save links it).
 */
export const NOTE_UPLOADS: UploadTransport = {
	permission: null,
	settings: { queryKey: ["apps", "notes", "uploads"], queryFn: () => getNoteUploadSettings() },
	sign: () => signNoteImageUpload(),
	confirm: (_scope, publicId) => confirmNoteImageUpload({ data: { publicId } }),
	discard: (id) => discardNoteImageUpload({ data: { id } }),
};
