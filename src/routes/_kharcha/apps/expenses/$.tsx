import { createFileRoute, redirect } from "@tanstack/react-router";
import { oldExpensesLink } from "@/features/kharcha/links";
import { oldExpensesSearch } from "@/features/kharcha/search";

/**
 * /apps/expenses and everything under it: the Expenses app moved into Kharcha (Task 95,
 * decision 0289), so its addresses redirect there, for good (301) where they had a page.
 * Inside the kharcha layer, so they outlive the apps layer.
 */
export const Route = createFileRoute("/_kharcha/apps/expenses/$")({
	validateSearch: oldExpensesSearch,
	beforeLoad: ({ params, search }) => {
		const { link, permanent } = oldExpensesLink(params._splat ?? "", search);
		throw redirect({ ...link, ...(permanent ? { statusCode: 301 } : {}) });
	},
});
