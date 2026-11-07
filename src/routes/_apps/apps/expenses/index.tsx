import { createFileRoute } from "@tanstack/react-router";
import { ExpensesHome } from "@/features/apps/expenses/components/expenses-home";
import { expensesSearchSchema } from "@/features/apps/expenses/search";
import { listSearch } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /apps/expenses: the landing for visitors (indexable), the user's month of spending once they have a session. */
export const Route = createFileRoute("/_apps/apps/expenses/")({
	...listSearch(expensesSearchSchema, expensesSearchSchema.parse({})),
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		if (!context.session) return;
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { expensesMonthQueryOptions } = await import("@/features/apps/expenses/queries");
		await ensureQuery(
			context.queryClient,
			expensesMonthQueryOptions(context.session.user.id, deps.month, deps.currency),
		);
	},
	head: () => seo({ title: m.expenses_name(), description: m.expenses_seo_description(), path: "/apps/expenses" }),
	component: ExpensesHome,
});
