import { createFileRoute, notFound } from "@tanstack/react-router";
import { privateHead } from "@/lib/seo";
import { noindexHeaderMiddleware } from "@/middleware/robots";
import { shortLinkMiddleware } from "@/middleware/short-links";

/**
 * /l/$slug: a short link from the Links app (decision 0191). The middleware finds the
 * link; a link that may redirect now gets its 302 (the click counted in the
 * background); anything else (unknown, paused, expired, blocked, a guest's) falls
 * through to the app, where this route is always the localized 404. Never indexed
 * (X-Robots-Tag on both answers).
 *
 * Start falls through only to a route with a component, hence the empty one:
 * `beforeLoad` throws first, so it never renders.
 */
export const Route = createFileRoute("/l/$slug")({
	server: {
		middleware: [noindexHeaderMiddleware, shortLinkMiddleware],
		handlers: {
			GET: ({ context, next }) => context.shortLink ?? next(),
			HEAD: ({ context, next }) => context.shortLink ?? next(),
		},
	},
	beforeLoad: () => {
		throw notFound();
	},
	head: () => privateHead(),
	component: () => null,
});
