/**
 * Stands in for Cloudinary in e2e (Task 89: a receipt uploaded in the browser): the app's
 * CLOUDINARY_API_BASE and CLOUDINARY_DELIVERY_BASE point here. The browser's signed direct
 * upload (`/cloudinary/v1_1/<cloud>/image/upload`, cross-origin, so answered with CORS),
 * the Admin API's read of an asset and the signed destroy, kept in memory; delivery URLs
 * (`/cloudinary-img/...`) answer with a small placeholder image. Signatures aren't checked:
 * tests/server/attachments.test.ts covers them against the documented examples.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

/** What a test sets the app's CLOUDINARY_* to. */
export const FAKE_CLOUDINARY = {
	cloudName: "e2e",
	apiKey: "123456789012345",
	apiSecret: "e2e-cloudinary-secret",
};

const PLACEHOLDER =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 4"><rect width="3" height="4" fill="#efe6d2"/><path d="M.5 1h2M.5 1.6h1.6M.5 2.2h2" stroke="#8a7a5c" stroke-width=".12"/></svg>';

type Asset = { format: string; bytes: number; version: number };
const assets = new Map<string, Asset>();

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };

const json = (response: ServerResponse, status: number, body: unknown) => {
	response.writeHead(status, { "content-type": "application/json", ...cors });
	response.end(JSON.stringify(body));
};

/** A file's format as Cloudinary reports it: from its type, else its name. */
const formatOf = (file: File) => {
	if (file.type === "application/pdf") return "pdf";
	const fromType = file.type.split("/")[1];
	if (fromType) return fromType === "jpeg" ? "jpg" : fromType;
	return file.name.split(".").pop()?.toLowerCase() ?? "png";
};

/** Answers Cloudinary's requests; false when the request isn't one. */
export async function serveCloudinary(url: URL, request: IncomingMessage, response: ServerResponse): Promise<boolean> {
	const api = `/cloudinary/v1_1/${FAKE_CLOUDINARY.cloudName}/`;
	if (url.pathname.startsWith("/cloudinary-img/")) {
		response.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "no-store", ...cors });
		response.end(PLACEHOLDER);
		return true;
	}
	if (!url.pathname.startsWith(api)) return false;
	if (request.method === "OPTIONS") {
		response.writeHead(204, { ...cors, "access-control-allow-methods": "GET, POST" });
		response.end();
		return true;
	}
	const path = url.pathname.slice(api.length);
	if (request.method === "POST" && path === "image/upload") {
		const form = await new Request("http://cloudinary.local/upload", {
			method: "POST",
			headers: request.headers as Record<string, string>,
			body: Readable.toWeb(request) as ReadableStream,
			duplex: "half",
		} as RequestInit).formData();
		const publicId = String(form.get("public_id") ?? "");
		const file = form.get("file");
		if (!publicId || !(file instanceof File)) {
			json(response, 400, { error: { message: "Missing file" } });
			return true;
		}
		const asset = { format: formatOf(file), bytes: file.size, version: 1_700_000_000 + assets.size };
		assets.set(publicId, asset);
		json(response, 200, { public_id: publicId, resource_type: "image", type: "upload", ...asset });
		return true;
	}
	if (request.method === "GET" && path.startsWith("resources/image/upload/")) {
		const publicId = decodeURIComponent(path.slice("resources/image/upload/".length));
		const asset = assets.get(publicId);
		if (!asset) json(response, 404, { error: { message: "Resource not found" } });
		else
			json(response, 200, {
				public_id: publicId,
				resource_type: "image",
				type: "upload",
				width: 600,
				height: 800,
				...asset,
			});
		return true;
	}
	if (request.method === "POST" && path === "image/destroy") {
		let body = "";
		for await (const chunk of request) body += chunk;
		const publicId = new URLSearchParams(body).get("public_id") ?? "";
		json(response, 200, { result: assets.delete(publicId) ? "ok" : "not found" });
		return true;
	}
	json(response, 404, { error: { message: "Unexpected" } });
	return true;
}
