import { createFileRoute, redirect } from "@tanstack/react-router";
import { LinkPage } from "@/features/apps/links/components/link-page";
import { linkParamsSchema } from "@/features/apps/links/search";
import { loadDetailOr404 } from "@/lib/crud/route";
import { parseParams } from "@/lib/list/params";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /apps/links/$linkId: one of the user's links, its QR code and clicks (private; someone else's is a 404). */
export const Route = createFileRoute("/_apps/apps/links/$linkId")({
	// Only UUIDs match; anything else is the localized 404 without a round trip.
	params: { parse: (raw) => parseParams(linkParamsSchema, raw) },
	beforeLoad: ({ context }) => {
		if (!context.session) throw redirect({ to: "/apps/links" });
		return { session: context.session };
	},
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { linkStatsQueryOptions } = await import("@/features/apps/links/queries");
		const { link } = await loadDetailOr404(
			context.queryClient,
			linkStatsQueryOptions(context.session.user.id, params.linkId),
		);
		return { title: link.title || link.slug };
	},
	head: ({ loaderData }) => privateHead(loaderData?.title ?? m.links_name()),
	component: LinkPage,
});
