import { fn } from "storybook/test";
import type { ImageAsset, UploadTicket } from "../../../src/features/attachments/schema";
import { sampleImageAsset } from "../data";

// Stand-ins for src/functions/attachments.ts (uploads never leave Storybook).
export const getUploadSettings = fn(async () => ({ enabled: true })).mockName("getUploadSettings");
export const signImageUpload = fn(
	async (): Promise<UploadTicket> => ({
		url: "/__storybook-upload",
		fields: {},
		publicId: "portfolio/test-crud/story",
		maxBytes: 10 * 1024 * 1024,
		formats: ["jpg", "png", "webp"],
	}),
).mockName("signImageUpload");
export const confirmImageUpload = fn(
	async (): Promise<ImageAsset> => ({ ...sampleImageAsset, id: crypto.randomUUID(), alt: "" }),
).mockName("confirmImageUpload");
export const discardImageUpload = fn(async (_options: { data: { id: string } }) => {}).mockName("discardImageUpload");
