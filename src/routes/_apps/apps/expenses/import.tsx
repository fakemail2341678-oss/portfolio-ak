import { createFileRoute, redirect } from "@tanstack/react-router";
import { ExpensesImportPage } from "@/features/apps/expenses/components/import-page";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /apps/expenses/import: a CSV file into expenses, mapped and previewed first (private). */
export const Route = createFileRoute("/_apps/apps/expenses/import")({
	beforeLoad: ({ context }) => {
		if (!context.session) throw redirect({ to: "/apps/expenses" });
		return { session: context.session };
	},
	head: () => privateHead(m.expenses_import_title()),
	component: ExpensesImportPage,
});
