import { createFileRoute } from "@tanstack/react-router";
import { checkAppDatabase, healthResponse } from "@/server/db/health";

/**
 * /api/health: JSON for uptime monitors (200, or 503 when the database is
 * unreachable). The /health page is the human view of the same check.
 */
export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: async () => healthResponse(await checkAppDatabase()),
			HEAD: async () => healthResponse(await checkAppDatabase(), "HEAD"),
		},
	},
});
