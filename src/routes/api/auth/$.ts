import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/server/auth/auth";
import { withTrustedClientIp } from "@/server/auth/client-ip";
import { defineApiRoute } from "@/server/http/api-route";

/**
 * Better Auth's HTTP API (/api/auth/*). Server-only: `server.handlers` never ships to the client.
 * Better Auth answers for itself (its own checks of the origin, its rate limits, its
 * errors); the route adds the request's scope and its log line.
 */
export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: defineApiRoute({
			name: "auth",
			methods: ["GET", "POST"],
			handler: ({ request }) => auth.handler(withTrustedClientIp(request)),
		}).handlers,
	},
});
