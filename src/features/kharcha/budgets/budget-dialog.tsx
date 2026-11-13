import { formOptions, useStore } from "@tanstack/react-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { createKharchaBudget, setKharchaBudgetMonth, updateKharchaBudget } from "@/functions/kharcha/budgets";
import { CURRENCIES, currencyLabel, toMajor, toMinor } from "@/lib/i18n/currency";
import { formatMonthYear } from "@/lib/i18n/intl";
import { isoDate } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import type { BudgetView, CategoryView } from "../types";
import { budgetName, PERIOD_LABELS } from "./labels";
import { BUDGET_PERIODS, type BudgetPeriod, periodOf } from "./period";

/**
 * A budget's form (Task 94, lazy): new (a category or everything, a currency, a period, its
 * amount and its first day) or an existing one's amount and first day, and for a monthly
 * one, this month's own amount (empty: the budget's amount). Each save answers with all the
 * caller's budgets.
 */

const EVERYTHING = "*";

const positive = z
	.number({ error: () => m.kharcha_error_amount() })
	.positive({ error: () => m.kharcha_error_amount() });

const schema = z.object({
	categoryId: z.string(),
	currency: z.enum(CURRENCIES),
	period: z.enum(BUDGET_PERIODS),
	amount: positive,
	startsOn: isoDate(),
	monthAmount: z.number().nonnegative().optional(),
});

type Props = {
	/** Editing this one; else a new budget. */
	budget?: BudgetView | undefined;
	categories: ReadonlyArray<CategoryView>;
	currencies: ReadonlyArray<string>;
	homeCurrency: string;
	today: string;
	onSaved: (budgets: BudgetView[]) => void;
	onClose: () => void;
};

export default function BudgetDialog({ budget, categories, currencies, homeCurrency, today, onSaved, onClose }: Props) {
	const month = today.slice(0, 7);
	const own = budget?.months.find((each) => each.month === month);
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				categoryId: budget?.category?.id ?? EVERYTHING,
				currency: (budget?.currency ?? homeCurrency) as (typeof CURRENCIES)[number],
				period: (budget?.period ?? "month") as BudgetPeriod,
				amount: budget ? toMajor(budget.amountMinor, budget.currency) : (undefined as unknown as number),
				startsOn: budget?.startsOn ?? periodOf("month", today).start,
				monthAmount: own && budget ? toMajor(own.amountMinor, budget.currency) : undefined,
			} as z.input<typeof schema>,
			validators: formValidators(schema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const amountMinor = toMinor(value.amount, value.currency);
				let saved = budget
					? await updateKharchaBudget({
							data: { budgetId: budget.id, version: budget.version, amountMinor, startsOn: value.startsOn },
						})
					: await createKharchaBudget({
							data: {
								categoryId: value.categoryId === EVERYTHING ? null : value.categoryId,
								currency: value.currency,
								period: value.period,
								amountMinor,
								startsOn: value.startsOn,
							},
						});
				if (budget && budget.period === "month") {
					const monthMinor = value.monthAmount ? toMinor(value.monthAmount, value.currency) : null;
					if (monthMinor !== (own?.amountMinor ?? null)) {
						saved = await setKharchaBudgetMonth({
							data: { budgetId: budget.id, month, amountMinor: monthMinor },
						});
					}
				}
				onSaved(saved);
				toast.success(m.kharcha_budget_saved());
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const currency = useStore(form.store, (state) => state.values.currency);
	return (
		<form.AppForm>
			<FormDialog
				title={budget ? m.kharcha_budget_edit({ name: budgetName(budget) }) : m.kharcha_budget_new()}
				description={m.kharcha_budget_description()}
				submitLabel={m.kharcha_settings_save()}
				onClose={onClose}
				className="sm:max-w-lg"
				data-testid="kharcha-budget-dialog"
			>
				{budget ? null : (
					<>
						<form.AppField name="categoryId">
							{(field) => (
								<field.SelectField
									label={m.kharcha_field_category()}
									options={[
										{ value: EVERYTHING, label: m.kharcha_budget_everything() },
										...categories
											.filter((category) => !category.archived)
											.map((category) => ({ value: category.id, label: category.name })),
									]}
								/>
							)}
						</form.AppField>
						<div className="grid gap-4 sm:grid-cols-2">
							<form.AppField name="period">
								{(field) => (
									<field.SelectField
										label={m.kharcha_budget_period()}
										options={BUDGET_PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value]() }))}
									/>
								)}
							</form.AppField>
							<form.AppField name="currency">
								{(field) => (
									<field.SelectField
										label={m.kharcha_field_currency()}
										options={currencies.map((code) => ({ value: code, label: currencyLabel(code) }))}
									/>
								)}
							</form.AppField>
						</div>
					</>
				)}
				<div className="grid gap-4 sm:grid-cols-2">
					<form.AppField name="amount">
						{(field) => <field.CurrencyField label={m.kharcha_budget_amount()} currency={currency} />}
					</form.AppField>
					<form.AppField name="startsOn">
						{(field) => <field.DateField label={m.kharcha_budget_starts()} />}
					</form.AppField>
				</div>
				{budget?.period === "month" ? (
					<form.AppField name="monthAmount">
						{(field) => (
							<field.CurrencyField
								label={m.kharcha_budget_month_amount({
									month: formatMonthYear(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 15)),
								})}
								description={m.kharcha_budget_month_help()}
								optional
								currency={currency}
							/>
						)}
					</form.AppField>
				) : null}
			</FormDialog>
		</form.AppForm>
	);
}
