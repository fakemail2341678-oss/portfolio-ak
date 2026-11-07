/**
 * GET /parda/api/{1-4}/movie/:id and /parda/api/{1-4}/tv/:id/:season/:episode: the placeholder
 * player (src/server/parda/player/placeholder.ts, decision 0230). Plays no video. A Nitro route
 * because it's a whole document with its own CSP, outside the app's pages.
 */
import { randomBytes } from "node:crypto";
import { defineHandler } from "nitro";
import { parsePlaceholderUrl, placeholderCsp, renderPlaceholder } from "../parda/player/placeholder";

export default defineHandler((event) => {
	const request = parsePlaceholderUrl(new URL(event.req.url));
	if (!request) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
	const nonce = randomBytes(16).toString("base64");
	return new Response(renderPlaceholder(request, nonce), {
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
			"content-security-policy": placeholderCsp(nonce),
			"x-robots-tag": "noindex",
		},
	});
});
