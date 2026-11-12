import { fn } from "storybook/test";
import type { ImageAsset, UploadTicket } from "../../../../src/features/attachments/schema";
import type { ReceiptDraftView } from "../../../../src/features/kharcha/types";
import { sampleKharchaDraft } from "../../kharcha";

// Stand-ins for src/functions/kharcha/receipts.ts: stories never upload.
export const getKharchaUploadSettings = fn(async (): Promise<{ enabled: boolean }> => ({ enabled: true })).mockName(
	"getKharchaUploadSettings",
);
export const signKharchaUpload = fn(async (): Promise<UploadTicket> => {
	throw new Error("Stories don't upload");
}).mockName("signKharchaUpload");
export const confirmKharchaUpload = fn(async (): Promise<ImageAsset> => {
	throw new Error("Stories don't upload");
}).mockName("confirmKharchaUpload");
export const discardKharchaUpload = fn(async (): Promise<void> => undefined).mockName("discardKharchaUpload");
export const createKharchaDraft = fn(async (): Promise<ReceiptDraftView> => sampleKharchaDraft).mockName(
	"createKharchaDraft",
);
export const deleteKharchaDraft = fn(async (): Promise<void> => undefined).mockName("deleteKharchaDraft");
