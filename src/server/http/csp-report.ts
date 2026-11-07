import "@tanstack/react-start/server-only";
import * as Sentry from "@sentry/tanstackstart-react";
import { log } from "@/server/log";

/**
 * CSP violation reports (decision 0139). Browsers POST them to CSP_REPORT_PATH (src/lib/http/csp.ts):
 * the Reporting API's `application/reports+json` (an array, sent for
 * `report-to`) or the older `application/csp-report` (one object, for
 * `report-uri`, which Firefox and Safari still use). Both are reduced to a
 * CspViolation, filtered, rate-limited and handed to `report` (Sentry + a log line).
 */

/** Largest report body read; real batches are a few kB. */
const MAX_BODY_BYTES = 64 * 1024;

export type CspViolation = {
	directive: string;
	/** "inline", "eval", a scheme ("data") or the blocked URL's origin + path. */
	blocked: string;
	/** Page the violation happened on (origin + path; no query or hash). */
	document: string;
	source?: string;
	line?: number;
	column?: number;
	disposition: "enforce" | "report";
	sample?: string;
};

type Body = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);
const integer = (value: unknown) => (typeof value === "number" && Number.isInteger(value) ? value : undefined);

/** Query strings and hashes can carry tokens or personal data; keep origin + path only. */
export const stripUrl = (value: string | undefined): string | undefined => {
	if (!value) return undefined;
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:" ? `${url.origin}${url.pathname}` : url.protocol;
	} catch {
		// Not a URL: "inline", "eval", "self"...
		return value;
	}
};

const violation = (fields: {
	directive: unknown;
	blocked: unknown;
	document: unknown;
	source: unknown;
	line: unknown;
	column: unknown;
	disposition: unknown;
	sample: unknown;
}): CspViolation | null => {
	const directive = text(fields.directive)?.split(" ")[0];
	const document = stripUrl(text(fields.document));
	if (!directive || !document) return null;
	const source = stripUrl(text(fields.source));
	const line = integer(fields.line);
	const column = integer(fields.column);
	const sample = text(fields.sample)?.slice(0, 120);
	return {
		directive,
		blocked: stripUrl(text(fields.blocked)) ?? "inline",
		document,
		...(source ? { source } : {}),
		...(line !== undefined ? { line } : {}),
		...(column !== undefined ? { column } : {}),
		disposition: fields.disposition === "report" ? "report" : "enforce",
		...(sample ? { sample } : {}),
	};
};

/** Reports from extensions and injected tooling are noise: the page didn't cause them. */
const NOISE = /^(?:chrome|moz|safari|safari-web|ms-browser)-extension:|^about:|^webkit-masked-url:/;
const isNoise = (report: CspViolation) => NOISE.test(report.blocked) || NOISE.test(report.source ?? "");

/** Turns a report body into violations: null when it isn't JSON, an empty list for unknown shapes. */
export function parseCspReports(contentType: string, raw: string): CspViolation[] | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	const found: Array<CspViolation | null> = [];
	if (contentType.includes("application/reports+json") && Array.isArray(parsed)) {
		for (const entry of parsed as Body[]) {
			if (entry?.type !== "csp-violation" || typeof entry.body !== "object" || entry.body === null) continue;
			const body = entry.body as Body;
			found.push(
				violation({
					directive: body.effectiveDirective,
					blocked: body.blockedURL,
					document: body.documentURL ?? entry.url,
					source: body.sourceFile,
					line: body.lineNumber,
					column: body.columnNumber,
					disposition: body.disposition,
					sample: body.sample,
				}),
			);
		}
	} else if (typeof parsed === "object" && parsed !== null && "csp-report" in parsed) {
		const body = (parsed as { "csp-report": Body })["csp-report"] ?? {};
		found.push(
			violation({
				directive: body["effective-directive"] ?? body["violated-directive"],
				blocked: body["blocked-uri"],
				document: body["document-uri"],
				source: body["source-file"],
				line: body["line-number"],
				column: body["column-number"],
				disposition: body.disposition,
				sample: body["script-sample"],
			}),
		);
	}
	return found.filter((report): report is CspViolation => report !== null && !isNoise(report));
}

/**
 * Fixed-window counters, per key and in total, kept in this server instance's
 * memory. Enough to keep one noisy client (or a flood) from using up the
 * Sentry quota; it is not a security control, so it needn't be shared
 * between instances.
 */
export function createReportLimiter({
	perClient,
	total,
	windowMs = 60_000,
	now = Date.now,
}: {
	perClient: number;
	total: number;
	windowMs?: number;
	now?: () => number;
}) {
	let windowStart = now();
	let used = 0;
	const byClient = new Map<string, number>();
	return {
		/** Takes `count` from the budget; how many of them may be reported. */
		take(client: string, count: number): number {
			if (now() - windowStart >= windowMs) {
				windowStart = now();
				used = 0;
				byClient.clear();
			}
			const clientUsed = byClient.get(client) ?? 0;
			const allowed = Math.max(0, Math.min(count, perClient - clientUsed, total - used));
			byClient.set(client, clientUsed + allowed);
			used += allowed;
			return allowed;
		},
	};
}

export type ReportLimiter = ReturnType<typeof createReportLimiter>;

const REPORT_TYPES = ["application/reports+json", "application/csp-report", "application/json"];

/**
 * The endpoint's logic. 204 when the body was read (even if every report was
 * noise or of an unknown shape), 429 once the client's budget is spent,
 * 413/415/400 for bodies that are too large, not a report type or not JSON. Nothing about the policy or the report is echoed back.
 */
export async function handleCspReport(
	request: Request,
	{ client, limiter, report }: { client: string; limiter: ReportLimiter; report: (violation: CspViolation) => void },
): Promise<Response> {
	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
	if (!REPORT_TYPES.some((type) => contentType.includes(type))) return new Response(null, { status: 415 });
	const declared = Number(request.headers.get("content-length") ?? 0);
	if (declared > MAX_BODY_BYTES) return new Response(null, { status: 413 });
	const raw = await request.text();
	if (raw.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

	const violations = parseCspReports(contentType, raw);
	if (!violations) return new Response(null, { status: 400 });
	if (violations.length === 0) return new Response(null, { status: 204 });
	const allowed = limiter.take(client, violations.length);
	for (const item of violations.slice(0, allowed)) report(item);
	return new Response(null, { status: allowed < violations.length ? 429 : 204 });
}

/**
 * One violation to the logs and, when Sentry is configured, as a warning event
 * grouped by directive and blocked resource (so a recurring violation is one
 * issue with a count, not thousands).
 */
export const reportCspViolation = (report: CspViolation) => {
	log("warn", "csp violation", report);
	Sentry.captureMessage(
		`CSP ${report.disposition === "report" ? "report-only " : ""}violation: ${report.directive} blocked ${report.blocked}`,
		{
			level: "warning",
			tags: { "csp.directive": report.directive, "csp.disposition": report.disposition },
			extra: report,
			fingerprint: ["csp-violation", report.directive, report.blocked],
		},
	);
};
