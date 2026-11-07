import { formOptions } from "@tanstack/react-form";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import type { IsoDate } from "@/lib/i18n/date-only";
import { currency, isoDate } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { AMOUNT_MAX_MINOR, EXPENSE_NOTE_MAX } from "../schema";
import {
	EXPENSE_CURRENCIES,
	type ExpenseCategory,
	type ExpenseCurrency,
	type ExpenseItem,
	MINOR_UNITS,
	toMajor,
	toMinor,
} from "../types";

/** The category select's value for "no category" (Radix selects can't hold ""). */
const NONE = "none";

const expenseFormSchema = (today: IsoDate) =>
	z.object({
		amount: currency({ min: 1 / MINOR_UNITS, max: AMOUNT_MAX_MINOR / MINOR_UNITS }),
		currency: z.enum(EXPENSE_CURRENCIES),
		occurredOn: isoDate({ max: today }),
		categoryId: z.string(),
		note: z.string().trim().max(EXPENSE_NOTE_MAX),
	});
type ExpenseFormValues = z.input<ReturnType<typeof expenseFormSchema>>;

export type ExpenseDialogValues = Omit<ExpenseItem, "id">;

/**
 * Adding or editing an expense (decision 0192): the amount in its currency, the day
 * (not after today), a category and a note. `onSubmit` resolves once saved or rejects
 * (the form shows why). Loaded on click (decision 0168).
 */
export default function ExpenseDialog({
	expense,
	categories,
	today,
	defaultCurrency,
	onSubmit,
	onClose,
}: {
	expense?: ExpenseItem;
	categories: ReadonlyArray<ExpenseCategory>;
	today: IsoDate;
	defaultCurrency: ExpenseCurrency;
	onSubmit: (values: ExpenseDialogValues) => Promise<unknown>;
	onClose: () => void;
}) {
	const schema = expenseFormSchema(today);
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				amount: expense ? toMajor(expense.amountMinor) : undefined,
				currency: expense?.currency ?? defaultCurrency,
				occurredOn: expense?.occurredOn ?? today,
				categoryId: expense?.categoryId ?? NONE,
				note: expense?.note ?? "",
			} as ExpenseFormValues,
			validators: formValidators(schema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const parsed = schema.parse(value);
				await onSubmit({
					amountMinor: toMinor(parsed.amount),
					currency: parsed.currency,
					occurredOn: parsed.occurredOn,
					categoryId: parsed.categoryId === NONE ? null : parsed.categoryId,
					note: parsed.note,
				});
				formApi.reset(value);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const categoryOptions = [
		{ value: NONE, label: m.expenses_uncategorized() },
		...categories.map((category) => ({ value: category.id, label: category.name })),
	];
	return (
		<form.AppForm>
			<FormDialog
				title={expense ? m.expenses_edit() : m.expenses_add()}
				submitLabel={expense ? m.crud_save() : m.expenses_add()}
				onClose={onClose}
				data-testid="expense-dialog"
			>
				<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
					<form.Subscribe selector={(state) => state.values.currency}>
						{(selected) => (
							<form.AppField name="amount">
								{(field) => <field.CurrencyField label={m.expenses_field_amount()} currency={selected} />}
							</form.AppField>
						)}
					</form.Subscribe>
					<form.AppField name="currency">
						{(field) => (
							<field.SelectField
								label={m.expenses_field_currency()}
								options={EXPENSE_CURRENCIES.map((code) => ({ value: code, label: code }))}
							/>
						)}
					</form.AppField>
				</div>
				<form.AppField name="occurredOn">
					{(field) => <field.DateField label={m.expenses_field_date()} max={today} />}
				</form.AppField>
				<form.AppField name="categoryId">
					{(field) => <field.SelectField label={m.expenses_field_category()} options={categoryOptions} />}
				</form.AppField>
				<form.AppField name="note">
					{(field) => <field.TextField label={m.expenses_field_note()} optional maxLength={EXPENSE_NOTE_MAX} />}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
