import type { UploadTransport } from "@/features/attachments/upload";
import {
	confirmKharchaUpload,
	discardKharchaUpload,
	getKharchaUploadSettings,
	signKharchaUpload,
} from "@/functions/kharcha/receipts";

/**
 * Receipts go through Kharcha's own functions (Task 89, as Notes' and Taskline's, 0190):
 * its users, guests included, hold no `attachments:upload`. Same flow: a signed direct
 * upload, verified, pending until an expense or a receipt draft takes it.
 */
export const KHARCHA_UPLOADS: UploadTransport = {
	permission: null,
	settings: { queryKey: ["kharcha", "uploads"], queryFn: () => getKharchaUploadSettings() },
	sign: () => signKharchaUpload(),
	confirm: (_scope, publicId) => confirmKharchaUpload({ data: { publicId } }),
	discard: (id) => discardKharchaUpload({ data: { id } }),
};

/** What a receipt picker accepts: images and PDFs (the `kharcha` upload scope). */
export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif,application/pdf";
