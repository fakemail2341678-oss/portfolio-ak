import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { formatMoney } from "@/lib/i18n/currency";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { CategoryIcon } from "../kit/category-icon";
import { Money } from "../kit/money";
import type { BudgetPeriodView, BudgetView } from "../types";
import { budgetName, PERIOD_LABELS } from "./labels";
import type { BudgetState } from "./period";

/**
 * A budget's progress (Task 94), on Home and in Insights: a thin bar of what was spent
 * against the period's amount, with the state in words and an icon beside it, never
 * colour alone. Under 80% the bar is ink; near its limit ochre; at it or over, ochre and
 * hatched (the kit's "problem", 0281). Red is never money.
 */

const STATE: Record<BudgetState, { icon: typeof CircleCheckIcon; label: () => string; bar: string; text: string }> = {
	ok: { icon: CircleCheckIcon, label: () => m.kharcha_budget_state_ok(), bar: "bg-kh-ink/70", text: "text-kh-muted" },
	near: {
		icon: TriangleAlertIcon,
		label: () => m.kharcha_budget_state_near(),
		bar: "bg-kh-owe",
		text: "text-kh-owe",
	},
	over: {
		icon: CircleAlertIcon,
		label: () => m.kharcha_budget_state_over(),
		bar: "bg-kh-owe kh-hatch",
		text: "text-kh-owe",
	},
};

/**
 * The bar alone: a native <meter> for assistive tech (its name says which budget, its value
 * text what was spent of what), and a drawn bar beside it, since a meter's own look can't
 * be hatched.
 */
export function BudgetBar({
	name,
	period,
	currency,
	className,
}: {
	name: string;
	period: BudgetPeriodView;
	currency: string;
	className?: string;
}) {
	const state = STATE[period.state];
	return (
		<div className={cn("relative h-2 w-full", className)}>
			<meter
				className="sr-only"
				aria-label={name}
				min={0}
				max={Math.max(100, period.percent)}
				value={period.percent}
				aria-valuetext={m.kharcha_budget_meter({
					percent: formatNumber(period.percent),
					spent: formatMoney(period.spentMinor, currency),
					amount: formatMoney(period.amountMinor, currency),
				})}
			/>
			<div aria-hidden className="h-full w-full overflow-hidden rounded-full bg-kh-hair">
				<div className={cn("h-full rounded-full", state.bar)} style={{ width: `${Math.min(100, period.percent)}%` }} />
			</div>
		</div>
	);
}

/** One budget: its name and period, the bar, what was spent of what, and how it stands. */
export function BudgetMeter({ budget, className }: { budget: BudgetView; className?: string }) {
	const { current } = budget;
	const state = STATE[current.state];
	const left = current.amountMinor - current.spentMinor;
	const name = budgetName(budget);
	return (
		<div className={cn("flex flex-col gap-2", className)} data-testid="kharcha-budget-meter" data-state={current.state}>
			<div className="flex items-center gap-2">
				<CategoryIcon
					icon={budget.category?.icon ?? null}
					{...(budget.category ? { color: budget.category.color } : {})}
					size="sm"
				/>
				<p className="min-w-0 flex-1 truncate font-medium text-kh-ink">
					{name}
					<span className="font-normal text-kh-muted">{` · ${PERIOD_LABELS[budget.period]()}`}</span>
				</p>
				<p className="flex items-baseline gap-1 text-sm">
					<Money amountMinor={current.spentMinor} currency={budget.currency} />
					<span className="text-kh-muted">
						{m.kharcha_budget_of({ amount: formatMoney(current.amountMinor, budget.currency) })}
					</span>
				</p>
			</div>
			<BudgetBar name={name} period={current} currency={budget.currency} />
			<p className={cn("flex items-center gap-1.5 text-caption", state.text)}>
				<state.icon className="size-3.5 shrink-0" aria-hidden />
				<span>
					{state.label()}
					{" · "}
					{left >= 0
						? m.kharcha_budget_left({ amount: formatMoney(left, budget.currency) })
						: m.kharcha_budget_over_by({ amount: formatMoney(-left, budget.currency) })}
				</span>
			</p>
		</div>
	);
}
