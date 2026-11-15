import { createFileRoute } from "@tanstack/react-router";
import { Public__Pascal__List, Public__Pascal__Pending } from "@/features/__name__/components/__name__-public-page";
import { __UPPER___PUBLIC_SEARCH_DEFAULTS, __camel__PublicSearchSchema } from "@/features/__name__/search";
import { listSearch } from "@/lib/crud/route";
import { loadList } from "@/lib/query";
import { listSeo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public/__name__/")({
	...listSearch(__camel__PublicSearchSchema, __UPPER___PUBLIC_SEARCH_DEFAULTS),
	loaderDeps: ({ search }) => search,
	// Awaited when entering (SSR: the list is in the HTML); a new search keeps the old results meanwhile.
	loader: async ({ context, deps, cause }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { public__Pascal__ListQueryOptions } = await import("@/features/__name__/queries");
		return loadList(context.queryClient, public__Pascal__ListQueryOptions(deps), cause);
	},
	head: ({ match }) =>
		listSeo({
			title: m.__snake___public_title(),
			description: m.__snake___public_description(),
			path: "/__name__",
			q: match.search.q,
			page: match.search.page,
		}),
	pendingComponent: Public__Pascal__Pending,
	component: Public__Pascal__List,
});
