import { createFileRoute } from "@tanstack/react-router";
import { checkAppDatabase, healthResponse } from "@/server/db/health";
import { defineApiRoute } from "@/server/http/api-route";

/**
 * /api/health: JSON for uptime monitors (200, or 503 when the database is
 * unreachable). The /health page is the human view of the same check.
 */
export const Route = createFileRoute("/api/health")({
	server: {
		handlers: defineApiRoute({
			name: "health",
			methods: ["GET", "HEAD"],
			handler: async ({ request }) =>
				healthResponse(await checkAppDatabase(), request.method === "HEAD" ? "HEAD" : "GET"),
		}).handlers,
	},
});
