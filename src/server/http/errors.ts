import "@tanstack/react-start/server-only";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { z } from "zod";
import { AppError, type AppErrorCode, zodFieldErrors } from "@/lib/errors";
import { errorFields, log } from "../log";
import { UpstreamError } from "./outbound";

/**
 * The one place a thrown value becomes the error envelope (decision 0300). Server
 * functions go through it in their middleware (src/middleware/errors.ts), server routes
 * in `defineApiRoute` (./api-route.ts), so both answer with the same `code`, `reason`,
 * `message`, `fieldErrors` and `requestId`.
 *
 * - An AppError is what the code meant to say: it keeps its code.
 * - What the database, Zod, another service or Better Auth threw is mapped below, so
 *   nothing a user can cause arrives as a 500.
 * - Anything else is a bug: INTERNAL, with the original logged (stack and cause chain)
 *   and sent to Sentry, and nothing of it in the answer.
 */

/** What the caller reads in place of a server-side detail. */
const PUBLIC_MESSAGE: Partial<Record<AppErrorCode, string>> = {
	INTERNAL: "Internal error",
	UPSTREAM_UNAVAILABLE: "A service is unavailable",
	TIMEOUT: "Timed out",
};

type Mapped = { code: AppErrorCode; message: string; reason?: "retry" };

/** Postgres' SQLSTATE and constraint, wherever they are in the cause chain (Drizzle wraps the driver's error). */
const databaseError = (error: unknown): { code: string; constraint: string | undefined } | undefined => {
	for (let current: unknown = error, depth = 0; typeof current === "object" && current !== null && depth < 6; depth++) {
		const pg = current as { code?: unknown; constraint?: unknown; severity?: unknown; cause?: unknown };
		// A SQLSTATE is five characters; `severity` (or a constraint) tells it from Node's own error codes.
		if (
			typeof pg.code === "string" &&
			/^[0-9A-Z]{5}$/.test(pg.code) &&
			(pg.severity !== undefined || pg.constraint !== undefined)
		) {
			return { code: pg.code, constraint: typeof pg.constraint === "string" ? pg.constraint : undefined };
		}
		current = pg.cause;
	}
	return undefined;
};

/**
 * What a SQLSTATE means to the caller. A repository maps the unique constraints it
 * knows onto their form fields first (`uniqueViolation`, src/server/db/crud.ts); this
 * is what is left.
 */
const mapDatabase = (pg: { code: string; constraint: string | undefined }): Mapped | undefined => {
	const on = pg.constraint ? ` (${pg.constraint})` : "";
	switch (pg.code) {
		case "23505":
			return { code: "CONFLICT", message: `A row with this value exists${on}` };
		case "23503":
			return { code: "CONFLICT", message: `A row this depends on is missing or still in use${on}` };
		case "23502":
		case "23514":
		case "22001":
		case "22003":
		case "22007":
		case "22008":
		case "22P02":
			return { code: "BAD_REQUEST", message: `The database refused the value${on}` };
		// Two transactions that could not both commit: the same call can be sent again.
		case "40001":
		case "40P01":
			return { code: "CONFLICT", message: "The write lost a race; try again", reason: "retry" };
		case "57014":
			return { code: "TIMEOUT", message: "The query was cancelled" };
		case "53300":
		case "57P01":
		case "57P02":
		case "57P03":
			return { code: "UPSTREAM_UNAVAILABLE", message: "The database is not taking connections" };
		default:
			return pg.code.startsWith("08")
				? { code: "UPSTREAM_UNAVAILABLE", message: "The database connection failed" }
				: undefined;
	}
};

/** A connection that could not be made or was dropped: Node's error codes, and node-postgres' own words. */
const NETWORK_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EAI_AGAIN"]);
const isConnectionFailure = (error: unknown): boolean => {
	for (let current: unknown = error, depth = 0; current instanceof Error && depth < 6; depth++) {
		if ("code" in current && typeof current.code === "string" && NETWORK_CODES.has(current.code)) return true;
		if (/Connection terminated|timeout exceeded when trying to connect/i.test(current.message)) return true;
		current = current.cause;
	}
	return false;
};

const STATUS_CODES: Readonly<Record<number, AppErrorCode>> = {
	400: "BAD_REQUEST",
	401: "UNAUTHORIZED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	409: "CONFLICT",
	422: "VALIDATION",
	429: "RATE_LIMITED",
};

/** Better Auth's APIError (better-call): told by its shape, so this file doesn't load Better Auth. */
const authApiStatus = (error: unknown): number | undefined =>
	error instanceof Error && error.name === "APIError" && "statusCode" in error && typeof error.statusCode === "number"
		? error.statusCode
		: undefined;

/**
 * The AppError a thrown value stands for, and whether it was mapped from something
 * else (`foreign`: the log then says what it was).
 */
