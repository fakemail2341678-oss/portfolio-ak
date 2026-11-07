import { createFileRoute, redirect } from "@tanstack/react-router";
import { ExpenseCategoriesPage } from "@/features/apps/expenses/components/categories-page";
import { ensureQuery } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /apps/expenses/categories: the user's categories (private). */
export const Route = createFileRoute("/_apps/apps/expenses/categories")({
	beforeLoad: ({ context }) => {
		if (!context.session) throw redirect({ to: "/apps/expenses" });
		return { session: context.session };
	},
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { expenseCategoriesQueryOptions } = await import("@/features/apps/expenses/queries");
		await ensureQuery(context.queryClient, expenseCategoriesQueryOptions(context.session.user.id));
	},
	head: () => privateHead(m.expenses_categories_title()),
	component: ExpenseCategoriesPage,
});
