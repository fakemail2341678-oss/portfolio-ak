/**
 * GET /parda/api/{1-4}/movie/:id and /parda/api/{1-4}/tv/:id/:season/:episode: the placeholder
 * player (src/server/parda/player/placeholder.ts, decision 0230). Plays no video. A Nitro route
 * because it's a whole document with its own CSP, outside the app's pages.
 */
import { randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";
import { defineApiRoute } from "../http/api-route";
import { parsePlaceholderUrl, placeholderCsp, renderPlaceholder } from "../parda/player/placeholder";

export default defineApiRoute({
	name: "parda-player",
	methods: ["GET"],
	handler: ({ url }) => {
		const request = parsePlaceholderUrl(url);
		if (!request) throw new AppError("NOT_FOUND", "No such player page");
		const nonce = randomBytes(16).toString("base64");
		return new Response(renderPlaceholder(request, nonce), {
			headers: {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
				"content-security-policy": placeholderCsp(nonce),
				"x-robots-tag": "noindex",
			},
		});
	},
}).nitro;
