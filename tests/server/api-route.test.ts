import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import {
	type ApiAuth,
	type ApiRouteOptions,
	type ApiUser,
	defineApiRoute,
	jsonResponse,
} from "@/server/http/api-route";
import { REQUEST_ID_HEADER } from "@/server/http/request-scope";
import { inStartEvent } from "../utils/start-event";
import { createTestDb } from "../utils/test-db";

/**
 * `defineApiRoute` (decision 0300): what every server route gets before its handler runs,
 * and the envelope of whatever it throws. The routes themselves: tests/server/routes.test.ts.
 */
const env = await createTestDb();
afterAll(() => env.close());
beforeEach(() => env.reset());

const SECRET = "route-secret-0123456789";
const ORIGIN = "https://app.test";

const route = <TAuth extends ApiAuth = "public">(
	options: Partial<ApiRouteOptions<TAuth>> & { session?: ApiUser | null },
) =>
	defineApiRoute<TAuth>({
		name: "probe",
		methods: ["GET", "POST"],
		handler: () => jsonResponse(200, { ok: true }),
		...options,
		deps: { db: env.db, session: async () => options.session ?? null },
	});

const request = (method = "GET", init: RequestInit = {}, path = "/api/probe") =>
	new Request(`${ORIGIN}${path}`, { method, ...init });

/** The problem JSON a refused request answers with, and that its id is the header's. */
const problem = async (response: Response) => {
	expect(response.headers.get("content-type")).toBe("application/problem+json; charset=utf-8");
	const body = (await response.json()) as Record<string, unknown>;
	expect(body.status).toBe(response.status);
	expect(body.requestId).toBe(response.headers.get(REQUEST_ID_HEADER));
	return body;
};

const quiet = () => {
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
};

