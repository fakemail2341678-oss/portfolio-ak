import { type CloudinaryConfig, createCloudinary, signParams } from "@/server/attachments/cloudinary";

/**
 * The real Cloudinary client over a fake `fetch` that behaves like Cloudinary's
 * REST API (Admin API resource details with Basic auth, signed destroy), with
 * the assets kept in memory. `put` stands in for the browser's direct upload.
 */
export type FakeAsset = { format: string; bytes: number; width: number; height: number; version: number };

export function createFakeCloudinary(overrides: Partial<CloudinaryConfig> = {}) {
	const config: CloudinaryConfig = {
		cloudName: "demo",
		apiKey: "123456789012345",
		apiSecret: "test-secret-abcdef",
		folder: "portfolio",
		apiBase: "https://api.cloudinary.test",
		deliveryBase: "https://res.cloudinary.test",
		...overrides,
	};
	const assets = new Map<string, FakeAsset>();
	const destroyed: string[] = [];
	const calls: string[] = [];
	let failDestroy = false;

	const fetcher: typeof fetch = async (input, init) => {
		const url = new URL(String(input));
		calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
		const prefix = `/v1_1/${config.cloudName}/`;
		const path = url.pathname.slice(prefix.length);
		if (path.startsWith("resources/image/upload/")) {
			const auth = `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}`;
			if (new Headers(init?.headers).get("authorization") !== auth) return new Response("{}", { status: 401 });
			const publicId = path.slice("resources/image/upload/".length);
			const asset = assets.get(publicId);
			if (!asset) return Response.json({ error: { message: "Resource not found" } }, { status: 404 });
			return Response.json({ public_id: publicId, resource_type: "image", type: "upload", ...asset });
		}
		if (path === "image/destroy") {
			if (failDestroy) return new Response("unavailable", { status: 503 });
			const form = new URLSearchParams(String(init?.body));
			const { signature, api_key: _key, ...signed } = Object.fromEntries(form);
			if (signature !== signParams(signed, config.apiSecret))
				return Response.json({ error: { message: "Invalid Signature" } }, { status: 401 });
			const publicId = form.get("public_id") ?? "";
			const existed = assets.delete(publicId);
			destroyed.push(publicId);
			return Response.json({ result: existed ? "ok" : "not found" });
		}
		return new Response("unexpected", { status: 500 });
	};

	return {
		store: createCloudinary(config, fetcher),
		config,
		assets,
		destroyed,
		calls,
		/** The browser's direct upload to `publicId`. */
		put(publicId: string, asset: Partial<FakeAsset> = {}) {
			assets.set(publicId, { format: "png", bytes: 1234, width: 1600, height: 900, version: 1700000000, ...asset });
		},
		failDestroy(on = true) {
			failDestroy = on;
		},
	};
}
