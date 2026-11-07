import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CrudForm, crudFormKey, useCrudForm } from "@/components/crud/use-crud-form";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { DescriptionList } from "@/components/data-display/description-list";
import { formValidators, useAppForm } from "@/components/forms";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useCan } from "@/features/rbac/can";
import { formatDayMonth, formatNumber } from "@/lib/i18n/intl";
import { isoDate, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { TASKLINE_COLOR_LABELS } from "../../colors";
import { PROJECT_NAME_MAX } from "../../schema";
import {
	PROJECT_HEALTHS,
	PROJECT_STATUSES,
	PROJECT_VISIBILITIES,
	type ProjectHealth,
	type ProjectStatus,
	TASKLINE_COLORS,
} from "../../types";
import { ALL_TASKLINE_ADMIN, adminProjectKeys } from "../keys";
import { PROJECT_HEALTH, PROJECT_STATUS, VISIBILITY_LABELS } from "../labels";
import { adminProjectQueryOptions, memberOptionsQueryOptions, tasklineAdminMutations } from "../queries";
import type { AdminProjectDetail } from "../schema";

const route = getRouteApi("/_admin/admin/taskline/projects/$id/");

const formSchema = z.object({
	name: required({ max: PROJECT_NAME_MAX }),
	visibility: z.enum(PROJECT_VISIBILITIES),
	color: z.enum(TASKLINE_COLORS),
	startOn: z.union([z.literal(""), isoDate()]),
	targetOn: z.union([z.literal(""), isoDate()]),
});
type Values = z.input<typeof formSchema>;

const valuesOf = (project: AdminProjectDetail): Values => ({
	name: project.name,
	visibility: project.visibility,
	color: project.color,
	startOn: project.startOn ?? "",
	targetOn: project.targetOn ?? "",
});

function DetailsForm({ project }: { project: AdminProjectDetail }) {
	const crud = useCrudForm({
		item: { id: project.id, updatedAt: String(project.version) },
		toInput: (values: Values) => ({
			name: values.name,
			visibility: values.visibility,
			color: values.color,
			startOn: values.startOn || null,
			targetOn: values.targetOn || null,
		}),
		update: tasklineAdminMutations.updateProject(),
		invalidate: ALL_TASKLINE_ADMIN,
		reload: adminProjectKeys.detail(project.id),
	});
	const form = useAppForm({
		...formOptions({ defaultValues: valuesOf(project), validators: formValidators(formSchema) }),
		...crud.formProps,
	});
	return (
		<CrudForm form={form} crud={crud} data-testid="project-details-form">
			<FormSection title={m.taskline_admin_section_project()}>
				<form.AppField name="name">
					{(field) => (
						<field.TextField label={m.taskline_project_name()} maxLength={PROJECT_NAME_MAX} autoComplete="off" />
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
				<form.AppField name="startOn">
					{(field) => <field.DateField label={m.taskline_project_start()} optional />}
				</form.AppField>
				<form.AppField name="targetOn">
					{(field) => <field.DateField label={m.taskline_project_target()} optional />}
				</form.AppField>
			</FormSection>
			<StickyFormBar submitLabel={m.crud_save()} />
		</CrudForm>
	);
}

/** Status and health (saved at once) and the lead, handed to another member. */
function StateCard({ project, readOnly }: { project: AdminProjectDetail; readOnly: boolean }) {
	const id = useId();
	const { data: members } = useSuspenseQuery(memberOptionsQueryOptions());
	const [leadId, setLeadId] = useState(project.lead?.id ?? "");
	const state = useCrudMutation(tasklineAdminMutations.setProjectState(), { invalidate: ALL_TASKLINE_ADMIN });
	const transfer = useCrudMutation(tasklineAdminMutations.transferLead(), { invalidate: ALL_TASKLINE_ADMIN });
	const locked = readOnly || project.archived;
	return (
		<FormSection title={m.taskline_admin_section_state()} description={m.taskline_admin_section_state_hint()}>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="flex flex-col gap-2">
					<Label htmlFor={`${id}-status`}>{m.taskline_project_status()}</Label>
					<NativeSelect
						id={`${id}-status`}
						value={project.archived ? "archived" : project.status}
						disabled={locked || state.isPending}
						onChange={(event) =>
							state.mutate(
								{ id: project.id, status: event.target.value as Exclude<ProjectStatus, "archived"> },
								{ onSuccess: () => toast.success(m.crud_toast_saved()) },
							)
						}
						data-testid="project-status"
					>
						{PROJECT_STATUSES.filter((status) => status !== "archived" || project.archived).map((status) => (
							<option key={status} value={status} disabled={status === "archived"}>
								{PROJECT_STATUS[status].label()}
							</option>
						))}
					</NativeSelect>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor={`${id}-health`}>{m.taskline_project_health()}</Label>
					<NativeSelect
						id={`${id}-health`}
						value={project.health ?? ""}
						disabled={locked || state.isPending}
						onChange={(event) =>
							state.mutate(
								{ id: project.id, health: (event.target.value || null) as ProjectHealth | null },
								{ onSuccess: () => toast.success(m.crud_toast_saved()) },
							)
						}
						data-testid="project-health"
					>
						<option value="">{m.taskline_health_none()}</option>
						{PROJECT_HEALTHS.map((health) => (
							<option key={health} value={health}>
								{PROJECT_HEALTH[health].label()}
							</option>
						))}
					</NativeSelect>
				</div>
			</div>
			<form
				method="post"
				className="flex flex-wrap items-end gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					if (!leadId) return;
					transfer.mutate(
						{ id: project.id, memberId: leadId },
						{ onSuccess: () => toast.success(m.taskline_admin_toast_lead()) },
					);
				}}
			>
				<div className="flex min-w-56 flex-col gap-2">
					<Label htmlFor={`${id}-lead`}>{m.taskline_admin_col_lead()}</Label>
					<NativeSelect
						id={`${id}-lead`}
						value={leadId}
						onChange={(event) => setLeadId(event.target.value)}
						data-testid="project-lead"
					>
						<option value="" disabled>
							{m.taskline_admin_no_lead()}
						</option>
						{members.map((member) => (
							<option key={member.id} value={member.id}>
								{member.name}
							</option>
						))}
					</NativeSelect>
				</div>
				{readOnly ? null : (
					<Button
						type="submit"
						variant="outline"
						disabled={!leadId || leadId === project.lead?.id || transfer.isPending}
						data-testid="project-transfer-lead"
					>
						{m.taskline_admin_transfer_lead()}
					</Button>
				)}
			</form>
		</FormSection>
	);
}

/** The details tab: the project form (versioned), its state and lead, and its numbers. */
export function AdminProjectDetails() {
	const { id } = route.useParams();
	const { data: project } = useSuspenseQuery(adminProjectQueryOptions(id));
	const readOnly = !useCan("taskline:manage");
	return (
		<div className="flex flex-col gap-8">
			<DescriptionList
				items={[
					{ label: m.taskline_admin_count_tasks(), value: formatNumber(project.counts.tasks) },
					{ label: m.taskline_admin_count_done(), value: formatNumber(project.counts.done) },
					{ label: m.taskline_admin_col_open(), value: formatNumber(project.open) },
					{ label: m.taskline_admin_count_trashed(), value: formatNumber(project.counts.trashed) },
				]}
			/>
			<StateCard project={project} readOnly={readOnly} />
			{readOnly ? (
				<DescriptionList
					items={[
						{ label: m.taskline_project_name(), value: project.name },
						{ label: m.taskline_project_visibility(), value: VISIBILITY_LABELS[project.visibility]() },
						{ label: m.taskline_project_color(), value: TASKLINE_COLOR_LABELS[project.color]() },
						{ label: m.taskline_project_start(), value: project.startOn ? formatDayMonth(project.startOn) : "—" },
						{ label: m.taskline_project_target(), value: project.targetOn ? formatDayMonth(project.targetOn) : "—" },
					]}
				/>
			) : (
				<DetailsForm key={crudFormKey({ id: project.id, updatedAt: String(project.version) })} project={project} />
			)}
		</div>
	);
}
