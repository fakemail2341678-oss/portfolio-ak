import { formOptions } from "@tanstack/react-form";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { weekdayOf } from "@/lib/i18n/date-only";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { RecurrenceRule } from "../recurrence";
import {
	RECURRENCE_COUNT_MAX,
	RECURRENCE_FREQS,
	RECURRENCE_INTERVAL_MAX,
	type Recurrence,
	type RecurrenceFreq,
} from "../types";
import { weekdayName } from "./recurrence-text";

/**
 * A task's repeat (Task 56; loaded when opened): every so many days, weeks (on chosen
 * days), months or years, ending never, on a day, or after a number of tasks. Closing
 * the task creates the next one; the rule counts from its due day.
 */

const FREQ_LABELS: Record<RecurrenceFreq, () => string> = {
	daily: () => m.taskline_repeat_freq_daily(),
	weekly: () => m.taskline_repeat_freq_weekly(),
	monthly: () => m.taskline_repeat_freq_monthly(),
	yearly: () => m.taskline_repeat_freq_yearly(),
};

const recurrenceFormSchema = z
	.object({
		freq: z.enum(RECURRENCE_FREQS),
		interval: z.number().int().min(1).max(RECURRENCE_INTERVAL_MAX),
		weekdays: z.array(z.string()),
		ends: z.enum(["never", "on", "after"]),
		until: z.string(),
		count: z.number(),
	})
	.superRefine((value, context) => {
		if (value.freq === "weekly" && value.weekdays.length === 0) {
			context.addIssue({ code: "custom", path: ["weekdays"], message: m.taskline_repeat_error_days() });
		}
		if (value.ends === "on" && !/^\d{4}-\d{2}-\d{2}$/.test(value.until)) {
			context.addIssue({ code: "custom", path: ["until"], message: m.validation_required() });
		}
		if (
			value.ends === "after" &&
			!(Number.isInteger(value.count) && value.count >= 2 && value.count <= RECURRENCE_COUNT_MAX)
		) {
			context.addIssue({
				code: "custom",
				path: ["count"],
				message: m.taskline_repeat_error_count({ max: formatNumber(RECURRENCE_COUNT_MAX) }),
			});
		}
	});

export default function RecurrenceDialog({
	recurrence,
	dueOn,
	onSave,
	onClose,
}: {
	recurrence: Recurrence | null;
	/** The task's due day: a new weekly rule starts on its weekday. */
	dueOn: string | null;
	onSave: (rule: RecurrenceRule) => Promise<void>;
	onClose: () => void;
}) {
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				freq: recurrence?.freq ?? ("weekly" as RecurrenceFreq),
				interval: recurrence?.interval ?? 1,
				weekdays: (recurrence?.weekdays ?? (dueOn ? [weekdayOf(dueOn)] : [1])).map(String),
				ends: (recurrence?.until ? "on" : recurrence?.count ? "after" : "never") as "never" | "on" | "after",
				until: recurrence?.until ?? "",
				count: recurrence?.count ?? 10,
			},
			validators: formValidators(recurrenceFormSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			const rule: RecurrenceRule = {
				freq: value.freq,
				interval: value.interval,
				...(value.freq === "weekly" ? { weekdays: value.weekdays.map(Number).sort() } : {}),
				...(value.ends === "on" ? { until: value.until } : {}),
				...(value.ends === "after" ? { count: value.count } : {}),
			};
			try {
				await onSave(rule);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.taskline_repeat_title()}
				description={m.taskline_repeat_description()}
				submitLabel={m.crud_save()}
				onClose={onClose}
				data-testid="recurrence-dialog"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<form.AppField name="freq">
						{(each) => (
							<each.SelectField
								label={m.taskline_repeat_freq()}
								options={RECURRENCE_FREQS.map((freq) => ({ value: freq, label: FREQ_LABELS[freq]() }))}
							/>
						)}
					</form.AppField>
					<form.AppField name="interval">
						{(each) => <each.NumberField label={m.taskline_repeat_interval()} integer />}
					</form.AppField>
				</div>
				<form.Subscribe selector={(state) => state.values.freq}>
					{(freq) =>
						freq === "weekly" ? (
							<form.AppField name="weekdays">
								{(each) => (
									<each.CheckboxGroupField
										label={m.taskline_repeat_weekdays()}
										options={[0, 1, 2, 3, 4, 5, 6].map((day) => ({ value: String(day), label: weekdayName(day) }))}
									/>
								)}
							</form.AppField>
						) : null
					}
				</form.Subscribe>
				<form.AppField name="ends">
					{(each) => (
						<each.RadioGroupField
							label={m.taskline_repeat_ends()}
							options={[
								{ value: "never", label: m.taskline_repeat_ends_never() },
								{ value: "on", label: m.taskline_repeat_ends_on() },
								{ value: "after", label: m.taskline_repeat_ends_after() },
							]}
						/>
					)}
				</form.AppField>
				<form.Subscribe selector={(state) => state.values.ends}>
					{(ends) =>
						ends === "on" ? (
							<form.AppField name="until">
								{(each) => <each.DateField label={m.taskline_repeat_until_label()} />}
							</form.AppField>
						) : ends === "after" ? (
							<form.AppField name="count">
								{(each) => <each.NumberField label={m.taskline_repeat_count()} integer />}
							</form.AppField>
						) : null
					}
				</form.Subscribe>
			</FormDialog>
		</form.AppForm>
	);
}