export const toAppError = (error: unknown): { error: AppError; foreign: boolean } => {
	if (error instanceof AppError) return { error, foreign: false };
	const from = (mapped: Mapped, extra: { fieldErrors?: AppError["fieldErrors"] } = {}) => ({
		error: new AppError(mapped.code, mapped.message, {
			cause: error,
			...(mapped.reason ? { reason: mapped.reason } : {}),
			...(extra.fieldErrors ? { fieldErrors: extra.fieldErrors } : {}),
		}),
		foreign: true,
	});

	if (error instanceof z.ZodError) {
		return from({ code: "VALIDATION", message: "Invalid input" }, { fieldErrors: zodFieldErrors(error) });
	}
	if (error instanceof UpstreamError) {
		// A call to a host that isn't the service's is our bug, not the service's failure.
		return from({ code: error.kind === "blocked" ? "INTERNAL" : "UPSTREAM_UNAVAILABLE", message: error.message });
	}
	const pg = databaseError(error);
	const database = pg && mapDatabase(pg);
	if (database) return from(database);
	const status = authApiStatus(error);
	const authCode = status === undefined ? undefined : STATUS_CODES[status];
	if (authCode) return from({ code: authCode, message: "Refused by the auth service" });
	if (error instanceof Error && error.name === "TimeoutError") return from({ code: "TIMEOUT", message: "Timed out" });
	if (isConnectionFailure(error)) return from({ code: "UPSTREAM_UNAVAILABLE", message: "A connection failed" });
	return from({ code: "INTERNAL", message: "Internal error" });
};

/**
 * The envelope for whatever was thrown: an AppError tagged with the request's id,
 * safe to send. Logs what the caller will not see: an unexpected error (and a broken
 * invariant, `internalError`) at "error" with its stack, and to Sentry; a database,
 * Zod, service or auth error that was mapped, at "warn" with its cause chain.
 */
export const toEnvelope = (thrown: unknown, requestId: string): AppError => {
	const { error, foreign } = toAppError(thrown);
	if (error.code === "INTERNAL") {
		// The only place an unexpected error reaches Sentry with its original stack; the
		// request id matches what the user is shown.
		void import("@sentry/tanstackstart-react").then((Sentry) =>
			Sentry.captureException(foreign ? thrown : error, { tags: { requestId } }),
		);
		log("error", "unexpected error", { ...errorFields(foreign ? thrown : error, { stack: true }) });
	} else if (foreign) {
		log("warn", "mapped error", { code: error.code, ...errorFields(thrown) });
	}
	const publicMessage = PUBLIC_MESSAGE[error.code];
	if (!publicMessage && error.requestId) return error;
	return AppError.fromShape({
		...error.toShape(),
		message: publicMessage ?? error.message,
		requestId: error.requestId ?? requestId,
	});
};

/**
 * `toEnvelope` for a server function: router control flow (redirect, notFound) passes
 * through untouched.
 */
export const normalizeServerError = (error: unknown, requestId: string): unknown =>
	isRedirect(error) || isNotFound(error) ? error : toEnvelope(error, requestId);

/**
 * `work`, or TIMEOUT once `ms` has passed (0: no limit). The work is not stopped, only
 * no longer waited for: the caller gets the envelope instead of the platform's 504 page,
 * and a write that still lands is safe to send again (ids and versions, PLAN 15.6).
 */
export const withDeadline = <T>(work: Promise<T>, ms: number, what: string): Promise<T> => {
	if (!(ms > 0)) return work;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<never>((_, reject) => {
		// timer: the request's deadline, cleared when the work settles first.
		timer = setTimeout(() => reject(new AppError("TIMEOUT", `${what} took longer than ${ms} ms`)), ms);
	});
	return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
};

const TITLES: Readonly<Record<AppErrorCode, string>> = {
	BAD_REQUEST: "Bad request",
	VALIDATION: "Invalid input",
	UNAUTHORIZED: "Unauthorized",
	FORBIDDEN: "Forbidden",
	NOT_FOUND: "Not found",
	METHOD_NOT_ALLOWED: "Method not allowed",
	CONFLICT: "Conflict",
	RATE_LIMITED: "Too many requests",
	INTERNAL: "Internal error",
	UPSTREAM_UNAVAILABLE: "Service unavailable",
	TIMEOUT: "Timed out",
};

/**
 * The envelope as a server route's answer: problem JSON (RFC 9457), with the
 * envelope's fields beside the standard `type`, `title` and `status`.
 */
export const problemResponse = (error: AppError, headers: Record<string, string> = {}): Response =>
	new Response(
		JSON.stringify({
			type: "about:blank",
			title: TITLES[error.code],
			status: error.status,
			code: error.code,
			message: error.message,
			...(error.reason ? { reason: error.reason } : {}),
			...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
			...(error.requestId ? { requestId: error.requestId } : {}),
		}),
		{
			status: error.status,
			headers: { "content-type": "application/problem+json; charset=utf-8", "cache-control": "no-store", ...headers },
		},
	);
