import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { m } from "@/paraglide/messages";
import { kharchaLinks } from "../links";
import { kharchaExpenseQueryOptions } from "../queries";
import { useKharchaUserId } from "../shell/actions";
import { ExpensePanel } from "./expense-panel";

const route = getRouteApi("/_kharcha/app/kharcha/_shell/e/$expenseId");

/**
 * The expense page, /e/$expenseId (PLAN Task 89): what a reload, a shared link or a new tab
 * of the panel over Spend shows. An expense in the trash stays here, with Restore.
 */
export function ExpensePage() {
	const userId = useKharchaUserId();
	const { expenseId } = route.useParams();
	const { data: expense } = useSuspenseQuery(kharchaExpenseQueryOptions(userId, expenseId));
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col" data-testid="kharcha-expense-page">
			<header className="flex flex-col gap-2 border-kh-hair border-b bg-kh-page px-4 py-4 sm:px-8 md:py-5">
				<Link
					{...kharchaLinks.spend()}
					className="flex w-fit items-center gap-1 rounded-sm text-caption text-kh-muted underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					<ArrowLeftIcon className="size-3.5" aria-hidden />
					{m.kharcha_nav_spend()}
				</Link>
				<h1 className="kh-display text-kh-title wrap-anywhere">
					{expense.title || expense.merchant || m.kharcha_untitled()}
				</h1>
			</header>
			<div className="w-full max-w-2xl px-4 py-4 sm:px-8 sm:py-6">
				<div className="rounded-lg border border-kh-hair bg-kh-page p-4 sm:p-6">
					<ExpensePanel expense={expense} userId={userId} />
				</div>
			</div>
		</main>
	);
}
