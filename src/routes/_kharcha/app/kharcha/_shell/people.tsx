import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { kharchaHead } from "@/features/kharcha/brand";
import { PeoplePage } from "@/features/kharcha/people/people-page";
import { PEOPLE_SEARCH_DEFAULTS, peopleSearch } from "@/features/kharcha/search";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /app/kharcha/people: the caller's friends and groups, each with what is open with it; `?q=` searches them. */
export const Route = createFileRoute("/_kharcha/app/kharcha/_shell/people")({
	validateSearch: peopleSearch,
	search: { middlewares: [stripSearchParams(PEOPLE_SEARCH_DEFAULTS)] },
	loaderDeps: ({ search }) => ({ q: search.q, hidden: search.hidden === true }),
	loader: async ({ context, deps }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { kharchaPeopleQueryOptions } = await import("@/features/kharcha/queries");
		await ensureQuery(context.queryClient, kharchaPeopleQueryOptions(context.session.user.id, deps));
	},
	head: () => kharchaHead(m.kharcha_nav_people()),
	component: PeoplePage,
});
