import { createFileRoute } from "@tanstack/react-router";
import { LinksHome } from "@/features/apps/links/components/links-home";
import { ensureQuery } from "@/lib/query";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /apps/links: the landing for visitors (indexable), the user's short links once they have a session. */
export const Route = createFileRoute("/_apps/apps/links/")({
	loader: async ({ context }) => {
		if (!context.session) return;
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { linksListQueryOptions } = await import("@/features/apps/links/queries");
		await ensureQuery(context.queryClient, linksListQueryOptions(context.session.user.id));
	},
	head: () => seo({ title: m.links_name(), description: m.links_seo_description(), path: "/apps/links" }),
	component: LinksHome,
});
