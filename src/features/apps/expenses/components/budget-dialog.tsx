import { formOptions } from "@tanstack/react-form";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { choice, currency } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { formatMonth } from "../format";
import { AMOUNT_MAX_MINOR } from "../schema";
import { type ExpenseCategory, type ExpenseCurrency, MINOR_UNITS, toMajor, toMinor } from "../types";

const budgetFormSchema = z.object({
	categoryId: choice(),
	amount: currency({ min: 1 / MINOR_UNITS, max: AMOUNT_MAX_MINOR / MINOR_UNITS }),
});
type BudgetFormValues = z.input<typeof budgetFormSchema>;

/**
 * Setting a category's budget for the month and currency on screen (decision 0192).
 * Editing one keeps its category. Loaded on click (decision 0168).
 */
export default function BudgetDialog({
	budget,
	categories,
	month,
	currency: selected,
	onSubmit,
	onClose,
}: {
	budget?: { categoryId: string; amountMinor: number };
	categories: ReadonlyArray<ExpenseCategory>;
	month: string;
	currency: ExpenseCurrency;
	onSubmit: (values: { categoryId: string; amountMinor: number }) => Promise<unknown>;
	onClose: () => void;
}) {
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				categoryId: budget?.categoryId ?? "",
				amount: budget ? toMajor(budget.amountMinor) : undefined,
			} as BudgetFormValues,
			validators: formValidators(budgetFormSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const parsed = budgetFormSchema.parse(value);
				await onSubmit({ categoryId: parsed.categoryId, amountMinor: toMinor(parsed.amount) });
				formApi.reset(value);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const name = categories.find((category) => category.id === budget?.categoryId)?.name;
	return (
		<form.AppForm>
			<FormDialog
				title={name ? m.expenses_budget_edit({ category: name }) : m.expenses_budget_set()}
				description={m.expenses_budget_for({ month: formatMonth(month), currency: selected })}
				submitLabel={m.crud_save()}
				onClose={onClose}
				data-testid="budget-dialog"
			>
				{budget ? null : (
					<form.AppField name="categoryId">
						{(field) => (
							<field.SelectField
								label={m.expenses_field_category()}
								options={categories.map((category) => ({ value: category.id, label: category.name }))}
							/>
						)}
					</form.AppField>
				)}
				<form.AppField name="amount">
					{(field) => <field.CurrencyField label={m.expenses_field_budget()} currency={selected} />}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
