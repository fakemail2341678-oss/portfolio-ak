import { createServerFn } from "@tanstack/react-start";
import {
	attachmentIdSchema,
	confirmUploadSchema,
	type ImageAsset,
	type UploadTicket,
	uploadScopeSchema,
} from "@/features/attachments/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { confirmUpload, discardUpload, signUpload } from "@/server/attachments/service";
import { imageStore } from "@/server/attachments/store";
import { db } from "@/server/db/client";

/**
 * Direct uploads to Cloudinary (see src/server/attachments/service.ts for the
 * flow). Uploading needs attachments:upload; linking an upload to an item happens
 * in that item's own save, under its permissions.
 */

/** The caller as an uploader: library scopes check their own permission too (media:write). */
const uploader = (context: { user: { id: string }; permissions: ReadonlyArray<string> }) => ({
	id: context.user.id,
	permissions: context.permissions,
});

/** Whether uploads are configured (the editor shows a note instead of the picker when not). */
export const getUploadSettings = createServerFn({ method: "GET" })
	.middleware([requirePermission("attachments:upload")])
	.handler((): { enabled: boolean } => ({ enabled: imageStore !== null }));

export const signImageUpload = createServerFn({ method: "POST" })
	.middleware([requirePermission("attachments:upload")])
	.validator(zodInput(uploadScopeSchema))
	.handler(({ data, context }): UploadTicket => signUpload(imageStore, data.scope, uploader(context)));

export const confirmImageUpload = createServerFn({ method: "POST" })
	.middleware([requirePermission("attachments:upload")])
	.validator(zodInput(confirmUploadSchema))
	.handler(({ data, context }): Promise<ImageAsset> => confirmUpload(db, imageStore, data, uploader(context)));

/** Removes one's own upload that was never saved with an item. */
export const discardImageUpload = createServerFn({ method: "POST" })
	.middleware([requirePermission("attachments:upload")])
	.validator(zodInput(attachmentIdSchema))
	.handler(({ data, context }) => discardUpload(db, imageStore, data.id, context.user.id));
