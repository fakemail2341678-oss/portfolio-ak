import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { formValidators, handleSaveError, StaleVersionAlert, useAppForm } from "@/components/forms";
import { Form, FormErrorSummary } from "@/components/forms/form-components";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { isoDate, optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { TASKLINE_COLOR_LABELS } from "../colors";
import { projectTasksQueryOptions, tasklineKeys, tasklineMutations } from "../queries";
import { PROJECT_DESCRIPTION_MAX, PROJECT_NAME_MAX } from "../schema";
import {
	PROJECT_HEALTHS,
	PROJECT_STATUSES,
	PROJECT_VISIBILITIES,
	type ProjectDetail,
	type ProjectHealth,
	type ProjectStatus,
	SANDBOX_SEGMENT,
	TASKLINE_COLORS,
} from "../types";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/settings/general");

const STATUS_LABELS: Record<Exclude<ProjectStatus, "archived">, () => string> = {
	active: m.taskline_project_status_active,
	paused: m.taskline_project_status_paused,
	completed: m.taskline_project_status_completed,
};

const HEALTH_LABELS: Record<ProjectHealth, () => string> = {
	on_track: m.taskline_health_on_track,
	at_risk: m.taskline_health_at_risk,
	off_track: m.taskline_health_off_track,
};

const projectFormSchema = z.object({
	name: required({ max: PROJECT_NAME_MAX }),
	description: optionalText({ max: PROJECT_DESCRIPTION_MAX }),
	color: z.enum(TASKLINE_COLORS),
	visibility: z.enum(PROJECT_VISIBILITIES),
	startOn: z.union([z.literal(""), isoDate()]),
	targetOn: z.union([z.literal(""), isoDate()]),
	doneColumnDays: z.number().int().min(1).max(365).optional(),
	/** Task 52: sprints and the backlog, and what tasks are estimated in. */
	sprints: z.boolean(),
	estimation: z.enum(["points", "time"]),
	/** Task 53: the Time tab, a task's time and timer. */
	time: z.boolean(),
	/** Task 54: a blocked task can't be completed. */
	blockCompletionWhileBlocked: z.boolean(),
});
type ProjectFormValues = z.infer<typeof projectFormSchema>;

const toValues = (project: ProjectDetail): ProjectFormValues => ({
	name: project.name,
	description: project.description,
	color: project.color,
	visibility: project.visibility,
	startOn: project.startOn ?? "",
	targetOn: project.targetOn ?? "",
	doneColumnDays: project.settings.doneColumnDays ?? undefined,
	sprints: project.settings.sprints,
	estimation: project.settings.estimation,
	time: project.settings.time,
	blockCompletionWhileBlocked: project.settings.blockCompletionWhileBlocked,
});

/** General: the project form (saved against its version), its state and health, and the archive. */
export function GeneralSettings() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const userId = session.user.id;
	const { data } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const { project } = data;
	return (
		<div className="flex flex-col gap-8" data-testid="settings-general">
			<ProjectForm key={`${project.id}@${project.version}`} project={project} userId={userId} ws={ws} />
			<ProjectState project={project} userId={userId} ws={ws} />
		</div>
	);
}

function ProjectForm({ project, userId, ws }: { project: ProjectDetail; userId: string; ws: string }) {
	const queryClient = useQueryClient();
	const [stale, setStale] = useState(false);
	const save = useMutation(tasklineMutations.updateProject(queryClient, userId));
	const form = useAppForm({
		...formOptions({ defaultValues: toValues(project), validators: formValidators(projectFormSchema) }),
		onSubmit: async ({ value, formApi }) => {
			try {
				await save.mutateAsync({
					ws,
					key: project.key,
					version: project.version,
					name: value.name,
					description: value.description,
					color: value.color,
					visibility: value.visibility,
					startOn: value.startOn || null,
					targetOn: value.targetOn || null,
					settings: {
						doneColumnDays: value.doneColumnDays ?? null,
						sprints: value.sprints,
						estimation: value.estimation,
						time: value.time,
						blockCompletionWhileBlocked: value.blockCompletionWhileBlocked,
					},
				});
				toast.success(m.crud_toast_saved());
			} catch (error) {
				handleSaveError(formApi, error, () => setStale(true));
			}
		},
	});
	return (
		<form.AppForm>
			<Form className="flex max-w-3xl flex-col gap-6" data-testid="project-form">
				{stale ? (
					<StaleVersionAlert
						onReload={() =>
							queryClient.refetchQueries({ queryKey: tasklineKeys.project(userId, ws, project.key), type: "active" })
						}
					/>
				) : null}
				<FormErrorSummary />
				<FormSection title={m.taskline_settings_general()} description={m.taskline_settings_general_description()}>
					<form.AppField name="name">
						{(field) => <field.TextField label={m.taskline_project_name()} maxLength={PROJECT_NAME_MAX} />}
					</form.AppField>
					<form.AppField name="description">
						{(field) => <field.RichTextField label={m.taskline_field_description()} optional />}
					</form.AppField>
					<form.AppField name="color">
						{(field) => (
							<field.SelectField
								label={m.taskline_project_color()}
								options={TASKLINE_COLORS.map((color) => ({ value: color, label: TASKLINE_COLOR_LABELS[color]() }))}
							/>
						)}
					</form.AppField>
					{ws === SANDBOX_SEGMENT ? null : (
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
					)}
					<div className="grid gap-4 sm:grid-cols-2">
						<form.AppField name="startOn">
							{(field) => <field.DateField label={m.taskline_project_start()} optional />}
						</form.AppField>
						<form.AppField name="targetOn">
							{(field) => <field.DateField label={m.taskline_project_target()} optional />}
						</form.AppField>
					</div>
					<form.AppField name="doneColumnDays">
						{(field) => (
							<field.NumberField
								label={m.taskline_project_done_days()}
								description={m.taskline_project_done_days_hint()}
								optional
								integer
							/>
						)}
					</form.AppField>
				</FormSection>
				<FormSection title={m.taskline_settings_sprints()} description={m.taskline_settings_sprints_description()}>
					<form.AppField name="sprints">
						{(field) => (
							<field.SwitchField
								label={m.taskline_settings_sprints_on()}
								description={m.taskline_settings_sprints_on_hint()}
							/>
						)}
					</form.AppField>
					<form.AppField name="estimation">
						{(field) => (
							<field.SelectField
								label={m.taskline_settings_estimation()}
								description={m.taskline_settings_estimation_hint()}
								options={[
									{ value: "points", label: m.taskline_settings_estimation_points() },
									{ value: "time", label: m.taskline_settings_estimation_time() },
								]}
							/>
						)}
					</form.AppField>
				</FormSection>
				<FormSection title={m.taskline_settings_time()} description={m.taskline_settings_time_description()}>
					<form.AppField name="time">
						{(field) => (
							<field.SwitchField
								label={m.taskline_settings_time_on()}
								description={m.taskline_settings_time_on_hint()}
							/>
						)}
					</form.AppField>
				</FormSection>
				<FormSection
					title={m.taskline_settings_dependencies()}
					description={m.taskline_settings_dependencies_description()}
				>
					<form.AppField name="blockCompletionWhileBlocked">
						{(field) => (
							<field.SwitchField
								label={m.taskline_settings_block_completion()}
								description={m.taskline_settings_block_completion_hint()}
							/>
						)}
					</form.AppField>
				</FormSection>
				<StickyFormBar submitLabel={m.crud_save()} pendingLabel={m.crud_saving()} />
			</Form>
		</form.AppForm>
	);
}

