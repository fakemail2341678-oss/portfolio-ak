import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { kharchaHead } from "@/features/kharcha/brand";
import { SPEND_SEARCH_DEFAULTS, spendSearch } from "@/features/kharcha/search";
import { SpendPage } from "@/features/kharcha/spend/spend-page";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/**
 * /app/kharcha/spend: the caller's spending, this month by default, on the URL list
 * contract. `?expense=` opens one in the panel (a masked route showing /e/$expenseId), so
 * it isn't one of the loader's deps: opening the panel never reloads the list.
 */
export const Route = createFileRoute("/_kharcha/app/kharcha/_shell/spend")({
	validateSearch: spendSearch,
	search: { middlewares: [stripSearchParams(SPEND_SEARCH_DEFAULTS)] },
	loaderDeps: ({ search: { expense: _expense, ...list } }) => list,
	loader: async ({ context, deps }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const [{ kharchaListsQueryOptions, kharchaSpendQueryOptions }, { spendInput }] = await Promise.all([
			import("@/features/kharcha/queries"),
			import("@/features/kharcha/spend/input"),
		]);
		const userId = context.session.user.id;
		await Promise.all([
			ensureQuery(context.queryClient, kharchaSpendQueryOptions(userId, spendInput({ ...deps, expense: undefined }))),
			ensureQuery(context.queryClient, kharchaListsQueryOptions(userId)),
		]);
	},
	head: () => kharchaHead(m.kharcha_nav_spend()),
	component: SpendPage,
});
