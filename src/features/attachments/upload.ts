import type { Permission } from "@/features/rbac/permissions";
import { confirmImageUpload, discardImageUpload, getUploadSettings, signImageUpload } from "@/functions/attachments";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { IMAGE_MAX_BYTES, type UploadScope, uploadRule } from "./constants";
import type { ImageAsset, UploadTicket } from "./schema";

/**
 * The server calls of an upload. The admin's (`ADMIN_UPLOADS`) need attachments:upload;
 * an app passes its own, behind its own guard (Notes' images, decision 0190).
 */
export type UploadTransport = {
	/** Who may upload through it, or null for anyone who can open the form. */
	permission: Permission | null;
	/** Query options: whether uploads are configured at all. */
	settings: { queryKey: ReadonlyArray<string>; queryFn: () => Promise<{ enabled: boolean }> };
	sign: (scope: UploadScope) => Promise<UploadTicket>;
	confirm: (scope: UploadScope, publicId: string) => Promise<ImageAsset>;
	/** Deletes an upload that was never saved with an item. */
	discard: (id: string) => Promise<void>;
};

export const ADMIN_UPLOADS: UploadTransport = {
	permission: "attachments:upload",
	settings: { queryKey: ["attachments", "settings"], queryFn: () => getUploadSettings() },
	sign: (scope) => signImageUpload({ data: { scope } }),
	confirm: (scope, publicId) => confirmImageUpload({ data: { scope, publicId } }),
	discard: (id) => discardImageUpload({ data: { id } }),
};

/** A failure the user should see (localized message). */
export class UploadError extends Error {}

/** Checks a picked file before any network request (the server checks again after upload). */
export function checkImageFile(file: File, scope: UploadScope): string | null {
	if (!uploadRule(scope).mimeTypes.includes(file.type)) return m.attachments_error_format();
	if (file.size > IMAGE_MAX_BYTES) {
		return m.attachments_error_too_large({ max: `${formatNumber(IMAGE_MAX_BYTES / 1024 / 1024)} MB` });
	}
	return null;
}

/** POSTs the file with the signed fields straight to Cloudinary, reporting progress (0–1). */
function send(
	url: string,
	fields: Record<string, string>,
	file: File,
	onProgress: (fraction: number) => void,
	signal: AbortSignal,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const body = new FormData();
		for (const [name, value] of Object.entries(fields)) body.append(name, value);
		body.append("file", file);
		const request = new XMLHttpRequest();
		request.open("POST", url);
		request.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress(event.loaded / event.total);
		};
		request.onload = () => {
			if (request.status >= 200 && request.status < 300) resolve();
			else reject(new UploadError(cloudinaryMessage(request.responseText) ?? m.attachments_error_missing()));
		};
		request.onerror = () => reject(new UploadError(m.attachments_error_missing()));
		request.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
		signal.addEventListener("abort", () => request.abort(), { once: true });
		request.send(body);
	});
}

/** Cloudinary's own error text ("Invalid image file") when it rejects a file. */
const cloudinaryMessage = (text: string): string | null => {
	try {
		const parsed = JSON.parse(text) as { error?: { message?: unknown } };
		return typeof parsed.error?.message === "string" && parsed.error.message.includes("format")
			? m.attachments_error_format()
			: null;
	} catch {
		return null;
	}
};

/**
 * Uploads one image: a signature from our server, the file straight to
 * Cloudinary (with progress, cancellable), then our server verifies it and
 * records it as a pending attachment. Resolves with the ready-to-show image.
 */
export async function uploadImage(
	file: File,
	scope: UploadScope,
	{
		onProgress = () => {},
		signal,
		transport = ADMIN_UPLOADS,
	}: { onProgress?: (fraction: number) => void; signal: AbortSignal; transport?: UploadTransport },
): Promise<ImageAsset> {
	const problem = checkImageFile(file, scope);
	if (problem) throw new UploadError(problem);
	const ticket = await transport.sign(scope);
	await send(ticket.url, ticket.fields, file, onProgress, signal);
	return transport.confirm(scope, ticket.publicId);
}
