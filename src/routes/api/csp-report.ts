import { createFileRoute } from "@tanstack/react-router";
import { trustedClientIp } from "@/server/auth/client-ip";
import { defineApiRoute } from "@/server/http/api-route";
import { createReportLimiter, handleCspReport, reportCspViolation } from "@/server/http/csp-report";

/** Per server instance: 10 reports a minute from one client, 100 in total (decision 0139). */
const limiter = createReportLimiter({ perClient: 10, total: 100 });

/**
 * /api/csp-report: where browsers send Content-Security-Policy violations
 * (the policy's report-to and report-uri, src/lib/http/csp.ts). Forwarded to Sentry
 * and the logs, rate-limited. A browser reads nothing of the answer, so it has no
 * body: handleCspReport says 204, 400, 413, 415 or 429 by the status alone.
 */
export const Route = createFileRoute("/api/csp-report")({
	server: {
		handlers: defineApiRoute({
			name: "csp-report",
			methods: ["POST"],
			handler: ({ request }) =>
				handleCspReport(request, {
					client: trustedClientIp(request) ?? "unknown",
					limiter,
					report: reportCspViolation,
				}),
		}).handlers,
	},
});
