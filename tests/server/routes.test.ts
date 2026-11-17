import { describe, expect, it, vi } from "vitest";
import { REQUEST_ID_HEADER } from "@/server/http/request-scope";
import { inStartEvent } from "../utils/start-event";

/**
 * Every server route through `defineApiRoute` (decision 0300): its methods, its secret and
 * its errors, as problem JSON with the request's id. The helper itself is
 * tests/server/api-route.test.ts; the jobs' steps are each product's own tests.
 */

const CRON_SECRET = vi.hoisted(() => {
	const secret = "routes-cron-secret-0123";
	process.env.CRON_SECRET = secret;
	// Monetag's push worker (decision 0301), configured for this file.
	process.env.MONETAG_PUSH_DOMAIN = "push.example";
	process.env.MONETAG_PUSH_ZONE = "12279218";
	return secret;
});
vi.mock("@/server/db/client", async () => {
	const { createTestDb } = await import("../utils/test-db");
	return { db: (await createTestDb()).db };
});

type NitroRoute = { default: (event: { req: Request }) => Promise<Response> };
type StartRoute = {
	Route: { options: { server: { handlers: Record<string, (context: { request: Request }) => Promise<Response>> } } };
};

const ORIGIN = "https://app.test";
const nitro = async (file: string, path: string, init: RequestInit = {}) => {
	const route = (await import(`../../src/server/routes/${file}.ts`)) as NitroRoute;
	return route.default({ req: new Request(`${ORIGIN}${path}`, init) });
};
/** The /api routes, by path (Vite resolves a variable import one folder deep only). */
const API_ROUTES: Record<string, () => Promise<unknown>> = {
	health: () => import("@/routes/api/health"),
	"csp-report": () => import("@/routes/api/csp-report"),
	"client-errors": () => import("@/routes/api/client-errors"),
	"account/export": () => import("@/routes/api/account/export"),
	"auth/$": () => import("@/routes/api/auth/$"),
};

/** A Start route's handlers, each called inside Start's request storage as the server would. */
const start = async (file: string) => {
	const load = API_ROUTES[file];
	if (!load) throw new Error(`No route ${file}`);
	const { handlers } = ((await load()) as StartRoute).Route.options.server;
	return Object.fromEntries(
		Object.entries(handlers).map(([method, handle]) => [
			method,
			(context: { request: Request }) => inStartEvent(context.request, () => handle(context)),
		]),
	);
};

const problem = async (response: Response, status: number, code: string) => {
	expect(response.status).toBe(status);
	expect(response.headers.get("content-type")).toBe("application/problem+json; charset=utf-8");
	const body = (await response.json()) as Record<string, unknown>;
	expect(body).toMatchObject({ status, code });
	expect(body.requestId).toBe(response.headers.get(REQUEST_ID_HEADER));
	return body;
};

const quiet = () => {
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
};