describe("defineApiRoute", () => {
	beforeEach(quiet);

	it("answers with the request's id and Server-Timing, and logs one line", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const response = await route({}).fetch(request());
		expect(response.status).toBe(200);
		expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
		expect(response.headers.get("server-timing")).toMatch(/^total;dur=\d+/);
		const line = JSON.parse(String(info.mock.calls.at(-1)?.[0]));
		expect(line).toMatchObject({
			msg: "api-route",
			route: "probe",
			method: "GET",
			status: 200,
			requestId: response.headers.get(REQUEST_ID_HEADER),
		});
	});

	it("refuses a method it doesn't take with 405 and Allow", async () => {
		const response = await route({}).fetch(request("DELETE"));
		expect(response.status).toBe(405);
		expect(response.headers.get("allow")).toBe("GET, POST");
		expect(await problem(response)).toMatchObject({ code: "METHOD_NOT_ALLOWED", title: "Method not allowed" });
	});

	it("is a 404 without its secret configured, and a 401 with another token", async () => {
		const unconfigured = await route({ secret: () => undefined }).fetch(request());
		expect(unconfigured.status).toBe(404);
		expect(await problem(unconfigured)).toMatchObject({ code: "NOT_FOUND" });

		const guarded = route({ secret: () => SECRET });
		for (const authorization of [undefined, "Bearer nope", `Bearer ${SECRET}x`, SECRET]) {
			const response = await guarded.fetch(request("GET", authorization ? { headers: { authorization } } : {}));
			expect(response.status).toBe(401);
			expect(await problem(response)).toMatchObject({ code: "UNAUTHORIZED" });
		}
		const allowed = await guarded.fetch(request("GET", { headers: { authorization: `Bearer ${SECRET}` } }));
		expect(allowed.status).toBe(200);
		// The secret comes before the method: a stranger learns nothing of what the route takes.
		expect((await route({ secret: () => SECRET }).fetch(request("DELETE"))).status).toBe(401);
	});

	it("takes a write from our own pages only, when it asks for that", async () => {
		const own = route({ sameOrigin: true });
		const crossSite = await own.fetch(request("POST", { headers: { "sec-fetch-site": "cross-site" } }));
		expect(crossSite.status).toBe(403);
		expect(await problem(crossSite)).toMatchObject({ code: "FORBIDDEN" });
		expect((await own.fetch(request("POST", { headers: { origin: "https://evil.test" } }))).status).toBe(403);
		expect((await own.fetch(request("POST", { headers: { "sec-fetch-site": "same-origin" } }))).status).toBe(200);
		expect((await own.fetch(request("POST", { headers: { origin: ORIGIN } }))).status).toBe(200);
		// A read is not a write.
		expect((await own.fetch(request("GET", { headers: { "sec-fetch-site": "cross-site" } }))).status).toBe(200);
	});

	it("asks for a session or an account as the route says", async () => {
		const member: ApiUser = { id: "admin-1", isGuest: false };
		const guest: ApiUser = { id: "guest-1", isGuest: true };
		expect((await route({ auth: "user" }).fetch(request())).status).toBe(401);
		expect((await route({ auth: "user", session: guest }).fetch(request())).status).toBe(401);
		expect((await route({ auth: "user", session: member }).fetch(request())).status).toBe(200);
		expect((await route({ auth: "session", session: guest }).fetch(request())).status).toBe(200);
		expect((await route({ auth: "session" }).fetch(request())).status).toBe(401);

		let seen: ApiUser | null | undefined;
		const optional = route<"optional">({
			auth: "optional",
			handler: ({ user }) => {
				seen = user;
				return jsonResponse(200, {});
			},
		});
		expect((await optional.fetch(request())).status).toBe(200);
		expect(seen).toBeNull();
	});

	it("limits each caller to its window, with Retry-After, in Postgres", async () => {
		const limited = route({ rateLimit: { max: 2, windowSeconds: 60 } });
		const from = (ip: string) => limited.fetch(request(), { ip });
		expect((await from("10.0.0.1")).status).toBe(200);
		expect((await from("10.0.0.1")).status).toBe(200);
		const third = await from("10.0.0.1");
		expect(third.status).toBe(429);
		expect(Number(third.headers.get("retry-after"))).toBeGreaterThan(0);
		expect(await problem(third)).toMatchObject({ code: "RATE_LIMITED" });
		// Another address has its own window.
		expect((await from("10.0.0.2")).status).toBe(200);
	});

	it("reads a body up to its limit, and says when it isn't JSON", async () => {
		const echo = route({
			bodyLimit: 16,
			handler: async ({ json }) => jsonResponse(200, { got: await json() }),
		});
		const ok = await echo.fetch(request("POST", { body: '{"a":1}' }));
		expect(await ok.json()).toEqual({ got: { a: 1 } });

		const big = await echo.fetch(request("POST", { body: JSON.stringify({ a: "x".repeat(50) }) }));
		expect(big.status).toBe(400);
		expect(await problem(big)).toMatchObject({ code: "BAD_REQUEST", message: "The body is over 16 bytes" });

		const notJson = await echo.fetch(request("POST", { body: "{nope" }));
		expect(notJson.status).toBe(422);
		expect(await problem(notJson)).toMatchObject({ code: "VALIDATION" });
	});

	it("answers what the handler throws as the envelope, and nothing of a crash", async () => {
		const refusing = route({
			handler: () => {
				throw new AppError("CONFLICT", "Taken", { fieldErrors: { slug: ["Taken"] } });
			},
		});
		const conflict = await refusing.fetch(request());
		expect(conflict.status).toBe(409);
		expect(await problem(conflict)).toMatchObject({ code: "CONFLICT", fieldErrors: { slug: ["Taken"] } });

		const crashing = route({
			handler: () => {
				throw new TypeError("cannot read secret of undefined at 10.0.0.5");
			},
		});
		const crash = await crashing.fetch(request());
		expect(crash.status).toBe(500);
		const body = await problem(crash);
		expect(body).toEqual({
			type: "about:blank",
			title: "Internal error",
			status: 500,
			code: "INTERNAL",
			message: "Internal error",
			requestId: crash.headers.get(REQUEST_ID_HEADER),
		});
	});

	it("answers TIMEOUT when the handler takes longer than its deadline", async () => {
		const slow = route({ timeoutMs: 10, handler: () => new Promise<Response>(() => {}) });
		const response = await slow.fetch(request());
		expect(response.status).toBe(504);
		expect(await problem(response)).toMatchObject({ code: "TIMEOUT", message: "Timed out" });
	});

	it("gives the handler the URL's language", async () => {
		let locale: string | undefined;
		const localized = route({
			handler: ({ locale: asked }) => {
				locale = asked;
				return jsonResponse(200, {});
			},
		});
		await localized.fetch(request("GET", {}, "/ne/manifest.webmanifest"));
		expect(locale).toBe("ne");
		await localized.fetch(request("GET", {}, "/manifest.webmanifest"));
		expect(locale).toBe("en");
	});

	it("serves a Start route's methods and a Nitro route alike", async () => {
		const both = route({});
		expect(Object.keys(both.handlers)).toEqual(["GET", "POST"]);
		const asked = request();
		const viaStart = await inStartEvent(asked, () => both.handlers.GET?.({ request: asked }));
		expect(viaStart?.status).toBe(200);
		const viaNitro = await both.nitro({ req: Object.assign(request(), { ip: "127.0.0.1" }) });
		expect(viaNitro.status).toBe(200);
	});
});
