import { formOptions } from "@tanstack/react-form";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon, PlusIcon, RotateCcwIcon, TagIcon, Trash2Icon, XIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Timeline } from "@/components/data-display/activity-feed";
import { CopyButton } from "@/components/data-display/copy-button";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { formValidators, handleSaveError, StaleVersionAlert, useAppForm } from "@/components/forms";
import { Form } from "@/components/forms/form-components";
import { RichTextContent } from "@/components/rich-text-content";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { formatNumber } from "@/lib/i18n/intl";
import type { SafeHtml } from "@/lib/safe-html";
import { absoluteUrl } from "@/lib/seo";
import { optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { RepeatField } from "../automations/repeat-field";
import { endPosition } from "../board/moves";
import { TaskFieldEditors } from "../custom-fields/task-field-editors";
import { applyFieldPatch } from "../fields";
import { PRIORITY_LABELS, TYPE_LABELS } from "../labels";
import { tasklineLinks } from "../links";
import { tasklineKeys, tasklineMutations } from "../queries";
import { CHECKLIST_MAX, type PatchTaskInput, TASK_DESCRIPTION_MAX, TASK_TITLE_MAX } from "../schema";
import { durationInput, formatDuration, parseDuration } from "../time/duration";
import { TaskTime } from "../time/task-time";
import { TimerButton } from "../time/timer";
import { TaskDependencies } from "../timeline/dependencies";
import {
	type ChecklistItem,
	ESTIMATE_MAX_MINUTES,
	isClosedCategory,
	POINTS_MAX,
	type ProjectTasks,
	TASK_PRIORITIES,
	TASK_TYPES,
	type TaskDetail,
	type TaskPriority,
	type TaskType,
} from "../types";
import { activityItems } from "./activity";
import { Comments, TaskFiles, WatchButton } from "./conversation";
import { LabelChip, StatusName } from "./task-bits";

/**
 * A task, the same in the sheet over a view and on its own page (PLAN 11.5): the
 * fields (single-field, last-write-wins changes that show at once), the title and
 * description (saved against the version they started from: someone else's save in
 * between asks to reload), the subtasks, the checklist and the history.
 */
export type TaskPanelProps = {
	task: TaskDetail;
	project: ProjectTasks;
	userId: string;
	ws: string;
	/** In the sheet: a link to the task's own page. */
	variant: "sheet" | "page";
	/** After the task went to the trash (the sheet closes; the page goes to the board). */
	onTrashed: () => void;
};

/** The task's query, patched at once and put back if the server refuses (then the error says why). */
function useTaskWrites(queryClient: QueryClient, userId: string, ws: string, task: TaskDetail) {
	const key = tasklineKeys.task(userId, ws, task.ref);
	const optimistic = async (changes: Partial<TaskDetail>) => {
		await queryClient.cancelQueries({ queryKey: key });
		const previous = queryClient.getQueryData<TaskDetail>(key);
		if (previous) queryClient.setQueryData<TaskDetail>(key, { ...previous, ...changes });
		return { previous };
	};
	const rollback = (_error: Error, _input: unknown, context: { previous?: TaskDetail } | undefined) => {
		if (context?.previous) queryClient.setQueryData(key, context.previous);
		toast.error(m.taskline_rolled_back(), { description: errorMessage(_error) });
	};
	const patch = useMutation({
		...tasklineMutations.patchTask(queryClient, userId),
		onMutate: ({ ws: _ws, ref: _ref, fields, ...changes }: PatchTaskInput) =>
			optimistic({
				...(changes as Partial<TaskDetail>),
				// Task 55: a patch names some fields; the others keep their values.
				...(fields ? { fields: applyFieldPatch(queryClient.getQueryData<TaskDetail>(key)?.fields ?? {}, fields) } : {}),
			}),
		onError: rollback,
	});
	const move = useMutation({
		...tasklineMutations.moveTask(queryClient, userId),
		onMutate: ({ statusId }) => optimistic({ statusId }),
		onError: rollback,
	});
	const checklist = useMutation({
		...tasklineMutations.setChecklist(queryClient, userId),
		onMutate: ({ checklist: items }) =>
			optimistic({
				checklistItems: items,
				checklist: { done: items.filter((item) => item.done).length, total: items.length },
			}),
		onError: rollback,
	});
	return {
		patch: (changes: Omit<PatchTaskInput, "ws" | "ref">) => patch.mutate({ ws, ref: task.ref, ...changes }),
		move: (statusId: string, position: string) => move.mutate({ ws, ref: task.ref, statusId, position }),
		checklist: (items: ChecklistItem[]) => checklist.mutate({ ws, ref: task.ref, checklist: items }),
	};
}

export function TaskPanel({ task, project, userId, ws, variant, onTrashed }: TaskPanelProps) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const writes = useTaskWrites(queryClient, userId, ws, task);
	const trash = useMutation(tasklineMutations.trashTask(queryClient, userId));
	const restore = useMutation(tasklineMutations.restoreTask(queryClient, userId));
	const now = useMinuteClock(Date.parse(project.readAt));
	const editable = task.can.edit && task.deletedAt === null;
	const path = tasklineLinks.task(ws, task.ref);
	// Its sections sit under the page's h1, or under the sheet's title (an h2).
	const Heading = variant === "page" ? "h2" : "h3";

	const toTrash = async () => {
		const confirmed = await confirm({
			title: m.taskline_trash_title({ task: task.title }),
			description: task.subtasks.length > 0 ? m.taskline_trash_body_subtasks() : m.taskline_trash_body(),
			confirmLabel: m.taskline_trash(),
			destructive: true,
		});
		if (!confirmed) return;
		try {
			await trash.mutateAsync({ ws, ref: task.ref });
			toast.success(m.taskline_trashed({ task: task.ref }));
			onTrashed();
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};

	return (
		<div className="flex min-w-0 flex-col gap-6" data-testid="task-panel">
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-mono text-caption text-muted-foreground">{task.ref}</span>
				<CopyButton value={absoluteUrl(`/app/taskline/${ws}/t/${task.ref}`)} label={m.taskline_copy_link()} />
				{variant === "sheet" ? (
					<Button asChild variant="ghost" size="sm">
						<Link {...path} data-testid="task-open-page">
							<ExternalLinkIcon aria-hidden />
							{m.taskline_open_page()}
						</Link>
					</Button>
				) : null}
				<div className="ms-auto flex flex-wrap justify-end gap-2">
					{task.time.enabled && task.time.canLog && task.deletedAt === null ? (
						<TimerButton ws={ws} taskRef={task.ref} userId={userId} />
					) : null}
					{project.members.some((member) => member.userId === userId && !member.deactivated) ? (
						<WatchButton task={task} userId={userId} ws={ws} />
					) : null}
					{task.deletedAt ? (
						task.can.edit ? (
							<Button
								variant="outline"
								size="sm"
								disabled={restore.isPending}
								onClick={() =>
									restore.mutate({ ws, ref: task.ref }, { onError: (error) => toast.error(errorMessage(error)) })
								}
								data-testid="task-restore"
							>
								<RotateCcwIcon aria-hidden />
								{m.taskline_restore()}
							</Button>
						) : null
					) : editable ? (
						<Button
							variant="ghost"
							size="sm"
							className="text-danger"
							onClick={() => void toTrash()}
							data-testid="task-trash"
						>
							<Trash2Icon aria-hidden />
							{m.taskline_trash()}
						</Button>
					) : null}
				</div>
			</div>
			{task.deletedAt ? (
				<p className="rounded-md border bg-warning-subtle px-3 py-2 text-body" data-testid="task-in-trash">
					{m.taskline_task_in_trash()}
				</p>
			) : null}
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
				<div className="flex min-w-0 flex-col gap-6">
					{editable ? (
						<TaskForm key={`${task.id}@${task.version}`} task={task} userId={userId} ws={ws} />
					) : (
						<div className="flex flex-col gap-3">
							{task.description ? (
								<RichTextContent html={task.description as SafeHtml} />
							) : (
								<p className="text-muted-foreground">{m.taskline_no_description()}</p>
							)}
						</div>
					)}
					<Tabs defaultValue="work">
						{/* Four tabs with their counts are wider than a phone: they wrap. */}
						<TabsList className="max-w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto">
							<TabsTrigger value="work">{m.taskline_tab_work()}</TabsTrigger>
							<TabsTrigger value="comments" data-testid="task-tab-comments">
								{m.taskline_tab_comments()}
								{task.comments.length > 0 ? (
									<span className="text-muted-foreground tabular-nums">{formatNumber(task.comments.length)}</span>
								) : null}
							</TabsTrigger>
							{task.time.enabled ? (
								<TabsTrigger value="time" data-testid="task-tab-time">
									{m.taskline_time_title()}
									{task.time.loggedMinutes > 0 ? (
										<span className="text-muted-foreground tabular-nums">
											{formatDuration(task.time.loggedMinutes)}
										</span>
									) : null}
								</TabsTrigger>
							) : null}
							<TabsTrigger value="activity" data-testid="task-tab-activity">
								{m.taskline_tab_activity()}
							</TabsTrigger>
						</TabsList>
						<TabsContent value="work" className="flex flex-col gap-6 pt-2">
							<Subtasks task={task} project={project} userId={userId} ws={ws} editable={editable} heading={Heading} />
							<TaskDependencies task={task} userId={userId} ws={ws} editable={editable} heading={Heading} />
							<Checklist task={task} editable={editable} onChange={writes.checklist} heading={Heading} />
							<TaskFiles task={task} userId={userId} ws={ws} editable={editable} heading={Heading} />
						</TabsContent>
						<TabsContent value="comments" className="pt-2">
							<Comments
								task={task}
								project={project}
								userId={userId}
								ws={ws}
								readAt={project.readAt}
								heading={Heading}
							/>
						</TabsContent>
						{task.time.enabled ? (
							<TabsContent value="time" className="pt-2">
								<TaskTime task={task} userId={userId} ws={ws} heading={Heading} />
							</TabsContent>
						) : null}
						<TabsContent value="activity" className="pt-2" data-testid="task-activity">
							<Timeline now={now} items={activityItems(task.activity, project)} />
						</TabsContent>
					</Tabs>
				</div>
				<TaskFields
					task={task}
					project={project}
					userId={userId}
					ws={ws}
					editable={editable}
					writes={writes}
					heading={Heading}
				/>
			</div>
		</div>
	);
}

const taskFormSchema = z.object({
	title: required({ max: TASK_TITLE_MAX }),
	description: optionalText({ max: TASK_DESCRIPTION_MAX }),
});

/** The title and the description, saved with the version the edit started from. */
function TaskForm({ task, userId, ws }: { task: TaskDetail; userId: string; ws: string }) {
	const queryClient = useQueryClient();
	const [stale, setStale] = useState(false);
	const save = useMutation(tasklineMutations.updateTask(queryClient, userId));
	const form = useAppForm({
		...formOptions({
			defaultValues: { title: task.title, description: task.description },
			validators: formValidators(taskFormSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const saved = await save.mutateAsync({ ws, ref: task.ref, version: task.version, ...value });
				queryClient.setQueryData(tasklineKeys.task(userId, ws, task.ref), saved);
				toast.success(m.crud_toast_saved());
			} catch (error) {
				handleSaveError(formApi, error, () => setStale(true));
			}
		},
	});
	return (
		<form.AppForm>
			<Form className="flex flex-col gap-4" data-testid="task-form">
				{stale ? (
					<StaleVersionAlert
						onReload={() =>
							queryClient.refetchQueries({ queryKey: tasklineKeys.task(userId, ws, task.ref), type: "active" })
						}
					/>
				) : null}
				<form.AppField name="title">
					{(field) => (
						<field.TextField label={m.taskline_field_title()} maxLength={TASK_TITLE_MAX} autoComplete="off" />
					)}
				</form.AppField>
				<form.AppField name="description">
					{(field) => <field.RichTextField label={m.taskline_field_description()} optional />}
				</form.AppField>
				<div className="flex gap-2">
					<form.SubmitButton pendingLabel={m.crud_saving()}>{m.crud_save()}</form.SubmitButton>
				</div>
			</Form>
		</form.AppForm>
	);
}

/** The fields: each change saves at once (last write wins, and it's in the history). */
function TaskFields({
	task,
	project,
	userId,
	ws,
	editable,
	writes,
	heading: Heading,
}: {
	task: TaskDetail;
	project: ProjectTasks;
	userId: string;
	ws: string;
	editable: boolean;
	writes: ReturnType<typeof useTaskWrites>;
	heading: "h2" | "h3";
}) {
	const id = useId();
	const status = project.statuses.find((each) => each.id === task.statusId);
	const reporter = project.members.find((member) => member.id === task.reporterId);
	const labels = project.labels.filter((label) => task.labelIds.includes(label.id));
	const toggleLabel = (labelId: string, on: boolean) =>
		writes.patch({
			labelIds: on
				? [...new Set([...task.labelIds, labelId])].sort()
				: task.labelIds.filter((each) => each !== labelId),
		});
	const row = "flex flex-col gap-1.5";
	const label = "text-caption font-medium text-muted-foreground";
	return (
		<aside
			aria-labelledby={`${id}-fields`}
			className="flex flex-col gap-4 lg:border-s lg:ps-6"
			data-testid="task-fields"
		>
			<Heading id={`${id}-fields`} className="sr-only">
				{m.taskline_fields()}
			</Heading>
			<div className={row}>
				<label htmlFor={`${id}-status`} className={label}>
					{m.taskline_field_status()}
				</label>
				{editable ? (
					<NativeSelect
						id={`${id}-status`}
						value={task.statusId}
						onChange={(event) => {
							const statusId = event.target.value;
							const siblings = project.tasks.filter((each) => each.statusId === statusId && each.id !== task.id);
							writes.move(statusId, endPosition(siblings));
						}}
						data-testid="task-status"
					>
						{project.statuses.map((each) => (
							<option key={each.id} value={each.id}>
								{each.name}
							</option>
						))}
					</NativeSelect>
				) : status ? (
					<StatusName status={status} className="text-body" />
				) : null}
			</div>
			<div className={row}>
				<label htmlFor={`${id}-assignee`} className={label}>
					{m.taskline_field_assignee()}
				</label>
				<NativeSelect
					id={`${id}-assignee`}
					value={task.assigneeId ?? ""}
					disabled={!editable}
					onChange={(event) => writes.patch({ assigneeId: event.target.value || null })}
					data-testid="task-assignee"
				>
					<option value="">{m.taskline_unassigned()}</option>
					{project.members
						.filter((member) => !member.deactivated || member.id === task.assigneeId)
						.map((member) => (
							<option key={member.id} value={member.id}>
								{member.name}
							</option>
						))}
				</NativeSelect>
			</div>
			<div className={row}>
				<label htmlFor={`${id}-priority`} className={label}>
					{m.taskline_field_priority()}
				</label>
				<NativeSelect
					id={`${id}-priority`}
					value={String(task.priority)}
					disabled={!editable}
					onChange={(event) => writes.patch({ priority: Number(event.target.value) as TaskPriority })}
					data-testid="task-priority"
				>
					{[...TASK_PRIORITIES].reverse().map((priority) => (
						<option key={priority} value={priority}>
							{PRIORITY_LABELS[priority]()}
						</option>
					))}
				</NativeSelect>
			</div>
			<div className={row}>
				<label htmlFor={`${id}-type`} className={label}>
					{m.taskline_field_type()}
				</label>
				<NativeSelect
					id={`${id}-type`}
					value={task.type}
					disabled={!editable}
					onChange={(event) => writes.patch({ type: event.target.value as TaskType })}
					data-testid="task-type"
				>
					{TASK_TYPES.filter((type) => type === task.type || project.taskTypes.includes(type)).map((type) => (
						<option key={type} value={type}>
							{TYPE_LABELS[type]()}
						</option>
					))}
				</NativeSelect>
			</div>
			{project.project.settings.sprints ? (
				<>
					<div className={row}>
						<label htmlFor={`${id}-sprint`} className={label}>
							{m.taskline_field_sprint()}
						</label>
						<NativeSelect
							id={`${id}-sprint`}
							value={task.sprintId ?? ""}
							disabled={!editable}
							onChange={(event) => writes.patch({ sprintId: event.target.value || null })}
							data-testid="task-sprint"
						>
							<option value="">{m.taskline_backlog_section()}</option>
							{/* A completed sprint isn't offered, but a task done in one still says so. */}
							{task.sprintId && !project.sprints.some((sprint) => sprint.id === task.sprintId) ? (
								<option value={task.sprintId}>{m.taskline_sprint_completed_option()}</option>
							) : null}
							{project.sprints.map((sprint) => (
								<option key={sprint.id} value={sprint.id}>
									{sprint.name}
								</option>
							))}
						</NativeSelect>
					</div>
					{project.project.settings.estimation === "points" ? (
						<div className={row}>
							<label htmlFor={`${id}-points`} className={label}>
								{m.taskline_field_points()}
							</label>
							<Input
								id={`${id}-points`}
								type="number"
								inputMode="numeric"
								min={0}
								max={POINTS_MAX}
								step={1}
								defaultValue={task.points ?? ""}
								key={`points:${task.points ?? ""}`}
								disabled={!editable}
								onBlur={(event) => {
									const raw = event.target.value.trim();
									const points = raw === "" ? null : Number(raw);
									if (points !== null && (!Number.isInteger(points) || points < 0 || points > POINTS_MAX)) return;
									if (points !== task.points) writes.patch({ points });
								}}
								data-testid="task-points"
							/>
						</div>
					) : null}
				</>
			) : null}
			{project.milestones.length > 0 || task.milestoneId ? (
				<div className={row}>
					<label htmlFor={`${id}-milestone`} className={label}>
						{m.taskline_field_milestone()}
					</label>
					<NativeSelect
						id={`${id}-milestone`}
						value={task.milestoneId ?? ""}
						disabled={!editable}
						onChange={(event) => writes.patch({ milestoneId: event.target.value || null })}
						data-testid="task-milestone"
					>
						<option value="">{m.taskline_milestone_none()}</option>
						{project.milestones.map((milestone) => (
							<option key={milestone.id} value={milestone.id}>
								{milestone.name}
							</option>
						))}
					</NativeSelect>
				</div>
			) : null}
			{project.project.settings.time || project.project.settings.estimation === "time" ? (
				<EstimateField
					task={task}
					editable={editable}
					id={`${id}-estimate`}
					onChange={(estimateMinutes) => writes.patch({ estimateMinutes })}
				/>
			) : null}
			<div className={row}>
				<span className={label}>{m.taskline_field_labels()}</span>
				<div className="flex flex-wrap items-center gap-1.5">
					{labels.map((each) => (
						<LabelChip key={each.id} label={each} />
					))}
					{editable && project.labels.length > 0 ? (
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="sm" className="h-6 px-2" data-testid="task-labels">
									<TagIcon aria-hidden />
									{m.taskline_edit_labels()}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								{project.labels.map((each) => (
									<DropdownMenuCheckboxItem
										key={each.id}
										checked={task.labelIds.includes(each.id)}
										onCheckedChange={(checked) => toggleLabel(each.id, checked === true)}
										onSelect={(event) => event.preventDefault()}
									>
										<LabelChip label={each} />
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					) : labels.length === 0 ? (
						<span className="text-body text-muted-foreground">{m.taskline_no_labels()}</span>
					) : null}
				</div>
			</div>
			{(["startOn", "dueOn"] as const).map((field) => (
				<div key={field} className={row}>
					<label htmlFor={`${id}-${field}`} className={label}>
						{field === "startOn" ? m.taskline_field_start() : m.taskline_field_due()}
					</label>
					<Input
						id={`${id}-${field}`}
						type="date"
						defaultValue={task[field] ?? ""}
						key={`${field}:${task[field] ?? ""}`}
						disabled={!editable}
						onChange={(event) => {
							const value = event.target.value;
							if (value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value)) writes.patch({ [field]: value || null });
						}}
						data-testid={`task-${field}`}
					/>
				</div>
			))}
			<RepeatField task={task} userId={userId} ws={ws} editable={editable} />
			<TaskFieldEditors
				task={task}
				project={project}
				editable={editable}
				onChange={(fieldId, value) => writes.patch({ fields: { [fieldId]: value } })}
			/>
			{reporter ? (
				<p className="text-caption text-muted-foreground">{m.taskline_reported_by({ name: reporter.name })}</p>
			) : null}
		</aside>
	);
}

/** The estimate as a duration ("4h", "1h 30m", "1:30"), saved when the field is left; empty clears it. */
function EstimateField({
	task,
	editable,
	id,
	onChange,
}: {
	task: TaskDetail;
	editable: boolean;
	id: string;
	onChange: (minutes: number | null) => void;
}) {
	const [invalid, setInvalid] = useState(false);
	const commit = (raw: string) => {
		const text = raw.trim();
		const minutes = text === "" ? null : parseDuration(text, ESTIMATE_MAX_MINUTES);
		setInvalid(text !== "" && minutes === null);
		if (text !== "" && minutes === null) return;
		if (minutes !== task.estimateMinutes) onChange(minutes);
	};
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-caption font-medium text-muted-foreground">
				{m.taskline_field_estimate()}
			</label>
			<Input
				id={id}
				key={`estimate:${task.estimateMinutes ?? ""}`}
				defaultValue={task.estimateMinutes === null ? "" : durationInput(task.estimateMinutes)}
				placeholder={m.taskline_time_duration_placeholder()}
				autoComplete="off"
				disabled={!editable}
				aria-invalid={invalid || undefined}
				aria-describedby={invalid ? `${id}-error` : undefined}
				onBlur={(event) => commit(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						commit(event.currentTarget.value);
					}
				}}
				data-testid="task-estimate"
			/>
			{invalid ? (
				<p id={`${id}-error`} className="text-caption text-danger">
					{m.taskline_time_error_duration()}
				</p>
			) : null}
		</div>
	);
}

/** The task's subtasks, with their progress and a quick add. */
function Subtasks({
	task,
	project,
	userId,
	ws,
	editable,
	heading: Heading,
}: {
	task: TaskDetail;
	project: ProjectTasks;
	userId: string;
	ws: string;
	editable: boolean;
	heading: "h2" | "h3";
}) {
	const queryClient = useQueryClient();
	const create = useMutation(tasklineMutations.createTask(queryClient, userId));
	const headingId = useId();
	const done = task.subtasks.filter((each) => each.completedAt !== null).length;
	const add = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = event.currentTarget;
		const title = String(new FormData(form).get("title") ?? "").trim();
		if (!title) return;
		create.mutate(
			{ ws, key: project.project.key, title, parentId: task.id },
			{
				onSuccess: async () => {
					form.reset();
					await queryClient.invalidateQueries({ queryKey: tasklineKeys.task(userId, ws, task.ref) });
				},
				onError: (error) => toast.error(errorMessage(error)),
			},
		);
	};
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-2" data-testid="task-subtasks">
			<Heading id={headingId} className="flex items-center gap-2 font-medium text-body">
				{m.taskline_subtasks()}
				{task.subtasks.length > 0 ? (
					<span className="text-caption text-muted-foreground tabular-nums">
						{m.taskline_subtasks_progress({ done: formatNumber(done), total: formatNumber(task.subtasks.length) })}
					</span>
				) : null}
			</Heading>
			{task.subtasks.length > 0 ? (
				<>
					<div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
						<span className="block h-full bg-primary" style={{ width: `${(done / task.subtasks.length) * 100}%` }} />
					</div>
					<ul className="flex flex-col divide-y rounded-md border">
						{task.subtasks.map((subtask) => {
							const status = project.statuses.find((each) => each.id === subtask.statusId);
							return (
								<li key={subtask.id} className="flex items-center gap-2 px-3 py-2 text-body">
									<span className="font-mono text-caption text-muted-foreground">{subtask.ref}</span>
									<Link
										{...tasklineLinks.task(ws, subtask.ref)}
										className={`min-w-0 flex-1 truncate hover:underline ${status && isClosedCategory(status.category) ? "text-muted-foreground line-through" : ""}`}
									>
										{subtask.title}
									</Link>
									{status ? <StatusName status={status} className="text-caption text-muted-foreground" /> : null}
								</li>
							);
						})}
					</ul>
				</>
			) : (
				<p className="text-muted-foreground text-sm">{m.taskline_no_subtasks()}</p>
			)}
			{editable ? (
				<form method="post" onSubmit={add} className="flex gap-2" data-testid="task-add-subtask">
					<label htmlFor={`${headingId}-new`} className="sr-only">
						{m.taskline_new_subtask()}
					</label>
					<Input
						id={`${headingId}-new`}
						name="title"
						placeholder={m.taskline_new_subtask()}
						maxLength={TASK_TITLE_MAX}
						autoComplete="off"
					/>
					<Button type="submit" variant="outline" disabled={create.isPending}>
						<PlusIcon aria-hidden />
						{m.taskline_add()}
					</Button>
				</form>
			) : null}
		</section>
	);
}

