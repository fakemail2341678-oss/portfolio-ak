import { formOptions } from "@tanstack/react-form";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { SortableListField } from "@/components/forms/fields/list-fields";
import { formatNumber } from "@/lib/i18n/intl";
import { required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { TASKLINE_COLOR_LABELS } from "../colors";
import { FIELD_NAME_MAX, type FieldDefinition, fieldOptions, newOptionId, OPTION_NAME_MAX } from "../fields";
import { FIELD_TYPE_LABELS } from "../labels";
import {
	FIELD_OPTIONS_MAX,
	FIELD_TYPES,
	type FieldOption,
	type FieldType,
	isChoiceType,
	TASKLINE_COLORS,
	type TaskField,
	type TasklineColor,
} from "../types";

/**
 * A custom field's form (Task 55; loaded when opened, 0168): its name, its type (only
 * when it's new: a type never changes), whether it's required, and a select's options
 * (renamed, recoloured, reordered, added and removed; each keeps its id, so renaming
 * keeps the values). Shared by the lead's settings and the admin, who save it their way.
 */

const fieldFormSchema = z
	.object({
		name: required({ max: FIELD_NAME_MAX }),
		type: z.enum(FIELD_TYPES),
		required: z.boolean(),
		options: z.array(z.object({ id: z.string(), name: z.string(), color: z.enum(TASKLINE_COLORS) })),
	})
	.superRefine((value, context) => {
		if (!isChoiceType(value.type)) return;
		const checked = fieldOptions().safeParse(value.options);
		if (checked.success) return;
		for (const issue of checked.error.issues) {
			context.addIssue({ code: "custom", path: ["options", ...issue.path], message: issue.message });
		}
	});

export default function FieldDialog({
	field,
	onSave,
	onClose,
}: {
	/** The field to edit; null: a new one. */
	field: TaskField | null;
	/** Saves it (the caller's mutation); a refusal's field errors land under the fields. */
	onSave: (definition: FieldDefinition) => Promise<void>;
	onClose: () => void;
}) {
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				name: field?.name ?? "",
				type: field?.type ?? ("select" as FieldType),
				required: field?.required ?? false,
				options:
					field?.options ??
					([
						{ id: newOptionId(), name: "", color: "gray" },
						{ id: newOptionId(), name: "", color: "blue" },
					] as FieldOption[]),
			},
			validators: formValidators(fieldFormSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			const base = { name: value.name.trim(), required: value.required };
			const definition = (
				isChoiceType(value.type)
					? {
							...base,
							type: value.type,
							options: value.options.map((option) => ({ ...option, name: option.name.trim() })),
						}
					: { ...base, type: value.type }
			) as FieldDefinition;
			try {
				await onSave(definition);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={field ? m.taskline_field_edit_title({ name: field.name }) : m.taskline_field_new()}
				description={m.taskline_field_dialog_description()}
				submitLabel={field ? m.crud_save() : m.taskline_field_create()}
				onClose={onClose}
				data-testid="field-dialog"
			>
				<form.AppField name="name">
					{(each) => <each.TextField label={m.taskline_field_name()} maxLength={FIELD_NAME_MAX} autoComplete="off" />}
				</form.AppField>
				{field ? (
					<p className="text-body text-muted-foreground">
						{m.taskline_field_type_fixed({ type: FIELD_TYPE_LABELS[field.type]() })}
					</p>
				) : (
					<form.AppField name="type">
						{(each) => (
							<each.SelectField
								label={m.taskline_field_type_label()}
								options={FIELD_TYPES.map((type) => ({ value: type, label: FIELD_TYPE_LABELS[type]() }))}
							/>
						)}
					</form.AppField>
				)}
				<form.AppField name="required">
					{(each) => (
						<each.CheckboxField label={m.taskline_field_required()} description={m.taskline_field_required_hint()} />
					)}
				</form.AppField>
				<form.Subscribe selector={(state) => state.values.type}>
					{(type) =>
						isChoiceType(type) ? (
							<form.AppField name="options" mode="array">
								{() => (
									<SortableListField<FieldOption>
										label={m.taskline_field_options()}
										addLabel={m.taskline_field_option_add()}
										newItem={() => ({ id: newOptionId(), name: "", color: "gray" })}
										max={FIELD_OPTIONS_MAX}
										getItemLabel={(option, index) =>
											option.name || m.taskline_field_option_n({ number: formatNumber(index + 1) })
										}
										renderItem={({ index }) => (
											<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
												<form.AppField name={`options[${index}].name`}>
													{(each) => (
														<each.TextField
															label={m.taskline_field_option_n({ number: formatNumber(index + 1) })}
															maxLength={OPTION_NAME_MAX}
															autoComplete="off"
														/>
													)}
												</form.AppField>
												<form.AppField name={`options[${index}].color`}>
													{(each) => (
														<each.SelectField
															label={m.taskline_project_color()}
															options={TASKLINE_COLORS.map((color: TasklineColor) => ({
																value: color,
																label: TASKLINE_COLOR_LABELS[color](),
															}))}
														/>
													)}
												</form.AppField>
											</div>
										)}
									/>
								)}
							</form.AppField>
						) : null
					}
				</form.Subscribe>
			</FormDialog>
		</form.AppForm>
	);
}
