import { createFileRoute } from "@tanstack/react-router";
import { textResponse } from "@/server/seo/response";
import { robotsTxt } from "@/server/seo/robots";

/** /robots.txt (src/server/seo/robots.ts). */
export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: ({ request }) => textResponse(request, "/robots.txt", "text/plain", robotsTxt),
		},
	},
});
