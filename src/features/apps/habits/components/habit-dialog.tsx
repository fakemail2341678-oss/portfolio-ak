import { formOptions } from "@tanstack/react-form";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { APP_COLOR_LABELS, APP_COLORS, type AppColor } from "../../colors";
import { weekdayName } from "../format";
import { HABIT_NAME_MAX, type HabitFormValues, habitFormSchema } from "../schema";
import { daysMask, weekdaysOf } from "../streaks";
import { EVERY_DAY, HABIT_TARGET_MAX } from "../types";

export type HabitDialogValues = { name: string; color: AppColor; days: number; target: number };

/**
 * Making or editing a habit (decision 0193): its name, colour, the days of the week it
 * is meant for and how many check-ins a day count as done. Loaded on click (0168).
 */
export default function HabitDialog({
	habit,
	onSubmit,
	onClose,
}: {
	habit?: HabitDialogValues;
	onSubmit: (values: HabitDialogValues) => Promise<unknown>;
	onClose: () => void;
}) {
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				name: habit?.name ?? "",
				color: habit?.color ?? "green",
				weekdays: weekdaysOf(habit?.days ?? EVERY_DAY).map(String),
				target: habit?.target ?? 1,
			} as HabitFormValues,
			validators: formValidators(habitFormSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const parsed = habitFormSchema.parse(value);
				await onSubmit({
					name: parsed.name,
					color: parsed.color,
					days: daysMask(parsed.weekdays.map(Number)),
					target: parsed.target,
				});
				formApi.reset(value);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={habit ? m.habits_edit() : m.habits_new()}
				submitLabel={habit ? m.crud_save() : m.crud_create()}
				onClose={onClose}
				data-testid="habit-dialog"
			>
				<form.AppField name="name">
					{(field) => <field.TextField label={m.habits_field_name()} maxLength={HABIT_NAME_MAX} autoComplete="off" />}
				</form.AppField>
				<div className="grid gap-4 sm:grid-cols-2">
					<form.AppField name="color">
						{(field) => (
							<field.SelectField
								label={m.apps_field_color()}
								options={APP_COLORS.map((color) => ({ value: color, label: APP_COLOR_LABELS[color]() }))}
							/>
						)}
					</form.AppField>
					<form.AppField name="target">
						{(field) => (
							<field.NumberField
								label={m.habits_field_target()}
								description={m.habits_field_target_hint({ max: formatNumber(HABIT_TARGET_MAX) })}
								integer
							/>
						)}
					</form.AppField>
				</div>
				<form.AppField name="weekdays">
					{(field) => (
						<field.CheckboxGroupField
							label={m.habits_field_days()}
							options={[0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
								value: String(weekday),
								label: weekdayName(weekday),
							}))}
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