/** The checklist: tick, rename (on leaving the field) or remove an item; add one. */
function Checklist({
	task,
	editable,
	onChange,
	heading: Heading,
}: {
	task: TaskDetail;
	editable: boolean;
	onChange: (items: ChecklistItem[]) => void;
	heading: "h2" | "h3";
}) {
	const headingId = useId();
	const items = task.checklistItems;
	const update = (id: string, change: Partial<ChecklistItem>) =>
		onChange(items.map((item) => (item.id === id ? { ...item, ...change } : item)));
	const add = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = event.currentTarget;
		const text = String(new FormData(form).get("item") ?? "").trim();
		if (!text) return;
		onChange([...items, { id: crypto.randomUUID(), text, done: false }]);
		form.reset();
	};
	const done = items.filter((item) => item.done).length;
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-2" data-testid="task-checklist">
			<Heading id={headingId} className="flex items-center gap-2 font-medium text-body">
				{m.taskline_checklist()}
				{items.length > 0 ? (
					<span className="text-caption text-muted-foreground tabular-nums">
						{m.taskline_checklist_progress({ done: formatNumber(done), total: formatNumber(items.length) })}
					</span>
				) : null}
			</Heading>
			{items.length > 0 ? (
				<ul className="flex flex-col gap-1.5">
					{items.map((item, index) => (
						<li key={item.id} className="flex items-center gap-2">
							<Checkbox
								checked={item.done}
								disabled={!editable}
								onCheckedChange={(checked) => update(item.id, { done: checked === true })}
								aria-label={m.taskline_checklist_done({ item: item.text || formatNumber(index + 1) })}
							/>
							{editable ? (
								<>
									<Input
										defaultValue={item.text}
										key={item.text}
										maxLength={TASK_TITLE_MAX}
										aria-label={m.taskline_checklist_item({ position: formatNumber(index + 1) })}
										autoComplete="off"
										onBlur={(event) => {
											const text = event.target.value.trim();
											if (text && text !== item.text) update(item.id, { text });
										}}
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() => onChange(items.filter((each) => each.id !== item.id))}
									>
										<XIcon aria-hidden />
										<span className="sr-only">{m.taskline_checklist_remove({ item: item.text })}</span>
									</Button>
								</>
							) : (
								<span className={item.done ? "text-muted-foreground line-through" : undefined}>{item.text}</span>
							)}
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground text-sm">{m.taskline_no_checklist()}</p>
			)}
			{editable && items.length < CHECKLIST_MAX ? (
				<form method="post" onSubmit={add} className="flex gap-2" data-testid="task-add-check">
					<label htmlFor={`${headingId}-new`} className="sr-only">
						{m.taskline_checklist_add()}
					</label>
					<Input
						id={`${headingId}-new`}
						name="item"
						placeholder={m.taskline_checklist_add()}
						maxLength={TASK_TITLE_MAX}
						autoComplete="off"
					/>
					<Button type="submit" variant="outline">
						<PlusIcon aria-hidden />
						{m.taskline_add()}
					</Button>
				</form>
			) : null}
		</section>
	);
}
