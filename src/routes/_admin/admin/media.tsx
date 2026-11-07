import { createFileRoute } from "@tanstack/react-router";
import { MediaLibrary } from "@/features/media/components/media-library";
import { mediaList } from "@/features/media/search";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/media")({
	...listSearch(mediaList.search, mediaList.defaults),
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "media:read"),
	loaderDeps: ({ search }) => search,
	loader: async (route) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { mediaListQueryOptions } = await import("@/features/media/queries");
		return listLoader(route, { tableId: "media", query: mediaListQueryOptions });
	},
	staticData: { breadcrumb: staticCrumb(m.media_title) },
	head: titleHead(m.media_title),
	component: MediaLibrary,
});
