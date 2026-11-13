import { formOptions, useStore } from "@tanstack/react-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { repeatKharchaExpense, updateKharchaRecurring } from "@/functions/kharcha/recurring";
import { addDays, isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate } from "@/lib/i18n/intl";
import { isoDate } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { cadenceLabel, UNIT_LABELS } from "../budgets/labels";
import type { RecurringView } from "../types";
import { firstOnOrAfter, RECURRING_EVERY_MAX, RECURRING_UNITS, type RecurringUnit } from "./cadence";

/**
 * "Repeat…" (Task 94, lazy): an expense made again every n weeks, months or years from its
 * day, until an end date if one is set; or a recurring expense's cadence and end. The next
 * one is said as it is chosen ("Next on 5 Dec 2026").
 */

const schema = z.object({
	unit: z.enum(RECURRING_UNITS),
	every: z.number().int().min(1).max(RECURRING_EVERY_MAX),
	ends: z.boolean(),
	endsOn: z.union([isoDate(), z.literal("")]),
});

type Props = {
	/** "Repeat…" on this expense, from its day; or edit this recurring expense. */
	from: { expenseId: string; spentOn: string } | { recurring: RecurringView };
	today: string;
	onSaved: (recurring: RecurringView[]) => void;
	onClose: () => void;
};

const day = (value: string) => formatDate(isoDateInstant(value), { dateStyle: "medium", timeZone: "UTC" });

export default function RepeatDialog({ from, today, onSaved, onClose }: Props) {
	const existing = "recurring" in from ? from.recurring : null;
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				unit: (existing?.unit ?? "month") as RecurringUnit,
				every: existing?.every ?? 1,
				ends: Boolean(existing?.endsOn),
				endsOn: existing?.endsOn ?? "",
			},
			validators: formValidators(schema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const cadence = {
					unit: value.unit,
					every: value.every,
					endsOn: value.ends && value.endsOn ? value.endsOn : null,
				};
				onSaved(
					existing
						? await updateKharchaRecurring({
								data: { recurringId: existing.id, version: existing.version, ...cadence },
							})
						: await repeatKharchaExpense({
								data: { expenseId: (from as { expenseId: string }).expenseId, ...cadence },
							}),
				);
				toast.success(m.kharcha_recurring_saved());
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const start = existing ? (existing.lastMadeOn ?? existing.startsOn) : (from as { spentOn: string }).spentOn;
	const every = Number.isInteger(values.every) && values.every >= 1 ? values.every : 1;
	const unchanged = existing && existing.unit === values.unit && existing.every === every;
	// The next one is after today and after the day it counts from, as the server works it out.
	const after = start > today ? start : today;
	const next = unchanged ? existing.nextOn : firstOnOrAfter(start, { unit: values.unit, every }, addDays(after, 1)).on;
	return (
		<form.AppForm>
			<FormDialog
				title={existing ? m.kharcha_recurring_edit() : m.kharcha_recurring_repeat()}
				description={m.kharcha_recurring_description()}
				submitLabel={m.kharcha_settings_save()}
				onClose={onClose}
				className="sm:max-w-lg"
				data-testid="kharcha-repeat-dialog"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<form.AppField name="every">
						{(field) => <field.NumberField label={m.kharcha_recurring_every()} integer />}
					</form.AppField>
					<form.AppField name="unit">
						{(field) => (
							<field.SelectField
								label={m.kharcha_recurring_unit()}
								options={RECURRING_UNITS.map((value) => ({ value, label: UNIT_LABELS[value]() }))}
							/>
						)}
					</form.AppField>
				</div>
				<form.AppField name="ends">
					{(field) => <field.CheckboxField label={m.kharcha_recurring_ends()} />}
				</form.AppField>
				{values.ends ? (
					<form.AppField name="endsOn">
						{(field) => <field.DateField label={m.kharcha_recurring_ends_on()} />}
					</form.AppField>
				) : null}
				<p className="text-kh-muted text-sm" aria-live="polite" data-testid="kharcha-repeat-next">
					{cadenceLabel(values.unit, every)}
					{" · "}
					{values.ends && values.endsOn && next > values.endsOn
						? m.kharcha_recurring_none_before_end()
						: m.kharcha_recurring_next({ day: day(next) })}
				</p>
			</FormDialog>
		</form.AppForm>
	);
}
