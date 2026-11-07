import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { FileUpIcon, Trash2Icon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { SelectFilter } from "@/components/filters/filters";
import { Pagination } from "@/components/navigation/pagination";
import { useCloseOverlay } from "@/components/navigation/use-close-overlay";
import { EmptyState } from "@/components/page/empty-state";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useListPage } from "@/hooks/use-list-page";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { endPosition } from "../board/moves";
import { activeFields, fieldValueText } from "../fields";
import { filtersOf, hasFilters } from "../filters";
import { PRIORITY_LABELS } from "../labels";
import { TaskFilterBar } from "../projects/task-filters";
import { projectTasksQueryOptions, tasklineMutations, taskPageQueryOptions, workspaceQueryOptions } from "../queries";
import { useSavedViews } from "../saved-views";
import type { BulkTasksInput } from "../schema";
import { LIST_GROUPS, type ListGroup, TASKS_TABLE_ID } from "../search";
import { BlockedBadge, DueDate, LabelChip, StatusName, TaskTypeIcon } from "../task/task-bits";
import { TaskSheetLink } from "../task/task-link";
import { isClosedCategory, type ProjectTasks, TASK_PRIORITIES, type TaskPriority, type TaskSummary } from "../types";

const TaskSheet = lazy(() => import("../task/task-sheet"));
const ImportDialog = lazy(() => import("./import-dialog"));

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/list");

const GROUP_LABELS: Record<ListGroup, () => string> = {
	none: m.taskline_group_none,
	status: m.taskline_group_status,
	assignee: m.taskline_group_assignee,
};

type Edits = {
	canEdit: boolean;
	move: (task: TaskSummary, statusId: string) => void;
	patch: (task: TaskSummary, changes: { assigneeId?: string | null; priority?: TaskPriority }) => void;
};

/** The list's columns: sortable headers, and inline status, assignee and priority for editors. */
function taskColumns(project: ProjectTasks, ws: string, edits: Edits): DataTableColumn<TaskSummary>[] {
	const statusOf = (task: TaskSummary) => project.statuses.find((status) => status.id === task.statusId);
	const memberOf = (task: TaskSummary) => project.members.find((member) => member.id === task.assigneeId);
	return [
		{
			id: "ref",
			header: m.taskline_column_ref,
			sort: "number",
			cell: (task) => <span className="font-mono text-caption text-muted-foreground">{task.ref}</span>,
			csv: (task) => task.ref,
			cellClassName: "whitespace-nowrap",
		},
		{
			id: "title",
			header: m.taskline_field_title,
			sort: "title",
			cell: (task) => (
				<span className="flex min-w-48 items-center gap-2">
					<TaskTypeIcon type={task.type} />
					<TaskSheetLink
						view="list"
						ws={ws}
						taskRef={task.ref}
						className="font-medium hover:underline"
						data-testid="task-row-open"
					>
						{task.title}
					</TaskSheetLink>
					{task.blocked && task.completedAt === null ? <BlockedBadge /> : null}
				</span>
			),
			csv: (task) => task.title,
		},
		{
			id: "status",
			header: m.taskline_field_status,
			sort: "status",
			cell: (task) => {
				const status = statusOf(task);
				return edits.canEdit ? (
					<NativeSelect
						value={task.statusId}
						aria-label={m.taskline_status_of({ task: task.ref })}
						onChange={(event) => edits.move(task, event.target.value)}
						className="h-8 min-w-36"
						data-testid="task-row-status"
					>
						{project.statuses.map((each) => (
							<option key={each.id} value={each.id}>
								{each.name}
							</option>
						))}
					</NativeSelect>
				) : status ? (
					<StatusName status={status} />
				) : null;
			},
			csv: (task) => statusOf(task)?.name ?? "",
		},
		{
			id: "assignee",
			header: m.taskline_field_assignee,
			hideable: true,
			cell: (task) =>
				edits.canEdit ? (
					<NativeSelect
						value={task.assigneeId ?? ""}
						aria-label={m.taskline_assignee_of({ task: task.ref })}
						onChange={(event) => edits.patch(task, { assigneeId: event.target.value || null })}
						className="h-8 min-w-36"
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
				) : (
					(memberOf(task)?.name ?? <span className="text-muted-foreground">{m.taskline_unassigned()}</span>)
				),
			csv: (task) => memberOf(task)?.name ?? "",
		},
		{
			id: "priority",
			header: m.taskline_field_priority,
			sort: "-priority",
			hideable: true,
			cell: (task) =>
				edits.canEdit ? (
					<NativeSelect
						value={String(task.priority)}
						aria-label={m.taskline_priority_of({ task: task.ref })}
						onChange={(event) => edits.patch(task, { priority: Number(event.target.value) as TaskPriority })}
						className="h-8 min-w-28"
					>
						{[...TASK_PRIORITIES].reverse().map((priority) => (
							<option key={priority} value={priority}>
								{PRIORITY_LABELS[priority]()}
							</option>
						))}
					</NativeSelect>
				) : (
					PRIORITY_LABELS[task.priority]()
				),
			csv: (task) => PRIORITY_LABELS[task.priority](),
		},
		{
			id: "labels",
			header: m.taskline_field_labels,
			hideable: true,
			cell: (task) => (
				<span className="flex flex-wrap gap-1">
					{task.labelIds.flatMap((id) => {
						const label = project.labels.find((each) => each.id === id);
						return label ? [<LabelChip key={id} label={label} />] : [];
					})}
				</span>
			),
			csv: (task) => task.labelIds.map((id) => project.labels.find((label) => label.id === id)?.name ?? "").join(", "),
		},
		// Task 55: a column per custom field, hidden until shown from the Columns menu (and then in the CSV).
		...activeFields(project.fields).map(
			(field): DataTableColumn<TaskSummary> => ({
				id: `field:${field.id}`,
				header: () => field.name,
				hideable: true,
				defaultHidden: true,
				cell: (task) => {
					const value = task.fields[field.id];
					const text = fieldValueText(field, value, project.members);
					return field.type === "url" && typeof value === "string" ? (
						<a href={value} target="_blank" rel="noopener noreferrer" className="underline">
							{text}
						</a>
					) : (
						<span className="whitespace-nowrap">{text}</span>
					);
				},
				csv: (task) => fieldValueText(field, task.fields[field.id], project.members, { csv: true }),
			}),
		),
		{
			id: "due",
			header: m.taskline_field_due,
			sort: "due",
			hideable: true,
			cell: (task) => {
				const status = statusOf(task);
				return task.dueOn ? (
					<DueDate
						dueOn={task.dueOn}
						today={project.today}
						closed={status ? isClosedCategory(status.category) : false}
					/>
				) : null;
			},
			csv: (task) => task.dueOn ?? "",
		},
		{
			id: "updated",
			header: m.taskline_column_updated,
			sort: "-updated",
			hideable: true,
			cell: (task) => (
				<span className="whitespace-nowrap text-caption text-muted-foreground">
					{formatDate(new Date(task.updatedAt), { dateStyle: "medium" })}
				</span>
			),
			csv: (task) => task.updatedAt,
		},
	];
}

