import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CrudForm, crudFormKey, useCrudForm } from "@/components/crud/use-crud-form";
import { formValidators, useAppForm } from "@/components/forms";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { formatNumber, formatWeekdayShort } from "@/lib/i18n/intl";
import { required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { MODE_LABELS, NOTIFY_KIND_LABELS, SENT_KINDS } from "../../notifications";
import { TEAM_SLUG_PATTERN } from "../../settings";
import { NOTIFY_MODES, PROJECT_VISIBILITIES } from "../../types";
import { ALL_TASKLINE_ADMIN, tasklineAdminKeys } from "../keys";
import { VISIBILITY_LABELS } from "../labels";
import { adminWorkspaceQueryOptions, tasklineAdminMutations } from "../queries";
import { type AdminWorkspace, type UpdateWorkspaceInput, updateWorkspaceInput } from "../schema";

const formSchema = z.object({
	name: required({ max: 60 }),
	slug: z
		.string()
		.trim()
		.toLowerCase()
		.regex(TEAM_SLUG_PATTERN, { error: () => m.taskline_admin_validation_slug() }),
	projectCreation: z.enum(["admins", "members"]),
	defaultVisibility: z.enum(PROJECT_VISIBILITIES),
	membersCanJoin: z.boolean(),
	workingDays: z.array(z.string()).min(1, { error: () => m.taskline_admin_error_working_days() }),
	weekStart: z.string(),
	timeZone: z.string().trim().min(1),
	digestHour: z.number().int().min(0).max(23),
	notify: z.record(z.string(), z.enum(NOTIFY_MODES)),
	trashRetentionDays: z.number().int().min(1).max(365),
	doneColumnDays: z.number().int().min(1).max(365),
	projects: z.number().int().positive(),
	tasks: z.number().int().positive(),
	statusesPerProject: z.number().int().positive(),
	timeEntries: z.number().int().positive(),
});
type Values = z.input<typeof formSchema>;

const valuesOf = ({ name, slug, settings }: AdminWorkspace): Values => ({
	name,
	slug,
	projectCreation: settings.projectCreation,
	defaultVisibility: settings.defaultVisibility,
	membersCanJoin: settings.membersCanJoin,
	workingDays: settings.workingDays.map(String),
	weekStart: String(settings.weekStart),
	timeZone: settings.timeZone,
	digestHour: settings.digestHour,
	notify: { ...settings.notify },
	trashRetentionDays: settings.trashRetentionDays,
	doneColumnDays: settings.doneColumnDays,
	...settings.quotas,
});

const toInput = (values: Values): Omit<UpdateWorkspaceInput, "updatedAt"> => {
	const { name, slug, projects, tasks, statusesPerProject, timeEntries, workingDays, weekStart, ...rest } =
		formSchema.parse(values);
	return updateWorkspaceInput.omit({ updatedAt: true }).parse({
		name,
		slug,
		settings: {
			...rest,
			workingDays: workingDays.map(Number).sort((a, b) => a - b),
			weekStart: Number(weekStart),
			quotas: { projects, tasks, statusesPerProject, timeEntries },
		},
	});
};

/** The days of the week, Sunday first, named in the page's language (5 January 2025 was a Sunday). */
const weekdays = () =>
	Array.from({ length: 7 }, (_, day) => ({
		value: String(day),
		label: formatWeekdayShort(new Date(Date.UTC(2025, 0, 5 + day, 12))),
	}));

function SettingsForm({ workspace }: { workspace: AdminWorkspace }) {
	const crud = useCrudForm({
		item: { id: workspace.id, updatedAt: workspace.updatedAt },
		toInput,
		update: tasklineAdminMutations.updateWorkspace(),
		invalidate: ALL_TASKLINE_ADMIN,
		reload: tasklineAdminKeys.workspace(),
	});
	const form = useAppForm({
		...formOptions({ defaultValues: valuesOf(workspace), validators: formValidators(formSchema) }),
		...crud.formProps,
	});
	const days = weekdays();
	const quota = (used: number) => m.taskline_admin_quota_used({ used: formatNumber(used) });
	return (
		<CrudForm form={form} crud={crud} data-testid="taskline-settings-form">
			<FormSection title={m.taskline_admin_section_workspace()} description={m.taskline_admin_section_workspace_hint()}>
				<form.AppField name="name">
					{(field) => <field.TextField label={m.taskline_admin_workspace_name()} maxLength={60} />}
				</form.AppField>
				<form.AppField name="slug">
					{(field) => (
						<field.TextField
							label={m.taskline_admin_workspace_slug()}
							description={m.taskline_admin_workspace_slug_hint()}
							maxLength={40}
							autoComplete="off"
						/>
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.taskline_admin_section_projects()}>
				<form.AppField name="projectCreation">
					{(field) => (
						<field.RadioGroupField
							label={m.taskline_admin_project_creation()}
							options={[
								{ value: "admins", label: m.taskline_admin_project_creation_admins() },
								{ value: "members", label: m.taskline_admin_project_creation_members() },
							]}
						/>
					)}
				</form.AppField>
				<form.AppField name="defaultVisibility">
					{(field) => (
						<field.SelectField
							label={m.taskline_admin_default_visibility()}
							options={PROJECT_VISIBILITIES.map((visibility) => ({
								value: visibility,
								label: VISIBILITY_LABELS[visibility](),
							}))}
						/>
					)}
				</form.AppField>
				<form.AppField name="membersCanJoin">
					{(field) => (
						<field.SwitchField
							label={m.taskline_admin_members_can_join()}
							description={m.taskline_admin_members_can_join_hint()}
						/>
					)}
				</form.AppField>
				<form.AppField name="doneColumnDays">
					{(field) => (
						<field.NumberField
							integer
							label={m.taskline_admin_done_days()}
							description={m.taskline_admin_done_days_hint()}
						/>
					)}
				</form.AppField>
				<form.AppField name="trashRetentionDays">
					{(field) => (
						<field.NumberField
							integer
							label={m.taskline_admin_trash_days()}
							description={m.taskline_admin_trash_days_hint()}
						/>
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.taskline_admin_section_calendar()} description={m.taskline_admin_section_calendar_hint()}>
				<form.AppField name="workingDays">
					{(field) => <field.CheckboxGroupField label={m.taskline_admin_working_days()} options={days} />}
				</form.AppField>
				<form.AppField name="weekStart">
					{(field) => <field.SelectField label={m.taskline_admin_week_start()} options={days} />}
				</form.AppField>
				<form.AppField name="timeZone">
					{(field) => (
						<field.TextField
							label={m.taskline_admin_time_zone()}
							description={m.taskline_admin_time_zone_hint()}
							autoComplete="off"
						/>
					)}
				</form.AppField>
				<form.AppField name="digestHour">
					{(field) => (
						<field.NumberField
							integer
							label={m.taskline_admin_digest_hour()}
							description={m.taskline_admin_digest_hour_hint()}
						/>
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.taskline_admin_section_notify()} description={m.taskline_admin_section_notify_hint()}>
				{SENT_KINDS.map((kind) => (
					<form.AppField key={kind} name={`notify.${kind}`}>
						{(field) => (
							<field.SelectField
								label={NOTIFY_KIND_LABELS[kind]()}
								options={NOTIFY_MODES.map((mode) => ({ value: mode, label: MODE_LABELS[mode]() }))}
							/>
						)}
					</form.AppField>
				))}
			</FormSection>
			<FormSection title={m.taskline_admin_section_quotas()} description={m.taskline_admin_section_quotas_hint()}>
				<form.AppField name="projects">
					{(field) => (
						<field.NumberField
							integer
							label={m.taskline_admin_quota_projects()}
							description={quota(workspace.usage.projects)}
						/>
					)}
				</form.AppField>
				<form.AppField name="tasks">
					{(field) => (
						<field.NumberField
							integer
							label={m.taskline_admin_quota_tasks()}
							description={quota(workspace.usage.tasks)}
						/>
					)}
				</form.AppField>
				<form.AppField name="statusesPerProject">
					{(field) => (
						<field.NumberField
							integer
							label={m.taskline_admin_quota_statuses()}
							description={quota(workspace.usage.statusesPerProject)}
						/>
					)}
				</form.AppField>
				<form.AppField name="timeEntries">
					{(field) => <field.NumberField integer label={m.taskline_admin_quota_time()} />}
				</form.AppField>
			</FormSection>
			<StickyFormBar submitLabel={m.crud_save()} />
		</CrudForm>
	);
}

/**
 * /admin/taskline/settings: the team workspace's name, its address (`/app/taskline/<slug>`),
 * who creates projects, the calendar its dates are read in, and its limits. Saved from the
 * version it opened at; a slug a page uses or a limit below what exists is refused.
 */
export function TasklineSettingsPage() {
	const { data: workspace } = useSuspenseQuery(adminWorkspaceQueryOptions());
	return (
		<Page width="admin" data-testid="taskline-admin-settings">
			<PageHeader title={m.taskline_admin_settings_title()} description={m.taskline_admin_settings_description()} />
			<SettingsForm key={crudFormKey({ id: workspace.id, updatedAt: workspace.updatedAt })} workspace={workspace} />
		</Page>
	);
}
