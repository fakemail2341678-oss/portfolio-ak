import { createMiddleware } from "@tanstack/react-start";

/**
 * Request middleware for a route's `server.middleware`: the response says "noindex"
 * in its headers too, not only in a meta tag (decisions 0190, 0191). For pages anyone
 * can open with a link that must never be indexed (a shared note) and for responses
 * that have no HTML head (the short-link redirect).
 */
export const noindexHeaderMiddleware = createMiddleware().server(async ({ next }) => {
	const result = await next();
	result.response.headers.set("x-robots-tag", "noindex, nofollow");
	return result;
});
