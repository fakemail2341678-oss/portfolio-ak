import { formOptions } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE, formatNumber } from "@/lib/i18n/intl";
import { isoDate, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { TASKLINE_COLOR_LABELS } from "../colors";
import { tasklineLinks } from "../links";
import { createProjectMutation, templatesQueryOptions } from "../queries";
import { PROJECT_NAME_MAX, projectKey, suggestKey } from "../schema";
import {
	PROJECT_VISIBILITIES,
	type ProjectVisibility,
	SANDBOX_SEGMENT,
	TASKLINE_COLORS,
	type TasklineColor,
} from "../types";

const formSchema = z.object({
	name: required({ max: PROJECT_NAME_MAX }),
	key: projectKey(),
	visibility: z.enum(PROJECT_VISIBILITIES),
	color: z.enum(TASKLINE_COLORS),
	template: z.string(),
	startOn: isoDate(),
});

/**
 * "New project" (loaded on click, decision 0168): a name, the key its tasks are
 * numbered with (suggested from the name until typed), who sees it (team workspaces
 * only) and a colour. It opens with the workspace's default statuses, its creator as
 * lead; then the new project opens. Or it starts from a template (Task 57): its
 * statuses, fields, rules, milestones and sample tasks, their days counted from the start.
 */
export default function CreateProjectDialog({
	ws,
	userId,
	onClose,
}: {
	ws: string;
	userId: string;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const create = useMutation(createProjectMutation(queryClient, userId));
	const team = ws !== SANDBOX_SEGMENT;
	const { data: templates = [] } = useQuery(templatesQueryOptions(userId, ws));
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				name: "",
				key: "",
				visibility: "team" as ProjectVisibility,
				color: "teal" as TasklineColor,
				template: "",
				startOn: todayInZone(APP_TIME_ZONE),
			},
			validators: formValidators(formSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const project = await create.mutateAsync({
					ws,
					name: value.name.trim(),
					key: value.key.trim().toUpperCase(),
					color: value.color,
					...(value.template ? { template: value.template, startOn: value.startOn } : {}),
					...(team ? { visibility: value.visibility } : {}),
				});
				formApi.reset(value);
				onClose();
				await navigate(tasklineLinks.project(ws, project.key));
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.taskline_project_new()}
				description={m.taskline_project_new_description()}
				submitLabel={m.taskline_project_create()}
				onClose={onClose}
				data-testid="create-project-dialog"
			>
				<form.AppField
					name="name"
					listeners={{
						// Suggest a key while the key field is still untouched.
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
				<form.AppField name="key">
					{(field) => (
						<field.TextField
							label={m.taskline_project_key()}
							description={m.taskline_project_key_hint()}
							maxLength={6}
							autoComplete="off"
						/>
					)}
				</form.AppField>
				{team ? (
					<form.AppField name="visibility">
						{(field) => (
							<field.SelectField
								label={m.taskline_project_visibility()}
								options={[
									{ value: "team", label: m.taskline_visibility_team_long() },
									{ value: "private", label: m.taskline_visibility_private_long() },
								]}
							/>
						)}
					</form.AppField>
				) : null}
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
					{(chosen) => {
						const template = templates.find((each) => each.id === chosen);
						return template ? (
							<>
								<p className="text-caption text-muted-foreground" data-testid="template-summary">
									{template.description}{" "}
									{m.taskline_template_holds({
										statuses: formatNumber(template.counts.statuses),
										tasks: formatNumber(template.counts.tasks),
									})}
								</p>
								<form.AppField name="startOn">
									{(field) => (
										<field.DateField
											label={m.taskline_template_start()}
											description={m.taskline_template_start_hint()}
										/>
									)}
								</form.AppField>
							</>
						) : null;
					}}
				</form.Subscribe>
				<form.AppField name="color">
					{(field) => (
						<field.SelectField
							label={m.taskline_project_color()}
							options={TASKLINE_COLORS.map((color) => ({ value: color, label: TASKLINE_COLOR_LABELS[color]() }))}
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
