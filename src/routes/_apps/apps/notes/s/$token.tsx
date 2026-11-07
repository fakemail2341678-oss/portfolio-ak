import { createFileRoute } from "@tanstack/react-router";
import { SharedNotePage } from "@/features/apps/notes/components/shared-note";
import { sharedNoteParamsSchema } from "@/features/apps/notes/search";
import { loadDetailOr404 } from "@/lib/crud/route";
import { parseParams } from "@/lib/list/params";
import { privateHead } from "@/lib/seo";
import { noindexHeaderMiddleware } from "@/middleware/robots";
import { m } from "@/paraglide/messages";

/**
 * /apps/notes/s/$token: a shared note, read only, for anyone with the link (decision
 * 0190). Never indexed: noindex in the head and in an X-Robots-Tag header.
 */
export const Route = createFileRoute("/_apps/apps/notes/s/$token")({
	params: { parse: (raw) => parseParams(sharedNoteParamsSchema, raw) },
	server: { middleware: [noindexHeaderMiddleware] },
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { sharedNoteQueryOptions } = await import("@/features/apps/notes/queries");
		return { title: (await loadDetailOr404(context.queryClient, sharedNoteQueryOptions(params.token))).title };
	},
	head: ({ loaderData }) => privateHead(loaderData?.title ?? m.notes_name()),
	component: SharedNotePage,
});
