import "@tanstack/react-start/server-only";
import { createHash, randomUUID } from "node:crypto";
import { IMAGE_MAX_BYTES, type UploadScope, uploadRule } from "@/features/attachments/constants";
import type { UploadTicket } from "@/features/attachments/schema";

/**
 * A thin client for the parts of Cloudinary this app uses, over its REST API
 * (docs/decisions.md 0098): signing direct uploads, reading an uploaded asset's
 * real details (Admin API), deleting assets, and building delivery URLs.
 *
 * Signing follows https://cloudinary.com/documentation/authentication_signatures:
 * every signed field except file, cloud_name, resource_type and api_key, sorted,
 * joined as `k=v&…`, the API secret appended, SHA-1 hex. Signatures expire an
 * hour after their timestamp.
 */

export type CloudinaryConfig = {
	cloudName: string;
	apiKey: string;
	apiSecret: string;
	/** public_id prefix for this app ("portfolio"). */
	folder: string;
	apiBase: string;
	deliveryBase: string;
};

/** What Cloudinary reports for a stored image (the server's source of truth). */
export type RemoteImage = {
	publicId: string;
	version: number;
	resourceType: string;
	format: string;
	bytes: number;
	width: number | null;
	height: number | null;
};

export type ImageStore = {
	readonly config: CloudinaryConfig;
	signUpload(scope: UploadScope, now?: Date): UploadTicket;
	getImage(publicId: string): Promise<RemoteImage | null>;
	destroy(publicId: string): Promise<"ok" | "not found">;
	url(image: { publicId: string; version: number }, transformation: string): string;
	/** The original file as uploaded (a PDF to open or download). */
	original(image: { publicId: string; version: number; format: string }): string;
	/** True when a public_id belongs to this app (its folder). */
	owns(publicId: string): boolean;
};

/** Cloudinary's signature for a set of parameters. */
export function signParams(params: Readonly<Record<string, string | number>>, apiSecret: string): string {
	const payload = Object.keys(params)
		.sort()
		.map((key) => `${key}=${params[key]}`)
		.join("&");
	return createHash("sha1")
		.update(payload + apiSecret)
		.digest("hex");
}

const PUBLIC_ID = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)+$/i;

export function createCloudinary(config: CloudinaryConfig, fetcher: typeof fetch = fetch): ImageStore {
	const api = (path: string) => `${config.apiBase.replace(/\/$/, "")}/v1_1/${config.cloudName}/${path}`;
	const basicAuth = `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}`;
	const timestamp = (now: Date) => Math.floor(now.getTime() / 1000);

	return {
		config,

		signUpload(scope, now = new Date()) {
			const publicId = `${config.folder}/${scope}/${randomUUID()}`;
			const { formats } = uploadRule(scope);
			const signed = {
				allowed_formats: formats.join(","),
				overwrite: "false",
				public_id: publicId,
				timestamp: timestamp(now),
			};
			return {
				url: api("image/upload"),
				fields: {
					...Object.fromEntries(Object.entries(signed).map(([key, value]) => [key, String(value)])),
					api_key: config.apiKey,
					signature: signParams(signed, config.apiSecret),
				},
				publicId,
				maxBytes: IMAGE_MAX_BYTES,
				formats,
			};
		},

		async getImage(publicId) {
			if (!PUBLIC_ID.test(publicId)) return null;
			const response = await fetcher(api(`resources/image/upload/${publicId}`), {
				headers: { authorization: basicAuth },
			});
			if (response.status === 404) return null;
			if (!response.ok) throw new Error(`Cloudinary Admin API ${response.status}`);
			const body = (await response.json()) as Record<string, unknown>;
			const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
			return {
				publicId: String(body.public_id),
				version: num(body.version) ?? 0,
				resourceType: String(body.resource_type ?? "image"),
				format: String(body.format ?? "").toLowerCase(),
				bytes: num(body.bytes) ?? 0,
				width: num(body.width),
				height: num(body.height),
			};
		},

		async destroy(publicId) {
			const signed = { invalidate: "true", public_id: publicId, timestamp: timestamp(new Date()) };
			const body = new URLSearchParams({
				...Object.fromEntries(Object.entries(signed).map(([key, value]) => [key, String(value)])),
				api_key: config.apiKey,
				signature: signParams(signed, config.apiSecret),
			});
			const response = await fetcher(api("image/destroy"), { method: "POST", body });
			if (!response.ok) throw new Error(`Cloudinary destroy ${response.status}`);
			const { result } = (await response.json()) as { result?: string };
			if (result === "ok" || result === "not found") return result;
			throw new Error(`Cloudinary destroy: ${result}`);
		},

		url({ publicId, version }, transformation) {
			return `${config.deliveryBase.replace(/\/$/, "")}/${config.cloudName}/image/upload/${transformation}/v${version}/${publicId}`;
		},

		original({ publicId, version, format }) {
			return `${config.deliveryBase.replace(/\/$/, "")}/${config.cloudName}/image/upload/v${version}/${publicId}.${format}`;
		},

		owns(publicId) {
			return PUBLIC_ID.test(publicId) && publicId.startsWith(`${config.folder}/`);
		},
	};
}
