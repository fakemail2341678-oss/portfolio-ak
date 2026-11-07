import { formOptions } from "@tanstack/react-form";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FormSheet } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { SortableListField } from "@/components/forms/fields/list-fields";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import {
	AUTOMATION_COMMENT_MAX,
	AUTOMATION_MESSAGE_MAX,
	AUTOMATION_NAME_MAX,
	type AutomationDefinition,
} from "../automation-rules";
import { fieldFilterChoices } from "../fields";
import { CATEGORY_LABELS, PRIORITY_LABELS, TYPE_LABELS } from "../labels";
import {
	AUTOMATION_ACTIONS,
	AUTOMATION_ACTIONS_MAX,
	AUTOMATION_CONDITIONS,
	AUTOMATION_CONDITIONS_MAX,
	AUTOMATION_TRIGGERS,
	type Automation,
	STATUS_CATEGORIES,
	TASK_PRIORITIES,
	TASK_TYPES,
} from "../types";
import type { AutomationPreviewSource } from "./automations-editor";
import {
	ACTION_LABELS,
	ASSIGN_TARGETS,
	type AutomationOptions,
	CONDITION_LABELS,
	NOTIFY_TARGETS,
	TARGET_LABELS,
	TRIGGER_LABELS,
} from "./describe";
import {
	type ActionForm,
	ANY,
	automationFormSchema,
	type ConditionForm,
	newAction,
	newCondition,
	previewConditions,
	toDefinition,
	toForm,
} from "./form";

/**
 * The automation builder (Task 56; loaded when opened, 0168): a name, on or off, when
 * it runs (a trigger and what narrows it), the conditions every task must meet, and
 * up to ten actions in order (each sortable by keyboard). Beside the conditions, how
 * many open tasks they match now. Shared by the lead's settings and the admin, who
 * save it their way; a workspace rule is offered only what every project shares.
 */

export type AutomationSave = (definition: AutomationDefinition, version: number | null) => Promise<void>;

