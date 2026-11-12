import { createServerFn } from "@tanstack/react-start";
import type { ImageAsset, UploadTicket } from "@/features/attachments/schema";
import { createDraftInput, receiptIdInput, receiptUploadInput } from "@/features/kharcha/schema";
import type { ReceiptDraftView } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as receipts from "@/server/kharcha/receipts/service";

/**
 * Receipts (docs/guides/kharcha.md "Receipts", Task 89): uploads through Kharcha's own
 * functions (its users, guests included, hold no `attachments:upload`), and receipt drafts.
 */

/** Whether uploads are configured (the dialog shows a note instead of the picker when not). */
export const getKharchaUploadSettings = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): { enabled: boolean } => ({ enabled: context.imageStore !== null }));

export const signKharchaUpload = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<UploadTicket> => receipts.signReceiptUpload(context));

export const confirmKharchaUpload = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(receiptUploadInput))
	.handler(({ data, context }): Promise<ImageAsset> => receipts.confirmReceiptUpload(context, data.publicId));

/** Removes the caller's own upload that no expense or draft took. */
export const discardKharchaUpload = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(receiptIdInput))
	.handler(({ data, context }): Promise<void> => receipts.discardReceiptUpload(context, data.id));

/** "Add a receipt": uploaded now, its details later (Home lists it). */
export const createKharchaDraft = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(createDraftInput))
	.handler(({ data, context }): Promise<ReceiptDraftView> => receipts.createDraft(context, data.receiptIds));

export const deleteKharchaDraft = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(receiptIdInput))
	.handler(({ data, context }): Promise<void> => receipts.deleteDraft(context, data.id));
