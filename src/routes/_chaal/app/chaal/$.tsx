import { createFileRoute, notFound } from "@tanstack/react-router";

/**
 * Any other address under /app/chaal: Chaal's own 404, in its frame (the layout's
 * notFoundComponent), rather than the site's. Without this route nothing under
 * /app/chaal would match and the root's 404 would answer.
 */
export const Route = createFileRoute("/_chaal/app/chaal/$")({
	loader: () => {
		throw notFound();
	},
});
