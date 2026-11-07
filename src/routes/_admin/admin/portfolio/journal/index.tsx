import { createFileRoute } from "@tanstack/react-router";
import { PostList, PostsPending } from "@/features/portfolio/admin/components/post-list";
import { POSTS_TABLE_ID } from "@/features/portfolio/constants";
import { postList } from "@/features/portfolio/search";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/portfolio/journal/")({
	...listSearch(postList.search, postList.defaults),
	loaderDeps: ({ search }) => search,
	loader: async (route) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { postListQueryOptions } = await import("@/features/portfolio/admin/queries");
		return listLoader(route, { tableId: POSTS_TABLE_ID, query: postListQueryOptions });
	},
	head: titleHead(m.portfolio_admin_posts_title),
	pendingComponent: PostsPending,
	component: PostList,
});
