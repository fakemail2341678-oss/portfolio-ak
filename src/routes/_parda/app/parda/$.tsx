import { createFileRoute, notFound } from "@tanstack/react-router";

/**
 * Any other address under /app/parda: Parda's own 404, in its frame (the layout's
 * notFoundComponent), rather than the site's. Without this route nothing under
 * /app/parda would match and the root's 404 would answer.
 */
export const Route = createFileRoute("/_parda/app/parda/$")({
	loader: () => {
		throw notFound();
	},
});
