import { createFileRoute } from "@tanstack/react-router";
import { trustedClientIp } from "@/server/auth/client-ip";
import { defineApiRoute } from "@/server/http/api-route";
import { handleClientError } from "@/server/http/client-errors";
import { createReportLimiter } from "@/server/http/csp-report";

/** Per server instance: 10 reports a minute from one client, 200 in total. */
const limiter = createReportLimiter({ perClient: 10, total: 200 });

/**
 * /api/client-errors: where a page sends the errors of its own JavaScript when Sentry
 * is off (src/lib/observability/client-errors.ts, decision 0300). They go to the server
 * log, with the request's id. Our own pages only, a small body, a budget per client.
 */
export const Route = createFileRoute("/api/client-errors")({
	server: {
		handlers: defineApiRoute({
			name: "client-errors",
			methods: ["POST"],
			sameOrigin: true,
			bodyLimit: 8 * 1024,
			handler: async ({ request, json }) =>
				handleClientError(await json(), {
					client: trustedClientIp(request) ?? "unknown",
					limiter,
					userAgent: request.headers.get("user-agent"),
				}),
		}).handlers,
	},
});
