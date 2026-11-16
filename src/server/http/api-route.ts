import "@tanstack/react-start/server-only";
import { timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";
import { baseLocale, extractLocaleFromUrl, type Locale } from "@/paraglide/runtime";
import { clientIpOf, trustedClientIp } from "../auth/client-ip";
import type { Db } from "../db/types";
import { serverEnv } from "../env";
import { log } from "../log";
import { problemResponse, toEnvelope, withDeadline } from "./errors";
import type { RateLimitRule } from "./rate-limit";
import { runInRequestScope, setRequestLocale, setRequestUser } from "./request-scope";

/**
 * The one way to write a server route (decision 0300): a Nitro route in
 * `src/server/routes` or a Start route under `src/routes/api`. The route says what it
 * accepts; `defineApiRoute` does the rest, in this order:
 *
 * 1. the request's scope: an id, `x-request-id` and `Server-Timing` on the answer;
 * 2. **the secret** (a job, a probe): without it configured the route is a 404, with
 *    another token a 401 (compared in constant time);
 * 3. **the method**: one that isn't listed is a 405 with `Allow`;
 * 4. **the origin**, for a route only our own pages may post to: a 403;
 * 5. **who is asking**, when the route needs a session: a 401;
 * 6. **the rate limit**, per user or client address: a 429 with `Retry-After`;
 * 7. **the body**, read through `text()` or `json()` and refused past its limit;
 * 8. the handler, under the request's deadline.
 *
 * Whatever is thrown anywhere in that list is answered as problem JSON with the error
 * envelope (src/server/http/errors.ts), and every request leaves one "api-route" log line.
 *
 *   export default defineApiRoute({ name: "manifest", methods: ["GET"], handler: … }).nitro;
 *   server: { handlers: defineApiRoute({ … }).handlers }   // a Start route
 */
export type ApiMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Who a route is for: anyone, anyone (but it reads the session), any session (a guest's too), or a signed-in account. */
export type ApiAuth = "public" | "optional" | "session" | "user";

export type ApiUser = { id: string; isGuest: boolean };

type UserOf<TAuth extends ApiAuth> = TAuth extends "session" | "user"
	? ApiUser
	: TAuth extends "optional"
		? ApiUser | null
		: null;

export type ApiContext<TAuth extends ApiAuth = "public"> = {
	request: Request;
	url: URL;
	requestId: string;
	/** The language of the request's URL (`/ne/…`), else the base one. */
	locale: Locale;
	/** The caller, as the route's `auth` asks. */
	user: UserOf<TAuth>;
	/** The body as text, read once; BAD_REQUEST past the route's `bodyLimit`. */
	text: () => Promise<string>;
	/** The body as JSON; VALIDATION when it isn't. */
	json: () => Promise<unknown>;
};

export type ApiRouteOptions<TAuth extends ApiAuth = "public"> = {
	/** The route's name in the log. */
	name: string;
	methods: readonly ApiMethod[];
	auth?: TAuth;
	/** A bearer secret. Returning nothing means "not configured": the route answers 404. */
	secret?: () => string | undefined;
	/** Only our own pages may send a POST, PUT, PATCH or DELETE (`Sec-Fetch-Site`, else `Origin`). */
	sameOrigin?: boolean;
	/** A fixed window in Postgres, shared by every instance, per user or client address. */
	rateLimit?: RateLimitRule;
	/** The largest body read, in bytes. 64 kB. */
	bodyLimit?: number;
	/** The handler's deadline in ms; `false` for a stream or a job. REQUEST_TIMEOUT_MS by default. */
	timeoutMs?: number | false;
	/** For tests: the database of the rate limit and the session's lookup, instead of the app's own. */
	deps?: { db?: Db; session?: (request: Request) => Promise<ApiUser | null> };
	handler: (context: ApiContext<TAuth>) => Response | Promise<Response>;
};

export type ApiRoute = {
	/** The route as a function of the request: what the two adapters below call, and what a test calls. */
	fetch: (request: Request, info?: { ip?: string | undefined }) => Promise<Response>;
	/** For a Nitro route's default export. */
	nitro: (event: { req: Request & { ip?: string | undefined } }) => Promise<Response>;
	/** For a Start route's `server.handlers`. */
	handlers: Partial<Record<ApiMethod, (context: { request: Request }) => Promise<Response>>>;
};

const DEFAULT_BODY_LIMIT = 64 * 1024;
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** A JSON answer that is never cached, for a route's handler. */
export const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
	});

/** Whether `header` is `Bearer <secret>`, compared in constant time. */
export const bearerMatches = (header: string | null, secret: string): boolean => {
	const expected = Buffer.from(`Bearer ${secret}`);
	const given = Buffer.from(header ?? "");
	return given.length === expected.length && timingSafeEqual(given, expected);
};

/**
 * A request from one of our pages, not another site's (server routes run outside the
 * server functions' CSRF check): the browser's `Sec-Fetch-Site`, else the `Origin`.
 */