/**
 * /app/taskline/$ws/p/$key/list: the project's tasks as a table on the list contract
 * (the URL holds the filters, the sort, the page and the grouping; the server pages
 * them), with inline status, assignee and priority, bulk changes, CSV export, saved
 * views (the member's and the project's, Task 51) and a CSV import for editors.
 */
export function ListPage() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const { task: openTask, ...search } = route.useSearch();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { data: project } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(userId, ws));
	const { page, busy, pagination } = useListPage({
		tableId: TASKS_TABLE_ID,
		search,
		query: (input) => taskPageQueryOptions(userId)({ ...input, ws, key }),
	});
	const closeTask = useCloseOverlay({ task: undefined });
	const fail = (error: Error) => toast.error(m.taskline_rolled_back(), { description: errorMessage(error) });
	const patch = useMutation({ ...tasklineMutations.patchTask(queryClient, userId), onError: fail });
	const move = useMutation({ ...tasklineMutations.moveTask(queryClient, userId), onError: fail });
	const bulk = useMutation(tasklineMutations.bulk(queryClient, userId));
	const canEdit = project.project.can.edit;
	const views = useSavedViews(userId, ws, key, "list");
	const [importing, setImporting] = useState(false);

	const columns = taskColumns(project, ws, {
		canEdit,
		move: (task, statusId) =>
			move.mutate({
				ws,
				ref: task.ref,
				statusId,
				position: endPosition(project.tasks.filter((each) => each.statusId === statusId && each.id !== task.id)),
			}),
		patch: (task, changes) => patch.mutate({ ws, ref: task.ref, ...changes }),
	});

	const runBulk = async (ids: string[], clear: () => void, change: Omit<BulkTasksInput, "ws" | "key" | "ids">) => {
		try {
			const { count } = await bulk.mutateAsync({ ws, key, ids, ...change });
			clear();
			toast.success(m.taskline_bulk_done({ count: formatNumber(count) }));
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};

	const groupOf =
		search.group === "status"
			? (task: TaskSummary) => {
					const status = project.statuses.find((each) => each.id === task.statusId);
					return { id: task.statusId, label: status ? <StatusName status={status} /> : task.statusId };
				}
			: search.group === "assignee"
				? (task: TaskSummary) => ({
						id: task.assigneeId ?? "none",
						label: project.members.find((member) => member.id === task.assigneeId)?.name ?? m.taskline_unassigned(),
					})
				: undefined;

	const filtered = hasFilters(filtersOf(search));
	return (
		<div className="flex min-w-0 flex-col gap-4" data-testid="list-page">
			<TaskFilterBar
				search={search}
				context={project}
				member={workspace.me !== null}
				preserve={["sort", "pageSize", "group"]}
				tools={
					canEdit ? (
						<Button variant="outline" onClick={() => setImporting(true)} data-testid="import-open">
							<FileUpIcon aria-hidden />
							{m.taskline_import_open()}
						</Button>
					) : null
				}
				extra={
					<SelectFilter
						name="group"
						label={m.taskline_group()}
						value={search.group}
						options={LIST_GROUPS.map((value) => ({ value, label: GROUP_LABELS[value]() }))}
					/>
				}
			/>
			{page ? (
				<>
					<DataTable
						tableId={TASKS_TABLE_ID}
						rows={page.items}
						columns={columns}
						getRowId={(task) => task.id}
						getRowLabel={(task) => `${task.ref} ${task.title}`}
						sort={search.sort}
						busy={busy}
						groupOf={groupOf}
						exportName={`${key.toLowerCase()}-tasks`}
						savedViews={views}
						data-testid="task-table"
						bulkActions={
							canEdit
								? ({ ids, clear }) => (
										<BulkActions
											project={project}
											onChange={(change) => void runBulk(ids, clear, change)}
											onTrash={async () => {
												const confirmed = await confirm({
													title: m.taskline_bulk_trash_title({ count: formatNumber(ids.length) }),
													description: m.taskline_trash_body_subtasks(),
													confirmLabel: m.taskline_trash(),
													destructive: true,
												});
												if (confirmed) await runBulk(ids, clear, { trash: true });
											}}
										/>
									)
								: undefined
						}
						empty={
							<EmptyState
								data-testid="empty"
								variant={filtered ? "no-matches" : "empty"}
								description={filtered ? m.taskline_list_no_matches() : m.taskline_list_empty()}
							/>
						}
					/>
					{pagination ? <Pagination {...pagination} /> : null}
				</>
			) : null}
			<Suspense fallback={null}>
				{openTask ? (
					<TaskSheet userId={userId} ws={ws} projectKey={key} taskRef={openTask} onClose={closeTask} />
				) : null}
				{importing ? (
					<ImportDialog userId={userId} ws={ws} project={project} onClose={() => setImporting(false)} />
				) : null}
			</Suspense>
		</div>
	);
}

