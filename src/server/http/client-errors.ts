import "@tanstack/react-start/server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { log } from "../log";
import { type ReportLimiter, stripUrl } from "./csp-report";

/**
 * The browser's errors in the server log (decision 0300): what `POST /api/client-errors`
 * does with a report from src/lib/observability/client-errors.ts, when Sentry is off.
 *
 * A report is client input: its shape is checked, its lengths are capped, the page's
 * address loses its query and hash (they can carry tokens), and the log redacts the
 * rest. The line is "client error", at "error", with this request's id and, when the
 * error came from a server function, the id of the request that failed.
 */
export const clientErrorSchema = z.object({
	source: z.enum(["error", "unhandledrejection", "boundary"]),
	name: z.string().max(80).default("Error"),
	message: z.string().max(500),
	stack: z.string().max(4000).optional(),
	url: z.string().max(2000),
	requestId: z.string().max(64).optional(),
});

export type ClientErrorReport = z.output<typeof clientErrorSchema>;

/**
 * Logs one report, within the client's budget (a counter in this instance's memory,
 * as for CSP reports: it protects the log, not a secret). 204 when it was read.
 */
export function handleClientError(
	body: unknown,
	{ client, limiter, userAgent }: { client: string; limiter: ReportLimiter; userAgent: string | null },
): Response {
	const parsed = clientErrorSchema.safeParse(body);
	if (!parsed.success) throw parsed.error;
	if (limiter.take(client, 1) === 0) throw new AppError("RATE_LIMITED", "Too many error reports");
	const { requestId, url, ...report } = parsed.data;
	log("error", "client error", {
		...report,
		page: stripUrl(url),
		...(requestId ? { failedRequestId: requestId } : {}),
		...(userAgent ? { userAgent: userAgent.slice(0, 200) } : {}),
	});
	return new Response(null, { status: 204 });
}