describe("the Nitro routes", () => {
	it("serve each manifest in the URL's language, and nothing but GET", async () => {
		quiet();
		for (const [file, path] of [
			["manifest", "/manifest.webmanifest"],
			["taskline-manifest", "/ne/app/taskline/manifest.webmanifest"],
			["parda-manifest", "/app/parda/manifest.webmanifest"],
			["chaal-manifest", "/ne/app/chaal/manifest.webmanifest"],
			["kharcha-manifest", "/app/kharcha/manifest.webmanifest"],
		] as const) {
			const response = await nitro(file, path);
			expect(response.status, file).toBe(200);
			expect(response.headers.get("content-type")).toBe("application/manifest+json; charset=utf-8");
			const manifest = (await response.json()) as { lang?: string };
			expect(manifest.lang, file).toBe(path.startsWith("/ne/") ? "ne" : "en");
			await problem(await nitro(file, path, { method: "POST" }), 405, "METHOD_NOT_ALLOWED");
		}
	});

	it("keep every job behind CRON_SECRET: no token or another is a 401, and only GET runs one", async () => {
		quiet();
		for (const job of ["attachments", "guests", "taskline", "parda", "chaal", "kharcha"]) {
			const path = `/api/cron/${job}`;
			await problem(await nitro(`cron-${job}`, path), 401, "UNAUTHORIZED");
			await problem(
				await nitro(`cron-${job}`, path, { headers: { authorization: "Bearer someone-elses-secret" } }),
				401,
				"UNAUTHORIZED",
			);
			const posted = await nitro(`cron-${job}`, path, {
				method: "POST",
				headers: { authorization: `Bearer ${CRON_SECRET}` },
			});
			await problem(posted, 405, "METHOD_NOT_ALLOWED");
			expect(posted.headers.get("allow")).toBe("GET");
		}
	});

	it("serve Monetag's push worker from its configured zone, and nothing but GET", async () => {
		quiet();
		const worker = await nitro("monetag-sw", "/sw.js");
		expect(worker.status).toBe(200);
		expect(worker.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
		expect(await worker.text()).toBe(
			[
				'self.options = {"domain":"push.example","zoneId":12279218};',
				'self.lary = "";',
				'importScripts("https://push.example/act/files/service-worker.min.js?r=sw");',
				"",
			].join("\n"),
		);
		await problem(await nitro("monetag-sw", "/sw.js", { method: "POST" }), 405, "METHOD_NOT_ALLOWED");
	});

	it("keep the probe a 404 while PARDA_PROBE_SECRET is unset", async () => {
		quiet();
		await problem(await nitro("parda-probe", "/api/parda/probe"), 404, "NOT_FOUND");
	});

	it("serve the placeholder player's pages, and a 404 for any other path", async () => {
		quiet();
		const page = await nitro("parda-player", "/parda/api/1/movie/550");
		expect(page.status).toBe(200);
		expect(page.headers.get("content-security-policy")).toContain("nonce-");
		await problem(await nitro("parda-player", "/parda/api/9/nothing"), 404, "NOT_FOUND");
		await problem(await nitro("parda-player", "/parda/api/1/movie/550", { method: "POST" }), 405, "METHOD_NOT_ALLOWED");
	});

	it("open Chaal's streams to our own pages only, and refuse what isn't one", async () => {
		quiet();
		const crossSite = await nitro("chaal-stream", "/api/chaal/stream/challenge", {
			method: "POST",
			headers: { "sec-fetch-site": "cross-site" },
			body: "{}",
		});
		await problem(crossSite, 403, "FORBIDDEN");
		const tooBig = await nitro("chaal-stream", "/api/chaal/stream/seek", {
			method: "POST",
			headers: { "sec-fetch-site": "same-origin" },
			body: JSON.stringify({ pad: "x".repeat(3000) }),
		});
		await problem(tooBig, 400, "BAD_REQUEST");
		await problem(await nitro("chaal-stream", "/api/chaal/stream/challenge"), 405, "METHOD_NOT_ALLOWED");
		await problem(await nitro("chaal-stream", "/api/chaal/stream/nothing"), 404, "NOT_FOUND");
		await problem(await nitro("chaal-oauth", "/api/chaal/oauth/start", { method: "POST" }), 405, "METHOD_NOT_ALLOWED");
	});

	it("answer an unsubscribe link that isn't ours with its own page, and nothing but GET and POST", async () => {
		quiet();
		const invalid = await nitro("kharcha-unsubscribe", "/api/kharcha/unsubscribe?p=nope&t=nope&l=ne");
		expect(invalid.status).toBe(400);
		expect(invalid.headers.get("content-type")).toBe("text/html; charset=utf-8");
		expect(await invalid.text()).toContain('lang="ne"');
		await problem(
			await nitro("kharcha-unsubscribe", "/api/kharcha/unsubscribe", { method: "DELETE" }),
			405,
			"METHOD_NOT_ALLOWED",
		);
	});
});

describe("the /api routes", () => {
	it("take only their methods", async () => {
		expect(Object.keys(await start("health"))).toEqual(["GET", "HEAD"]);
		expect(Object.keys(await start("csp-report"))).toEqual(["POST"]);
		expect(Object.keys(await start("client-errors"))).toEqual(["POST"]);
		expect(Object.keys(await start("account/export"))).toEqual(["GET"]);
		expect(Object.keys(await start("auth/$"))).toEqual(["GET", "POST"]);
	});

	it("answer the health check from the database", async () => {
		quiet();
		const handlers = await start("health");
		const response = await handlers.GET?.({ request: new Request(`${ORIGIN}/api/health`) });
		expect(response?.status).toBe(200);
		expect(response?.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
	});

	it("refuse the account export to a visitor without an account", async () => {
		quiet();
		const handlers = await start("account/export");
		const response = await handlers.GET?.({ request: new Request(`${ORIGIN}/api/account/export`) });
		await problem(response as Response, 401, "UNAUTHORIZED");
	});

	it("take a browser's error report from our own pages, in its shape", async () => {
		quiet();
		const handlers = await start("client-errors");
		const post = (headers: Record<string, string>, body: unknown) =>
			handlers.POST?.({
				request: new Request(`${ORIGIN}/api/client-errors`, {
					method: "POST",
					headers: { "content-type": "application/json", ...headers },
					body: JSON.stringify(body),
				}),
			}) as Promise<Response>;
		const report = { source: "error", name: "TypeError", message: "boom", url: `${ORIGIN}/admin` };
		await problem(await post({ "sec-fetch-site": "cross-site" }, report), 403, "FORBIDDEN");
		await problem(await post({ "sec-fetch-site": "same-origin" }, { message: 1 }), 422, "VALIDATION");
		expect((await post({ "sec-fetch-site": "same-origin" }, report)).status).toBe(204);
	});

	it("refuse a CSP report that isn't one", async () => {
		const handlers = await start("csp-report");
		const response = await handlers.POST?.({
			request: new Request(`${ORIGIN}/api/csp-report`, { method: "POST", body: "x" }),
		});
		expect(response?.status).toBe(415);
	});
});
