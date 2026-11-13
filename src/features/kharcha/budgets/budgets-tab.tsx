import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { deleteKharchaBudget } from "@/functions/kharcha/budgets";
import { formatMoney } from "@/lib/i18n/currency";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { KharchaEmpty } from "../kit/empty";
import {
	kharchaBudgetsQueryOptions,
	kharchaListsQueryOptions,
	kharchaMeQueryOptions,
	kharchaMutations,
	refreshKharcha,
} from "../queries";
import { useKharchaUserId } from "../shell/actions";
import type { BudgetView } from "../types";
import { BudgetBar, BudgetMeter } from "./budget-meter";
import { budgetName, periodDays } from "./labels";
import { daysLeft } from "./period";

const BudgetDialog = lazy(() => import("./budget-dialog"));

/**
 * Insights → Budgets (Task 94): the caller's budgets, each with how it stands this period
 * and the periods before it, and New budget, Edit and Delete. Alerts at 80% and 100% come
 * from the daily job, once each per period.
 */
export function BudgetsTab() {
	const userId = useKharchaUserId();
	const { data: budgets } = useSuspenseQuery(kharchaBudgetsQueryOptions(userId));
	const { data: lists } = useSuspenseQuery(kharchaListsQueryOptions(userId));
	const { data: me } = useSuspenseQuery(kharchaMeQueryOptions(userId));
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [dialog, setDialog] = useState<{ budget?: BudgetView } | null>(null);
	const change = useMutation({
		...kharchaMutations.budgets(queryClient, userId),
		onError: (error) => toast.error(errorMessage(error)),
	});
	const remove = async (budget: BudgetView) => {
		const ok = await confirm({
			title: m.kharcha_budget_delete_title({ name: budgetName(budget) }),
			description: m.kharcha_budget_delete_body(),
			confirmLabel: m.kharcha_settings_delete(),
			destructive: true,
		});
		if (ok) change.mutate(() => deleteKharchaBudget({ data: { budgetId: budget.id } }));
	};

	return (
		<div className="flex flex-col gap-4" data-testid="kharcha-budgets">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="max-w-prose text-kh-muted text-sm">{m.kharcha_budget_help()}</p>
				<Button onClick={() => setDialog({})} data-testid="kharcha-budget-new">
					<PlusIcon aria-hidden />
					{m.kharcha_budget_new()}
				</Button>
			</div>
			{budgets.length === 0 ? (
				<KharchaEmpty kind="budgets" className="rounded-lg border border-kh-hair bg-kh-page" />
			) : (
				<ul className="grid gap-3 lg:grid-cols-2">
					{budgets.map((budget) => (
						<li
							key={budget.id}
							className="flex flex-col gap-3 rounded-lg border border-kh-hair bg-kh-page p-4"
							data-testid="kharcha-budget"
						>
							<BudgetMeter budget={budget} />
							<p className="text-caption text-kh-muted">
								{periodDays(budget.current)}
								{" · "}
								{m.kharcha_budget_days_left({ count: formatNumber(daysLeft(budget.current, me.today)) })}
							</p>
							{budget.history.length > 0 ? (
								<details className="text-sm">
									<summary className="cursor-pointer text-kh-muted">{m.kharcha_budget_history()}</summary>
									<ul className="mt-2 flex flex-col gap-2">
										{budget.history.map((period) => (
											<li key={period.start} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2">
												<span className="truncate text-caption text-kh-muted">{periodDays(period)}</span>
												<BudgetBar
													name={`${budgetName(budget)}, ${periodDays(period)}`}
													period={period}
													currency={budget.currency}
												/>
												<span className="kh-figures text-caption">
													{formatMoney(period.spentMinor, budget.currency)}
												</span>
											</li>
										))}
									</ul>
								</details>
							) : null}
							<div className="flex justify-end gap-1">
								<Button variant="ghost" size="sm" onClick={() => setDialog({ budget })}>
									<PencilIcon aria-hidden />
									{m.kharcha_budget_edit_short()}
									<span className="sr-only">{` ${budgetName(budget)}`}</span>
								</Button>
								<Button variant="ghost" size="sm" onClick={() => void remove(budget)} disabled={change.isPending}>
									<Trash2Icon aria-hidden />
									{m.kharcha_settings_delete()}
									<span className="sr-only">{` ${budgetName(budget)}`}</span>
								</Button>
							</div>
						</li>
					))}
				</ul>
			)}
			{dialog ? (
				<Suspense fallback={null}>
					<BudgetDialog
						budget={dialog.budget}
						categories={lists.categories}
						currencies={me.currencies}
						homeCurrency={me.profile.homeCurrency}
						today={me.today}
						onSaved={(next) => {
							queryClient.setQueryData(kharchaBudgetsQueryOptions(userId).queryKey, next);
							void refreshKharcha(queryClient, userId);
						}}
						onClose={() => setDialog(null)}
					/>
				</Suspense>
			) : null}
		</div>
	);
}
