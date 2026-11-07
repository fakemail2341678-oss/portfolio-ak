import type { UploadTransport } from "@/features/attachments/upload";
import {
	confirmTasklineUpload,
	discardTasklineUpload,
	getTasklineUploadSettings,
	signTasklineUpload,
} from "@/functions/taskline/collab";

/**
 * Files on tasks and comments go through Taskline's own functions (Task 50, as Notes',
 * decision 0190): its users, guests included, hold no `attachments:upload`. Same flow:
 * a signed direct upload, verified, pending until the task or comment takes it.
 */
export const TASKLINE_UPLOADS: UploadTransport = {
	permission: null,
	settings: { queryKey: ["taskline", "uploads"], queryFn: () => getTasklineUploadSettings() },
	sign: () => signTasklineUpload(),
	confirm: (_scope, publicId) => confirmTasklineUpload({ data: { publicId } }),
	discard: (id) => discardTasklineUpload({ data: { id } }),
};
