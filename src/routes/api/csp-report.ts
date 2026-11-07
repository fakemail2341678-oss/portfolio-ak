import { createFileRoute } from "@tanstack/react-router";
import { trustedClientIp } from "@/server/auth/client-ip";
import { createReportLimiter, handleCspReport, reportCspViolation } from "@/server/http/csp-report";

/** Per server instance: 10 reports a minute from one client, 100 in total (decision 0139). */
const limiter = createReportLimiter({ perClient: 10, total: 100 });

/**
 * /api/csp-report: where browsers send Content-Security-Policy violations
 * (the policy's report-to and report-uri, src/lib/http/csp.ts). Forwarded to Sentry
 * and the logs, rate-limited.
 */
export const Route = createFileRoute("/api/csp-report")({
	server: {
		handlers: {
			POST: ({ request }) =>
				handleCspReport(request, {
					client: trustedClientIp(request) ?? "unknown",
					limiter,
					report: reportCspViolation,
				}),
		},
	},
});
