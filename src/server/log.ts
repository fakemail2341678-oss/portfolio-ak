import "@tanstack/react-start/server-only";
import { currentRequest } from "./http/request-scope";

/**
 * The server's log (decisions 0123, 0300): one JSON line per event on stdout or stderr,
 * which is what Vercel's log drains index. Every line has the same first fields:
 *
 *   time, level, msg, requestId, userId, then the event's own.
 *
 * `requestId` and `userId` come from the request's scope (src/server/http/request-scope.ts),
 * so nothing passes them along. Fields are redacted on the way out (redact, below):
 * a caller can log an object it was given without first checking what is in it.
 */
export type LogLevel = "info" | "warn" | "error";

const REDACTED = "[redacted]";

/** A field with one of these names is never written, whatever it holds. */
const SECRET_KEY =
	/(password|passwd|secret|token|authorization|cookie|api[-_]?key|signature|credentials?|otp|backup[-_]?codes?)$/i;

/** Secrets and personal data inside a string: what a message or a URL can carry. */
const SCRUBS: ReadonlyArray<[pattern: RegExp, replacement: string]> = [
	// user:password@ in a connection string or a URL
	[/(\b[a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, `$1${REDACTED}@`],
	[/\b(Bearer|Basic)\s+[\w.~+/=-]{8,}/gi, `$1 ${REDACTED}`],
	// A JSON Web Token: three base64url parts.
	[/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, REDACTED],
	[
		/\b(pass(?:word|wd)?|secret|token|api[-_]?key|signature|code_verifier|client_secret)=[^&\s"'<>]+/gi,
		`$1=${REDACTED}`,
	],
	// An email address keeps its first letter and its domain: enough to recognise, not to write to.
	[/\b([\w%+-])[\w.%+-]*@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi, "$1***@$2"],
];

const MAX_STRING = 4_000;
const MAX_ITEMS = 50;
const MAX_DEPTH = 6;

const scrub = (text: string): string => {
	let out = text.length > MAX_STRING ? `${text.slice(0, MAX_STRING)}…` : text;
	for (const [pattern, replacement] of SCRUBS) out = out.replace(pattern, replacement);
	return out;
};

/**
 * `value` as it may be written: fields named like a secret are replaced, strings are
 * scrubbed of tokens and of all but the outline of an email address, and long or deep
 * values are cut. Never throws, and never changes what it was given.
 */
export const redact = (value: unknown, depth = 0): unknown => {
	if (typeof value === "string") return scrub(value);
	if (value === null || typeof value !== "object") return typeof value === "bigint" ? String(value) : value;
	if (value instanceof Date) return value.toISOString();
	if (value instanceof Error) return redact(errorFields(value), depth);
	if (depth >= MAX_DEPTH) return "[deep]";
	if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => redact(item, depth + 1));
	const out: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value).slice(0, MAX_ITEMS)) {
		out[key] = SECRET_KEY.test(key) && item !== undefined && item !== null ? REDACTED : redact(item, depth + 1);
	}
	return out;
};

/** A server log line: JSON, with the standard fields first and everything redacted. */
export const log = (level: LogLevel, msg: string, fields: Record<string, unknown> = {}) => {
	const request = currentRequest();
	let line: string;
	try {
		line = JSON.stringify({
			time: new Date().toISOString(),
			level,
			msg,
			...(request ? { requestId: request.id } : {}),
			...(request?.userId ? { userId: request.userId } : {}),
			...(redact(fields) as Record<string, unknown>),
		});
	} catch {
		// A value JSON can't hold (a cycle): the event is still worth its line.
		line = JSON.stringify({ time: new Date().toISOString(), level, msg, unserializable: true });
	}
	// biome-ignore lint/suspicious/noConsole: the log's one writer; everything else calls log()
	if (level === "error") console.error(line);
	// biome-ignore lint/suspicious/noConsole: the log's one writer
	else if (level === "warn") console.warn(line);
	// biome-ignore lint/suspicious/noConsole: the log's one writer
	else console.info(line);
};

/** The deepest cause chain a line keeps. */
const MAX_CAUSES = 5;

const describe = (error: unknown): string => {
	if (!(error instanceof Error)) return String(error);
	const code = "code" in error && (typeof error.code === "string" || typeof error.code === "number") ? error.code : "";
	return `${error.name}: ${error.message}${code === "" ? "" : ` [${code}]`}`;
};

/**
 * An error for a log line: its message, its name when it has one of its own, and its
 * cause chain (Drizzle wraps the driver's error, whose message and SQLSTATE say what
 * happened). `stack: true` adds the stack, for a failure nobody expected; an expected
 * one (a refused call, a service that is down) is logged without it.
 */
export const errorFields = (error: unknown, { stack = false }: { stack?: boolean } = {}): Record<string, unknown> => {
	if (!(error instanceof Error)) return { error: String(error) };
	const causes: string[] = [];
	for (let cause = error.cause; cause !== undefined && cause !== null && causes.length < MAX_CAUSES; ) {
		causes.push(describe(cause));
		cause = cause instanceof Error ? cause.cause : undefined;
	}
	return {
		error: error.message,
		...(error.name && error.name !== "Error" ? { errorName: error.name } : {}),
		...(causes.length > 0 ? { causes } : {}),
		...(stack && error.stack ? { stack: error.stack } : {}),
	};
};
