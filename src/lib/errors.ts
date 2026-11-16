/**
 * The one error shape that crosses the server/client boundary: the envelope
 * (`code`, `reason`, `message`, `fieldErrors`, `requestId`, decision 0300).
 *
 * Server functions and server routes never leak raw errors: whatever is thrown is
 * mapped to an AppError in one place (src/server/http/errors.ts). A function sends
 * it through the serialization adapter below, which keeps the class intact across
 * the wire, so client code can rely on `error instanceof AppError` and branch on
 * `code`; a route sends the same fields as problem JSON. User-facing text is never
 * sent; the client picks a localized message by `code` (see errorMessage()).
 */
import { createSerializationAdapter } from "@tanstack/react-router";
import type { z } from "zod";

/**
 * - VALIDATION: the input failed its schema (`fieldErrors` says where). BAD_REQUEST is
 *   a well-formed request the rules refuse.
 * - METHOD_NOT_ALLOWED: a server route asked with a method it doesn't take (a server
 *   function never answers it).
 * - TIMEOUT: the server gave up waiting for its own work; UPSTREAM_UNAVAILABLE: a
 *   service it depends on failed. Both, with INTERNAL, are "unknown" outcomes (a
 *   status of 500 or more): the write may or may not have happened.
 */
export const APP_ERROR_CODES = [
	"BAD_REQUEST",
	"VALIDATION",
	"UNAUTHORIZED",
	"FORBIDDEN",
	"NOT_FOUND",
	"METHOD_NOT_ALLOWED",
	"CONFLICT",
	"RATE_LIMITED",
	"INTERNAL",
	"UPSTREAM_UNAVAILABLE",
	"TIMEOUT",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export const HTTP_STATUS: Readonly<Record<AppErrorCode, number>> = {
	BAD_REQUEST: 400,
	VALIDATION: 422,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	CONFLICT: 409,
	RATE_LIMITED: 429,
	INTERNAL: 500,
	UPSTREAM_UNAVAILABLE: 503,
	TIMEOUT: 504,
};

/**
 * Why an error happened, when the client acts on it beyond showing a message:
 * "stale" is a CONFLICT because the row changed since the client loaded it
 * (optimistic concurrency, src/lib/concurrency.ts). "two-factor-required" is a
 * FORBIDDEN because the user must turn on two-factor authentication before using
 * their admin permissions (AUTH_REQUIRE_ADMIN_2FA, decisions.md 0126).
 * "retry" is a CONFLICT because the write lost a race inside the database (a
 * serialization failure, a deadlock): nothing was written and the same call can be
 * sent again (decision 0300).
 * "lichess-wait" is a RATE_LIMITED because Lichess asked Chaal to wait (a 429 starts a
 * cooldown), and "lichess-reconnect" a FORBIDDEN because the user's Lichess token was
 * revoked or lacks a scope (decision 0255).
 */
export const APP_ERROR_REASONS = [
	"stale",
	"retry",
	"two-factor-required",
	"lichess-wait", // @chaal
	"lichess-reconnect", // @chaal
] as const;
export type AppErrorReason = (typeof APP_ERROR_REASONS)[number];

/** Field path -> error keys/messages, e.g. from Zod input validation. */
export type FieldErrors = Readonly<Record<string, ReadonlyArray<string>>>;

export type AppErrorShape = {
	code: AppErrorCode;
	status: number;
	/** Developer-facing detail. Never shown to users; "Internal error" for INTERNAL. */
	message: string;
	fieldErrors?: FieldErrors;
	reason?: AppErrorReason;
	/** The request's id: also in the x-request-id header, the log lines and the Sentry event. */
	requestId?: string;
};

/** Field-errors key for a message about the whole action (shown by errorMessage). */
export const FORM_ERROR_KEY = "_form";

export class AppError extends Error {
	override name = "AppError";
	readonly code: AppErrorCode;
	readonly status: number;
	readonly fieldErrors: FieldErrors | undefined;
	readonly reason: AppErrorReason | undefined;
	readonly requestId: string | undefined;

	constructor(
		code: AppErrorCode,
		message: string = code,
		extra: { fieldErrors?: FieldErrors; reason?: AppErrorReason; requestId?: string; cause?: unknown } = {},
	) {
		super(message, extra.cause === undefined ? undefined : { cause: extra.cause });
		this.code = code;
		this.status = HTTP_STATUS[code];
		this.fieldErrors = extra.fieldErrors;
		this.reason = extra.reason;
		this.requestId = extra.requestId;
	}

	/** The same error, tagged with the request it happened in. */
	withRequestId(requestId: string): AppError {
		return AppError.fromShape({ ...this.toShape(), requestId });
	}

	toShape(): AppErrorShape {
		return {
			code: this.code,
			status: this.status,
			message: this.message,
			...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
			...(this.reason ? { reason: this.reason } : {}),
			...(this.requestId ? { requestId: this.requestId } : {}),
		};
	}

	static fromShape(shape: AppErrorShape): AppError {
		return new AppError(shape.code, shape.message, {
			...(shape.fieldErrors ? { fieldErrors: shape.fieldErrors } : {}),
			...(shape.reason ? { reason: shape.reason } : {}),
			...(shape.requestId ? { requestId: shape.requestId } : {}),
		});
	}
}

export const isAppError = (value: unknown): value is AppError => value instanceof AppError;

/**
 * Whether the server refused (a 4xx: the same call fails again, so roll back and say why)
 * or the outcome is unknown (anything else: the network, a timeout, a 5xx), PLAN 15.6.
 */
export const isRefusal = (error: unknown): error is AppError => isAppError(error) && error.status < 500;

/**
 * A broken invariant: something the code relies on did not hold (an insert returned no
 * row). A bug, not a refusal: the caller sees INTERNAL with no detail, the log has the
 * message and the stack.
 */
export const internalError = (message: string, cause?: unknown) =>
	new AppError("INTERNAL", message, cause === undefined ? {} : { cause });

/** Registered in src/start.ts. Rebuilds AppError on the client with its class and fields. */
export const appErrorSerializationAdapter = createSerializationAdapter({
	key: "app-error",
	test: isAppError,
	toSerializable: (error) => error.toShape(),
	fromSerializable: (shape: AppErrorShape) => AppError.fromShape(shape),
});

/**
 * An AppError that carries a localized explanation for the user (e.g. "You can't
 * remove the last admin."), in `fieldErrors._form`. errorMessage() shows it
 * instead of the generic text for the code.
 */
export const ruleError = (code: AppErrorCode, devMessage: string, userMessage: string) =>
	new AppError(code, devMessage, { fieldErrors: { [FORM_ERROR_KEY]: [userMessage] } });

/** Groups Zod issues by dotted field path ("_" for form-level issues). */
export const zodFieldErrors = (error: z.ZodError): FieldErrors => {
	const fields: Record<string, string[]> = {};
	for (const issue of error.issues) {
		const key = issue.path.map(String).join(".") || "_";
		const list = fields[key] ?? [];
		list.push(issue.message);
		fields[key] = list;
	}
	return fields;
};