/** The selection's changes: one select per field (picking a value applies it), and the trash. */
function BulkActions({
	project,
	onChange,
	onTrash,
}: {
	project: ProjectTasks;
	onChange: (change: Omit<BulkTasksInput, "ws" | "key" | "ids">) => void;
	onTrash: () => Promise<void>;
}) {
	const select = "h-8 w-auto";
	return (
		<>
			<NativeSelect
				aria-label={m.taskline_bulk_status()}
				value=""
				className={select}
				onChange={(event) => event.target.value && onChange({ statusId: event.target.value })}
				data-testid="bulk-status"
			>
				<option value="">{m.taskline_bulk_status()}</option>
				{project.statuses.map((status) => (
					<option key={status.id} value={status.id}>
						{status.name}
					</option>
				))}
			</NativeSelect>
			<NativeSelect
				aria-label={m.taskline_bulk_assignee()}
				value=""
				className={select}
				onChange={(event) => {
					const value = event.target.value;
					if (value) onChange({ assigneeId: value === "none" ? null : value });
				}}
			>
				<option value="">{m.taskline_bulk_assignee()}</option>
				<option value="none">{m.taskline_unassigned()}</option>
				{project.members
					.filter((member) => !member.deactivated)
					.map((member) => (
						<option key={member.id} value={member.id}>
							{member.name}
						</option>
					))}
			</NativeSelect>
			<NativeSelect
				aria-label={m.taskline_bulk_priority()}
				value=""
				className={select}
				onChange={(event) => event.target.value && onChange({ priority: Number(event.target.value) })}
			>
				<option value="">{m.taskline_bulk_priority()}</option>
				{[...TASK_PRIORITIES].reverse().map((priority) => (
					<option key={priority} value={priority}>
						{PRIORITY_LABELS[priority]()}
					</option>
				))}
			</NativeSelect>
			{project.labels.length > 0 ? (
				<NativeSelect
					aria-label={m.taskline_bulk_labels()}
					value=""
					className={select}
					onChange={(event) => {
						const [action, id] = event.target.value.split(":");
						if (action === "add" && id) onChange({ addLabelId: id });
						if (action === "remove" && id) onChange({ removeLabelId: id });
					}}
				>
					<option value="">{m.taskline_bulk_labels()}</option>
					<optgroup label={m.taskline_bulk_label_add()}>
						{project.labels.map((label) => (
							<option key={label.id} value={`add:${label.id}`}>
								{label.name}
							</option>
						))}
					</optgroup>
					<optgroup label={m.taskline_bulk_label_remove()}>
						{project.labels.map((label) => (
							<option key={label.id} value={`remove:${label.id}`}>
								{label.name}
							</option>
						))}
					</optgroup>
				</NativeSelect>
			) : null}
			<Button variant="destructive" size="sm" onClick={() => void onTrash()} data-testid="bulk-trash">
				<Trash2Icon aria-hidden />
				{m.taskline_trash()}
			</Button>
		</>
	);
}