export function sameOrigin(headers: Headers, url: string): boolean {
	const site = headers.get("sec-fetch-site");
	if (site) return site === "same-origin";
	const origin = headers.get("origin");
	return origin !== null && origin === new URL(url).origin;
}

/** The body as text, read no further than `limit` bytes. */
async function readBody(request: Request, limit: number): Promise<string> {
	const tooLarge = () => new AppError("BAD_REQUEST", `The body is over ${limit} bytes`);
	if (Number(request.headers.get("content-length") ?? 0) > limit) throw tooLarge();
	if (!request.body) return "";
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > limit) {
			await reader.cancel().catch(() => {});
			throw tooLarge();
		}
		chunks.push(value);
	}
	return Buffer.concat(chunks).toString("utf8");
}

async function sessionUser(request: Request): Promise<ApiUser | null> {
	// Loaded here: a route that needs no session (a manifest) never loads Better Auth.
	const { auth } = await import("../auth/auth");
	const session = await auth.api.getSession({ headers: request.headers });
	return session ? { id: session.user.id, isGuest: session.user.isAnonymous === true } : null;
}

export function defineApiRoute<TAuth extends ApiAuth = "public">(options: ApiRouteOptions<TAuth>): ApiRoute {
	const { name, methods, auth = "public", bodyLimit = DEFAULT_BODY_LIMIT } = options;
	const allow = methods.join(", ");

	const answer = async (request: Request, requestId: string, ip: string | undefined): Promise<Response> => {
		if (options.secret) {
			const secret = options.secret();
			if (!secret) throw new AppError("NOT_FOUND", `${name} is not configured`);
			if (!bearerMatches(request.headers.get("authorization"), secret)) {
				throw new AppError("UNAUTHORIZED", "A bearer token is required");
			}
		}
		if (!methods.includes(request.method as ApiMethod)) {
			throw new AppError("METHOD_NOT_ALLOWED", `${request.method} is not one of: ${allow}`);
		}
		if (options.sameOrigin && UNSAFE.has(request.method) && !sameOrigin(request.headers, request.url)) {
			throw new AppError("FORBIDDEN", "Not from this origin");
		}
		const locale = extractLocaleFromUrl(request.url) ?? baseLocale;
		setRequestLocale(locale);

		let user: ApiUser | null = null;
		if (auth !== "public") {
			user = await (options.deps?.session ?? sessionUser)(request);
			if (user) setRequestUser(user.id);
			if (auth !== "optional" && (!user || (auth === "user" && user.isGuest))) {
				throw new AppError("UNAUTHORIZED", "Authentication required");
			}
		}

		if (options.rateLimit) {
			// Loaded here: a route with no limit (a manifest) never opens the database.
			const { consumeRateLimit } = await import("./rate-limit");
			const db = options.deps?.db ?? (await import("../db/client")).db;
			const result = await consumeRateLimit(db, `route:${name}:${user?.id ?? ip ?? "unknown"}`, options.rateLimit);
			if (!result.allowed) {
				throw Object.assign(new AppError("RATE_LIMITED", `Rate limited: ${name}`), {
					retryAfterSeconds: result.retryAfterSeconds,
				});
			}
		}

		let body: Promise<string> | undefined;
		const text = () => {
			body ??= readBody(request, bodyLimit);
			return body;
		};
		return options.handler({
			request,
			url: new URL(request.url),
			requestId,
			locale,
			user: user as UserOf<TAuth>,
			text,
			json: async () => {
				try {
					return JSON.parse(await text()) as unknown;
				} catch (error) {
					if (error instanceof AppError) throw error;
					throw new AppError("VALIDATION", "The body is not JSON");
				}
			},
		});
	};

	const fetch: ApiRoute["fetch"] = (request, info = {}) =>
		runInRequestScope(
			async (requestId) => {
				const started = performance.now();
				const timeout = options.timeoutMs === false ? 0 : (options.timeoutMs ?? serverEnv.REQUEST_TIMEOUT_MS);
				let response: Response;
				try {
					response = await withDeadline(answer(request, requestId, info.ip), timeout, name);
				} catch (thrown) {
					const error = toEnvelope(thrown, requestId);
					const headers: Record<string, string> = {};
					if (error.code === "METHOD_NOT_ALLOWED") headers.allow = allow;
					if (typeof thrown === "object" && thrown !== null && "retryAfterSeconds" in thrown) {
						headers["retry-after"] = String(thrown.retryAfterSeconds);
					}
					response = problemResponse(error, headers);
				}
				const { status } = response;
				log(status >= 500 ? "error" : status >= 400 ? "warn" : "info", "api-route", {
					route: name,
					method: request.method,
					status,
					ms: Math.round(performance.now() - started),
				});
				return response;
			},
			{ request },
		);

	return {
		fetch,
		nitro: (event) => fetch(event.req, { ip: clientIpOf(event.req, event.req.ip) }),
		handlers: Object.fromEntries(
			methods.map((method) => [
				method,
				({ request }: { request: Request }) => fetch(request, { ip: trustedClientIp(request) }),
			]),
		),
	};
}
