import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { kharchaHead } from "@/features/kharcha/brand";
import { InsightsPage } from "@/features/kharcha/insights/insights-page";
import { INSIGHTS_TABS, insightsSearch, statementOf } from "@/features/kharcha/search";
import { parseParams } from "@/lib/list/params";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/**
 * /app/kharcha/insights/$tab (Task 94): the overview, budgets, trends and a statement of
 * the caller's own spending; `?month=`, `?currency=`, `?from=` and `?to=` choose what they
 * show. An unknown tab is a 404.
 */
export const Route = createFileRoute("/_kharcha/app/kharcha/_shell/insights/$tab")({
	params: { parse: (raw) => parseParams(z.object({ tab: z.enum(INSIGHTS_TABS) }), raw) },
	validateSearch: insightsSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, params, deps }) => {
		const queries = await import("@/features/kharcha/queries");
		const userId = context.session.user.id;
		const insights = { month: deps.month, currency: deps.currency };
		await Promise.all([
			ensureQuery(context.queryClient, queries.kharchaMeQueryOptions(userId)),
			params.tab === "overview"
				? ensureQuery(context.queryClient, queries.kharchaOverviewQueryOptions(userId, insights))
				: params.tab === "trends"
					? ensureQuery(context.queryClient, queries.kharchaTrendsQueryOptions(userId, insights))
					: params.tab === "statement"
						? ensureQuery(context.queryClient, queries.kharchaStatementQueryOptions(userId, statementOf(deps)))
						: Promise.all([
								ensureQuery(context.queryClient, queries.kharchaBudgetsQueryOptions(userId)),
								ensureQuery(context.queryClient, queries.kharchaListsQueryOptions(userId)),
							]),
		]);
	},
	head: () => kharchaHead(m.kharcha_nav_insights()),
	component: InsightsPage,
});