/** State and health (last write wins), and archiving: read-only for everyone until restored. */
function ProjectState({ project, userId, ws }: { project: ProjectDetail; userId: string; ws: string }) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const state = useMutation(tasklineMutations.setProjectState(queryClient, userId));
	const archive = useMutation(tasklineMutations.setArchived(queryClient, userId));
	const fail = (error: Error) => toast.error(errorMessage(error));
	const id = useId();
	const toggleArchive = async () => {
		if (!project.archived) {
			const confirmed = await confirm({
				title: m.taskline_archive_title({ name: project.name }),
				description: m.taskline_archive_body(),
				confirmLabel: m.taskline_archive(),
			});
			if (!confirmed) return;
		}
		archive.mutate(
			{ ws, key: project.key, archived: !project.archived },
			{
				onSuccess: () =>
					toast.success(project.archived ? m.taskline_restored_project() : m.taskline_archived_project()),
				onError: fail,
			},
		);
	};
	return (
		<FormSection title={m.taskline_settings_state()} description={m.taskline_settings_state_description()}>
			<div className="grid max-w-xl gap-4 sm:grid-cols-2" data-testid="project-state">
				<div className="flex flex-col gap-1.5 text-body">
					<label htmlFor={`${id}-status`} className="font-medium">
						{m.taskline_project_status()}
					</label>
					<NativeSelect
						id={`${id}-status`}
						value={project.archived ? "" : project.status}
						disabled={project.archived || state.isPending}
						onChange={(event) =>
							state.mutate(
								{ ws, key: project.key, status: event.target.value as Exclude<ProjectStatus, "archived"> },
								{ onError: fail },
							)
						}
					>
						{project.archived ? <option value="">{m.taskline_project_archived()}</option> : null}
						{PROJECT_STATUSES.filter((status) => status !== "archived").map((status) => (
							<option key={status} value={status}>
								{STATUS_LABELS[status as Exclude<ProjectStatus, "archived">]()}
							</option>
						))}
					</NativeSelect>
				</div>
				<div className="flex flex-col gap-1.5 text-body">
					<label htmlFor={`${id}-health`} className="font-medium">
						{m.taskline_project_health()}
					</label>
					<NativeSelect
						id={`${id}-health`}
						value={project.health ?? ""}
						disabled={project.archived || state.isPending}
						onChange={(event) =>
							state.mutate(
								{ ws, key: project.key, health: (event.target.value || null) as ProjectHealth | null },
								{ onError: fail },
							)
						}
					>
						<option value="">{m.taskline_health_none()}</option>
						{PROJECT_HEALTHS.map((health) => (
							<option key={health} value={health}>
								{HEALTH_LABELS[health]()}
							</option>
						))}
					</NativeSelect>
				</div>
			</div>
			<div className="flex flex-col items-start gap-2 border-t pt-4">
				<p className="text-muted-foreground text-sm">
					{project.archived ? m.taskline_archived_explainer() : m.taskline_archive_explainer()}
				</p>
				<Button
					variant="outline"
					onClick={() => void toggleArchive()}
					disabled={archive.isPending}
					data-testid="project-archive"
				>
					{project.archived ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
					{project.archived ? m.taskline_restore_project() : m.taskline_archive()}
				</Button>
			</div>
		</FormSection>
	);
}
