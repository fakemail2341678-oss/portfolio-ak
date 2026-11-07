import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/server/auth/auth";
import { withTrustedClientIp } from "@/server/auth/client-ip";

/** Better Auth's HTTP API (/api/auth/*). Server-only: `server.handlers` never ships to the client. */
export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => auth.handler(withTrustedClientIp(request)),
			POST: ({ request }) => auth.handler(withTrustedClientIp(request)),
		},
	},
});