export default function AutomationDialog({
	automation,
	options,
	preview,
	onSave,
	onClose,
}: {
	/** The rule to edit; null: a new one. */
	automation: Automation | null;
	options: AutomationOptions;
	/** The preview over the project's open tasks, or the team's. */
	preview: AutomationPreviewSource;
	onSave: AutomationSave;
	onClose: () => void;
}) {
	const [stale, setStale] = useState(false);
	const form = useAppForm({
		...formOptions({ defaultValues: toForm(automation), validators: formValidators(automationFormSchema) }),
		onSubmit: async ({ value, formApi }) => {
			try {
				await onSave(toDefinition(value), automation?.version ?? null);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error, () => setStale(true));
			}
		},
	});
	const workspace = options.scope === "workspace";
	const statusChoices = [
		...options.statuses.map((status) => ({ value: `s:${status.id}`, label: status.name })),
		...STATUS_CATEGORIES.map((category) => ({
			value: `c:${category}`,
			label: m.taskline_automation_category_choice({ category: CATEGORY_LABELS[category]() }),
		})),
	];
	const labelChoices = options.labels.map((label) => ({ value: label.id, label: label.name }));
	const people = options.members.filter((member) => !member.deactivated);
	const priorityChoices = [...TASK_PRIORITIES].reverse().map((priority) => ({
		value: String(priority),
		label: PRIORITY_LABELS[priority](),
	}));

	const actionStatuses = workspace ? statusChoices.filter((choice) => choice.value.startsWith("c:")) : statusChoices;

	const conditionRow = (index: number) => {
		const name = `conditions[${index}]` as const;
		return (
			<div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
				<form.AppField name={`${name}.type`}>
					{(each) => (
						<each.SelectField
							label={m.taskline_automation_condition_kind()}
							options={AUTOMATION_CONDITIONS.map((type) => ({ value: type, label: CONDITION_LABELS[type]() }))}
						/>
					)}
				</form.AppField>
				<form.Subscribe selector={(state) => state.values.conditions[index]?.type}>
					{(type) => {
						switch (type) {
							case "task_type":
							case "priority":
							case "category":
								return (
									<form.AppField name={`${name}.values`}>
										{(each) => (
											<each.CheckboxGroupField
												label={m.taskline_automation_any_of()}
												options={
													type === "task_type"
														? TASK_TYPES.map((value) => ({ value, label: TYPE_LABELS[value]() }))
														: type === "priority"
															? priorityChoices
															: STATUS_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value]() }))
												}
											/>
										)}
									</form.AppField>
								);
							case "label":
								return (
									<div className="grid gap-3 sm:grid-cols-2">
										<form.AppField name={`${name}.has`}>
											{(each) => (
												<each.SelectField
													label={m.taskline_automation_label_has()}
													options={[
														{ value: "has", label: m.taskline_automation_label_has_yes() },
														{ value: "lacks", label: m.taskline_automation_label_has_no() },
													]}
												/>
											)}
										</form.AppField>
										<form.AppField name={`${name}.labelId`}>
											{(each) => <each.SelectField label={m.taskline_field_labels()} options={labelChoices} />}
										</form.AppField>
									</div>
								);
							case "assignee":
								return (
									<form.AppField name={`${name}.is`}>
										{(each) => (
											<each.SelectField
												label={m.taskline_field_assignee()}
												options={[
													{ value: "any", label: m.taskline_automation_assignee_any() },
													{ value: "none", label: m.taskline_unassigned() },
													...people.map((member) => ({ value: member.id, label: member.name })),
												]}
											/>
										)}
									</form.AppField>
								);
							case "field":
								return fieldCondition(index);
							default:
								return null;
						}
					}}
				</form.Subscribe>
			</div>
		);
	};

	const fieldCondition = (index: number) => {
		const name = `conditions[${index}]` as const;
		const fields = options.fields.filter((field) => !field.archived);
		if (fields.length === 0)
			return <p className="text-body text-muted-foreground">{m.taskline_automation_no_fields()}</p>;
		return (
			<div className="grid gap-3 sm:grid-cols-2">
				<form.AppField name={`${name}.fieldId`} listeners={{ onChange: () => form.setFieldValue(`${name}.value`, "") }}>
					{(each) => (
						<each.SelectField
							label={m.taskline_automation_condition_field()}
							options={fields.map((field) => ({ value: field.id, label: field.name }))}
						/>
					)}
				</form.AppField>
				<form.Subscribe selector={(state) => state.values.conditions[index]?.fieldId}>
					{(fieldId) => {
						const field = fields.find((each) => each.id === fieldId);
						return field ? (
							<form.AppField name={`${name}.value`}>
								{(each) => (
									<each.SelectField
										label={m.taskline_automation_field_value()}
										options={fieldFilterChoices(field, options.members, { member: false })}
									/>
								)}
							</form.AppField>
						) : null;
					}}
				</form.Subscribe>
			</div>
		);
	};

	const actionRow = (index: number) => {
		const name = `actions[${index}]` as const;
		const personChoices = people.map((member) => ({ value: member.id, label: member.name }));
		return (
			<div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
				<form.AppField name={`${name}.type`}>
					{(each) => (
						<each.SelectField
							label={m.taskline_automation_action_kind()}
							options={AUTOMATION_ACTIONS.map((type) => ({ value: type, label: ACTION_LABELS[type]() }))}
						/>
					)}
				</form.AppField>
				<form.Subscribe selector={(state) => state.values.actions[index]?.type}>
					{(type) => {
						switch (type) {
							case "set_status":
								return (
									<form.AppField name={`${name}.status`}>
										{(each) => <each.SelectField label={m.taskline_field_status()} options={actionStatuses} />}
									</form.AppField>
								);
							case "assign":
								return (
									<form.AppField name={`${name}.to`}>
										{(each) => (
											<each.SelectField
												label={m.taskline_automation_assign_to()}
												options={[
													...ASSIGN_TARGETS.map((value) => ({ value, label: TARGET_LABELS[value]() })),
													...personChoices,
												]}
											/>
										)}
									</form.AppField>
								);
							case "notify":
								return (
									<div className="flex flex-col gap-3">
										<form.AppField name={`${name}.to`}>
											{(each) => (
												<each.SelectField
													label={m.taskline_automation_notify_who()}
													options={[
														...NOTIFY_TARGETS.map((value) => ({ value, label: TARGET_LABELS[value]() })),
														...personChoices,
													]}
												/>
											)}
										</form.AppField>
										<form.AppField name={`${name}.message`}>
											{(each) => (
												<each.TextField
													label={m.taskline_automation_message()}
													optional
													maxLength={AUTOMATION_MESSAGE_MAX}
													autoComplete="off"
												/>
											)}
										</form.AppField>
									</div>
								);
							case "set_priority":
								return (
									<form.AppField name={`${name}.priority`}>
										{(each) => <each.SelectField label={m.taskline_field_priority()} options={priorityChoices} />}
									</form.AppField>
								);
							case "add_label":
							case "remove_label":
								return labelChoices.length > 0 ? (
									<form.AppField name={`${name}.labelId`}>
										{(each) => <each.SelectField label={m.taskline_field_labels()} options={labelChoices} />}
									</form.AppField>
								) : (
									<p className="text-body text-muted-foreground">{m.taskline_automation_no_labels()}</p>
								);
							case "set_sprint":
								return (
									<form.AppField name={`${name}.to`}>
										{(each) => (
											<each.SelectField
												label={m.taskline_field_sprint()}
												options={[
													{ value: "active", label: m.taskline_automation_sprint_active() },
													{ value: "none", label: m.taskline_backlog_section() },
													...options.sprints.map((sprint) => ({ value: sprint.id, label: sprint.name })),
												]}
											/>
										)}
									</form.AppField>
								);
							case "set_due":
								return (
									<form.AppField name={`${name}.days`}>
										{(each) => (
											<each.NumberField
												label={m.taskline_automation_due_in()}
												description={m.taskline_automation_due_in_hint()}
												integer
											/>
										)}
									</form.AppField>
								);
							case "comment":
								return (
									<form.AppField name={`${name}.text`}>
										{(each) => (
											<each.TextareaField
												label={m.taskline_automation_comment_text()}
												maxLength={AUTOMATION_COMMENT_MAX}
												rows={3}
											/>
										)}
									</form.AppField>
								);
							case "subtasks":
								return (
									<form.AppField name={`${name}.titles`}>
										{(each) => (
											<each.TextareaField
												label={m.taskline_automation_subtask_titles()}
												description={m.taskline_automation_subtask_titles_hint()}
												rows={4}
											/>
										)}
									</form.AppField>
								);
							default:
								return null;
						}
					}}
				</form.Subscribe>
			</div>
		);
	};

	return (
		<form.AppForm>
			<FormSheet
				title={automation ? m.taskline_automation_edit_title({ name: automation.name }) : m.taskline_automation_new()}
				description={workspace ? m.taskline_automation_dialog_workspace() : m.taskline_automation_dialog_project()}
				submitLabel={automation ? m.crud_save() : m.taskline_automation_create()}
				className="sm:max-w-2xl"
				stale={stale ? async () => onClose() : undefined}
				onClose={onClose}
				data-testid="automation-dialog"
			>
				<form.AppField name="name">
					{(each) => (
						<each.TextField label={m.taskline_automation_name()} maxLength={AUTOMATION_NAME_MAX} autoComplete="off" />
					)}
				</form.AppField>
				<form.AppField name="enabled">
					{(each) => <each.SwitchField label={m.taskline_automation_enabled()} />}
				</form.AppField>

				<fieldset className="flex flex-col gap-4 rounded-md border p-4">
					<legend className="px-1 font-medium text-body">{m.taskline_automation_section_when()}</legend>
					<form.AppField name="trigger.type">
						{(each) => (
							<each.SelectField
								label={m.taskline_automation_trigger()}
								options={AUTOMATION_TRIGGERS.map((type) => ({ value: type, label: TRIGGER_LABELS[type]() }))}
							/>
						)}
					</form.AppField>
					<form.Subscribe selector={(state) => state.values.trigger.type}>
						{(type) =>
							type === "status_changed" ? (
								<form.AppField name="trigger.status">
									{(each) => (
										<each.SelectField
											label={m.taskline_automation_into()}
											options={[{ value: ANY, label: m.taskline_automation_any_status() }, ...statusChoices]}
										/>
									)}
								</form.AppField>
							) : type === "priority_changed" ? (
								<form.AppField name="trigger.priority">
									{(each) => (
										<each.SelectField
											label={m.taskline_automation_to_priority()}
											options={[{ value: ANY, label: m.taskline_automation_any_priority() }, ...priorityChoices]}
										/>
									)}
								</form.AppField>
							) : type === "label_added" ? (
								<form.AppField name="trigger.labelId">
									{(each) => (
										<each.SelectField
											label={m.taskline_automation_which_label()}
											options={[{ value: ANY, label: m.taskline_automation_any_label() }, ...labelChoices]}
										/>
									)}
								</form.AppField>
							) : type === "due_soon" ? (
								<form.AppField name="trigger.days">
									{(each) => <each.NumberField label={m.taskline_automation_days_before()} integer />}
								</form.AppField>
							) : null
						}
					</form.Subscribe>
					<form.Subscribe selector={(state) => state.values.trigger.type}>
						{(type) =>
							type === "due_soon" || type === "overdue" ? (
								<p className="text-caption text-muted-foreground">{m.taskline_automation_daily_note()}</p>
							) : null
						}
					</form.Subscribe>
				</fieldset>

				<fieldset className="flex flex-col gap-4 rounded-md border p-4">
					<legend className="px-1 font-medium text-body">{m.taskline_automation_section_if()}</legend>
					<form.AppField name="conditions" mode="array">
						{() => (
							<SortableListField<ConditionForm>
								label={m.taskline_automation_conditions()}
								description={m.taskline_automation_conditions_hint()}
								optional
								addLabel={m.taskline_automation_condition_add()}
								newItem={() => newCondition()}
								max={AUTOMATION_CONDITIONS_MAX}
								getItemLabel={(_, index) => m.taskline_automation_condition_n({ number: formatNumber(index + 1) })}
								renderItem={({ index }) => conditionRow(index)}
							/>
						)}
					</form.AppField>
					<form.Subscribe selector={(state) => state.values.conditions}>
						{(rows) => <PreviewLine rows={rows} preview={preview} />}
					</form.Subscribe>
				</fieldset>

				<fieldset className="flex flex-col gap-4 rounded-md border p-4">
					<legend className="px-1 font-medium text-body">{m.taskline_automation_section_then()}</legend>
					<form.AppField name="actions" mode="array">
						{() => (
							<SortableListField<ActionForm>
								label={m.taskline_automation_actions()}
								description={m.taskline_automation_actions_hint({ max: formatNumber(AUTOMATION_ACTIONS_MAX) })}
								addLabel={m.taskline_automation_action_add()}
								newItem={() => newAction()}
								max={AUTOMATION_ACTIONS_MAX}
								getItemLabel={(_, index) => m.taskline_automation_action_n({ number: formatNumber(index + 1) })}
								renderItem={({ index }) => actionRow(index)}
							/>
						)}
					</form.AppField>
				</fieldset>
			</FormSheet>
		</form.AppForm>
	);
}

/** "Would match 12 open tasks now", from the conditions as they stand (a moment after the last change). */
function PreviewLine({ rows, preview }: { rows: ConditionForm[]; preview: AutomationPreviewSource }) {
	const conditions = useDebouncedValue(previewConditions(rows), 400);
	const { data } = useQuery({
		queryKey: [...preview.queryKey, conditions],
		queryFn: () => preview.run(conditions),
		placeholderData: keepPreviousData,
		staleTime: 30_000,
	});
	return (
		<p className="text-body text-muted-foreground" aria-live="polite" data-testid="automation-preview">
			{data
				? data.capped
					? m.taskline_automation_preview_capped({ count: formatNumber(data.count) })
					: m.taskline_automation_preview({ count: formatNumber(data.count) })
				: m.taskline_automation_preview_loading()}
		</p>
	);
}
