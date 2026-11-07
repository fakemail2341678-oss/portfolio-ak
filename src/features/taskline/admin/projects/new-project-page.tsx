import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { CrudForm, useCrudForm } from "@/components/crud/use-crud-form";
import { formValidators, useAppForm } from "@/components/forms";
import { availabilityValidators } from "@/components/forms/async-validators";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import { isoDate, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { TASKLINE_COLOR_LABELS } from "../../colors";
import { PROJECT_KEY_PATTERN, PROJECT_NAME_MAX, projectKey, suggestKey } from "../../schema";
import { PROJECT_VISIBILITIES, TASKLINE_COLORS, type TasklineColor } from "../../types";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { VISIBILITY_LABELS } from "../labels";
import {
	adminTemplateChoicesQueryOptions,
	isProjectKeyFree,
	memberOptionsQueryOptions,
	tasklineAdminMutations,
} from "../queries";
import { type AdminCreateProjectInput, type AdminProjectDetail, adminCreateProjectInput } from "../schema";

const formSchema = z.object({
	name: required({ max: PROJECT_NAME_MAX }),
	key: projectKey(),
	leadId: z.string(),
	visibility: z.enum(PROJECT_VISIBILITIES),
	color: z.enum(TASKLINE_COLORS),
	template: z.string(),
	startOn: isoDate(),
});
type Values = z.input<typeof formSchema>;

/**
 * /admin/taskline/projects/new: a team project with the workspace's starting statuses,
 * led by a member the admin picks (or nobody yet). The key is checked while typing: one
 * in use, or a deleted project's, is refused (keys are never reused). A template (Task 57)
 * replaces the starting statuses and adds the rest of what it holds.
 */
export function NewAdminProjectPage() {
	const navigate = useNavigate();
	const { data: members } = useSuspenseQuery(memberOptionsQueryOptions());
	const { data: templates } = useSuspenseQuery(adminTemplateChoicesQueryOptions());
	const crud = useCrudForm({
		toInput: (values: Values): AdminCreateProjectInput =>
			adminCreateProjectInput.parse({
				...values,
				leadId: values.leadId || null,
				template: values.template || undefined,
				startOn: values.template ? values.startOn : undefined,
			}),
		create: tasklineAdminMutations.createProject(),
		invalidate: ALL_TASKLINE_ADMIN,
		// The create mutation returns the new project (useCrudForm types it with the update one, absent here).
		onSaved: (saved) =>
			navigate({ to: "/admin/taskline/projects/$id", params: { id: (saved as AdminProjectDetail).id } }),
	});
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				name: "",
				key: "",
				leadId: "",
				visibility: "team",
				color: "teal" as TasklineColor,
				template: "",
				startOn: todayInZone(APP_TIME_ZONE),
			} as Values,
			validators: formValidators(formSchema),
		}),
		...crud.formProps,
	});
	return (
		<Page width="admin" data-testid="taskline-admin-new-project">
			<PageHeader title={m.taskline_project_new()} description={m.taskline_admin_new_project_description()} />
			<CrudForm form={form} crud={crud}>
				<FormSection title={m.taskline_admin_section_project()}>
					<form.AppField
						name="name"
						listeners={{
							onChange: ({ value, fieldApi }) => {
								if (!fieldApi.form.getFieldMeta("key")?.isDirty)
									fieldApi.form.setFieldValue("key", suggestKey(value), { dontUpdateMeta: true });
							},
						}}
					>
						{(field) => (
							<field.TextField label={m.taskline_project_name()} maxLength={PROJECT_NAME_MAX} autoComplete="off" />
						)}
					</form.AppField>
					<form.AppField
						name="key"
						validators={availabilityValidators({
							isAvailable: (key) => isProjectKeyFree(key.trim().toUpperCase()),
							accepts: (key) => PROJECT_KEY_PATTERN.test(key.trim().toUpperCase()),
							message: m.taskline_admin_key_unavailable,
						})}
					>
						{(field) => (
							<field.TextField
								label={m.taskline_project_key()}
								description={m.taskline_admin_key_hint()}
								maxLength={6}
								autoComplete="off"
							/>
						)}
					</form.AppField>
					<form.AppField name="leadId">
						{(field) => (
							<field.SelectField
								label={m.taskline_admin_col_lead()}
								description={m.taskline_admin_lead_hint()}
								options={[
									{ value: "", label: m.taskline_admin_no_lead() },
									...members.map((member) => ({ value: member.id, label: member.name })),
								]}
							/>
						)}
					</form.AppField>
					<form.AppField name="visibility">
						{(field) => (
							<field.SelectField
								label={m.taskline_project_visibility()}
								options={PROJECT_VISIBILITIES.map((visibility) => ({
									value: visibility,
									label: VISIBILITY_LABELS[visibility](),
								}))}
							/>
						)}
					</form.AppField>
					<form.AppField name="color">
						{(field) => (
							<field.SelectField
								label={m.taskline_project_color()}
								options={TASKLINE_COLORS.map((color) => ({ value: color, label: TASKLINE_COLOR_LABELS[color]() }))}
							/>
						)}
					</form.AppField>
				</FormSection>
				<FormSection title={m.taskline_template_field()} description={m.taskline_template_section_hint()}>
					<form.AppField name="template">
						{(field) => (
							<field.SelectField
								label={m.taskline_template_field()}
								options={[
									{ value: "", label: m.taskline_template_blank() },
									...templates.map((template) => ({ value: template.id, label: template.name })),
								]}
							/>
						)}
					</form.AppField>
					<form.Subscribe selector={(state) => state.values.template}>
						{(chosen) =>
							chosen ? (
								<form.AppField name="startOn">
									{(field) => (
										<field.DateField
											label={m.taskline_template_start()}
											description={m.taskline_template_start_hint()}
										/>
									)}
								</form.AppField>
							) : null
						}
					</form.Subscribe>
				</FormSection>
				<StickyFormBar submitLabel={m.taskline_project_create()} />
			</CrudForm>
		</Page>
	);
}
