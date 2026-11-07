import { keepPreviousData, mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import {
	createTasklineAutomation,
	deleteTasklineAutomation,
	listTasklineAutomations,
	previewTasklineAutomation,
	toggleTasklineAutomation,
	updateTasklineAutomation,
} from "@/functions/taskline/automations";
import {
	addTasklineComment,
	addTasklineTaskFiles,
	deleteTasklineComment,
	removeTasklineTaskFile,
	updateTasklineComment,
	watchTasklineTask,
} from "@/functions/taskline/collab";
import { createTasklineField, deleteTasklineField, updateTasklineField } from "@/functions/taskline/fields";
import {
	deleteTasklineSavedView,
	findTasklineTasks,
	importTasklineTasks,
	listTasklineSavedViews,
	saveTasklineSavedView,
	searchTasklineTasks,
} from "@/functions/taskline/find";
import { getTasklineNav, listMyTasklineTasks } from "@/functions/taskline/home";
import {
	getTasklineNotifySettings,
	getTasklineUnread,
	listTasklineInbox,
	markTasklineRead,
	saveTasklineNotifySettings,
} from "@/functions/taskline/inbox";
import {
	createTasklineProject,
	deleteTasklineProjectUpdate,
	joinTasklineProject,
	listTasklineProjectMembers,
	listTasklineProjects,
	listTasklineProjectUpdates,
	postTasklineProjectUpdate,
	removeTasklineProjectMember,
	setTasklineProjectArchived,
	setTasklineProjectMember,
	setTasklineProjectStar,
	setTasklineProjectState,
	updateTasklineProject,
} from "@/functions/taskline/projects";
import { getTasklineProjectReports } from "@/functions/taskline/reports";
import {
	completeTasklineSprint,
	createTasklineSprint,
	deleteTasklineSprint,
	getTasklineSprintReport,
	startTasklineSprint,
	updateTasklineSprint,
} from "@/functions/taskline/sprints";
import {
	bulkUpdateTasklineTasks,
	createTasklineTask,
	getTasklineProjectRev,
	getTasklineTask,
	listTasklineProjectActivity,
	listTasklineTaskPage,
	listTasklineTasks,
	listTasklineTrash,
	moveTasklineTask,
	patchTasklineTask,
	purgeTasklineTask,
	restoreTasklineTask,
	setTasklineChecklist,
	trashTasklineTask,
	updateTasklineTask,
} from "@/functions/taskline/tasks";
import { listTasklineTemplates } from "@/functions/taskline/templates";
import {
	copyTasklineTimesheetWeek,
	deleteTasklineTimeEntry,
	getTasklineProjectTime,
	getTasklineTimesheet,
	logTasklineTime,
	setTasklineTimesheetCell,
	startTasklineTimer,
	stopTasklineTimer,
	updateTasklineTimeEntry,
} from "@/functions/taskline/time";
import {
	addTasklineDependency,
	createTasklineMilestone,
	deleteTasklineMilestone,
	removeTasklineDependency,
	updateTasklineMilestone,
} from "@/functions/taskline/timeline";
import {
	createTasklineLabel,
	createTasklineStatus,
	deleteTasklineLabel,
	deleteTasklineStatus,
	updateTasklineLabel,
	updateTasklineStatus,
} from "@/functions/taskline/workflow";
import { getTasklineWorkspace, listTasklineMembers, startTasklineSandbox } from "@/functions/taskline/workspaces";
import type {
	AddCommentInput,
	BulkTasksInput,
	CompleteSprintInput,
	CreateAutomationInput,
	CreateFieldInput,
	CreateLabelInput,
	CreateMilestoneInput,
	CreateProjectInput,
	CreateSprintInput,
	CreateStatusInput,
	CreateTaskInput,
	DeleteProjectUpdateInput,
	DependencyInput,
	ImportTasksInput,
	InboxInput,
	LogTimeInput,
	MarkReadInput,
	NotifySettingsInput,
	PatchTaskInput,
	PostProjectUpdateInput,
	SaveViewInput,
	SetProjectStateInput,
	TaskListInput,
	TimesheetCellInput,
	ToggleAutomationInput,
	UpdateAutomationInput,
	UpdateCommentInput,
	UpdateFieldInput,
	UpdateLabelInput,
	UpdateMilestoneInput,
	UpdateProjectInput,
	UpdateSprintInput,
	UpdateStatusInput,
	UpdateTaskInput,
	UpdateTimeEntryInput,
} from "./schema";
import type { AutomationCondition, ChecklistItem, ProjectRole, ReportRange, SavedViewKind } from "./types";

/**
 * Taskline's reads and writes (Query; the board's TanStack DB collection reads the
 * project query, board/collections.ts). Keys carry the user's id, so another account
 * signing in on the same tab never sees cached data, and every write refreshes
 * everything under it: the sidebar, Home and the open views too.
 */
export const tasklineKeys = {
	all: ["taskline"] as const,
	user: (userId: string) => [...tasklineKeys.all, userId] as const,
	nav: (userId: string) => [...tasklineKeys.user(userId), "nav"] as const,
	myTasks: (userId: string) => [...tasklineKeys.user(userId), "my-tasks"] as const,
	workspace: (userId: string, ws: string) => [...tasklineKeys.user(userId), "ws", ws] as const,
	members: (userId: string, ws: string) => [...tasklineKeys.workspace(userId, ws), "members"] as const,
	projects: (userId: string, ws: string, archived: boolean) =>
		[...tasklineKeys.workspace(userId, ws), "projects", { archived }] as const,
	project: (userId: string, ws: string, key: string) =>
		[...tasklineKeys.workspace(userId, ws), "project", key] as const,
	/** The project's own data (statuses, members, tasks): what the board's collection reads. */
	projectTasks: (userId: string, ws: string, key: string) =>
		[...tasklineKeys.project(userId, ws, key), "tasks"] as const,
	taskPage: (userId: string, input: TaskListInput) =>
		[...tasklineKeys.project(userId, input.ws, input.key), "list", input] as const,
	task: (userId: string, ws: string, ref: string) => [...tasklineKeys.workspace(userId, ws), "task", ref] as const,
	/** Task 50: the inbox (and the sidebar's count, under it) and "My settings". */
	inbox: (userId: string) => [...tasklineKeys.user(userId), "inbox"] as const,
	unread: (userId: string) => [...tasklineKeys.inbox(userId), "unread"] as const,
	notifySettings: (userId: string) => [...tasklineKeys.user(userId), "notify-settings"] as const,
	/** Task 51: a project's saved views of one kind, the search page, the palette's results. */
	views: (userId: string, ws: string, key: string, view: SavedViewKind) =>
		[...tasklineKeys.project(userId, ws, key), "views", view] as const,
	search: (userId: string, ws: string, q: string, page: number) =>
		[...tasklineKeys.workspace(userId, ws), "search", { q, page }] as const,
	find: (userId: string, q: string) => [...tasklineKeys.user(userId), "find", q] as const,
	/** Task 52: a sprint's report (under its project, so the project's refresh reads it again). */
	sprintReport: (userId: string, ws: string, key: string, id: string) =>
		[...tasklineKeys.project(userId, ws, key), "sprint", id] as const,
	/** Task 53: the caller's timesheet of a week, and a project's time (under its project). */
	timesheet: (userId: string, ws: string, week: string) =>
		[...tasklineKeys.workspace(userId, ws), "timesheet", week] as const,
	projectTime: (userId: string, ws: string, key: string) => [...tasklineKeys.project(userId, ws, key), "time"] as const,
	/** Task 56: a project's automations and their runs, and the builder's preview of some conditions. */
	automations: (userId: string, ws: string, key: string) =>
		[...tasklineKeys.project(userId, ws, key), "automations"] as const,
	automationPreview: (userId: string, ws: string, key: string) =>
		[...tasklineKeys.project(userId, ws, key), "automation-preview"] as const,
	/** Task 57: what "New project" offers in a workspace, a project's reports and its updates. */
	templates: (userId: string, ws: string) => [...tasklineKeys.workspace(userId, ws), "templates"] as const,
	reports: (userId: string, ws: string, key: string, range: string) =>
		[...tasklineKeys.project(userId, ws, key), "reports", { range }] as const,
	updates: (userId: string, ws: string, key: string) => [...tasklineKeys.project(userId, ws, key), "updates"] as const,
};

/** A project's automations (its lead's settings page). */
export const projectAutomationsQueryOptions = (userId: string, ws: string, key: string) =>
	queryOptions({
		queryKey: tasklineKeys.automations(userId, ws, key),
		queryFn: () => listTasklineAutomations({ data: { ws, key } }),
	});

/** How many of the project's open tasks some conditions match now (the builder's preview, keyed by the conditions). */
export const automationPreviewSource = (userId: string, ws: string, key: string) => ({
	queryKey: tasklineKeys.automationPreview(userId, ws, key),
	run: (conditions: AutomationCondition[]) => previewTasklineAutomation({ data: { ws, key, conditions } }),
});

/** My timesheet: the week holding `week` (any of its days). */
export const timesheetQueryOptions = (userId: string, ws: string, week: string) =>
	queryOptions({
		queryKey: tasklineKeys.timesheet(userId, ws, week),
		queryFn: () => getTasklineTimesheet({ data: { ws, week } }),
		placeholderData: keepPreviousData,
	});

/** A project's estimate against actual. */
export const projectTimeQueryOptions = (userId: string, ws: string, key: string) =>
	queryOptions({
		queryKey: tasklineKeys.projectTime(userId, ws, key),
		queryFn: () => getTasklineProjectTime({ data: { ws, key } }),
	});

/** What "New project" offers: the built-ins and the team's own (loaded when the dialog opens). */
export const templatesQueryOptions = (userId: string, ws: string) =>
	queryOptions({
		queryKey: tasklineKeys.templates(userId, ws),
		queryFn: () => listTasklineTemplates({ data: { ws } }),
	});

/** A project's reports over some weeks. */
export const projectReportsQueryOptions = (userId: string, ws: string, key: string, range: ReportRange) =>
	queryOptions({
		queryKey: tasklineKeys.reports(userId, ws, key, range),
		queryFn: () => getTasklineProjectReports({ data: { ws, key, range } }),
	});

/** A project's updates, newest first (the overview). */
export const projectUpdatesQueryOptions = (userId: string, ws: string, key: string) =>
	queryOptions({
		queryKey: tasklineKeys.updates(userId, ws, key),
		queryFn: () => listTasklineProjectUpdates({ data: { ws, key } }),
	});

/** A sprint's report: its days, today's totals and the velocity. */
export const sprintReportQueryOptions = (userId: string, ws: string, key: string, id: string) =>
	queryOptions({
		queryKey: tasklineKeys.sprintReport(userId, ws, key, id),
		queryFn: () => getTasklineSprintReport({ data: { ws, key, id } }),
	});

/** A project's saved views of one kind (the list's, the board's, the calendar's "Views" menu). */
export const savedViewsQueryOptions = (userId: string, ws: string, key: string, view: SavedViewKind) =>
	queryOptions({
		queryKey: tasklineKeys.views(userId, ws, key, view),
		queryFn: () => listTasklineSavedViews({ data: { ws, key, view } }),
	});

/** /$ws/search's page of results (an empty question asks nothing). */
export const searchQueryOptions = (userId: string, ws: string, q: string, page: number) =>
	queryOptions({
		queryKey: tasklineKeys.search(userId, ws, q, page),
		queryFn: () => searchTasklineTasks({ data: { ws, q, page } }),
		placeholderData: keepPreviousData,
	});

/** The palette's tasks for what's typed (two characters at least). */
export const findTasksQueryOptions = (userId: string, q: string) =>
	queryOptions({
		queryKey: tasklineKeys.find(userId, q),
		queryFn: () => findTasklineTasks({ data: { q } }),
		enabled: q.trim().length >= 2,
		staleTime: 30_000,
		placeholderData: keepPreviousData,
	});

export const inboxQueryOptions = (userId: string, input: InboxInput) =>
	queryOptions({
		queryKey: [...tasklineKeys.inbox(userId), input],
		queryFn: () => listTasklineInbox({ data: input }),
		placeholderData: keepPreviousData,
	});

/** The sidebar's unread count: polled every minute while the tab is visible (PLAN 11.5). */
export const unreadQueryOptions = (userId: string) =>
	queryOptions({
		queryKey: tasklineKeys.unread(userId),
		queryFn: () => getTasklineUnread(),
		refetchInterval: 60_000,
		refetchIntervalInBackground: false,
	});

export const notifySettingsQueryOptions = (userId: string) =>
	queryOptions({ queryKey: tasklineKeys.notifySettings(userId), queryFn: () => getTasklineNotifySettings() });

export const tasklineNavQueryOptions = (userId: string) =>
	queryOptions({ queryKey: tasklineKeys.nav(userId), queryFn: () => getTasklineNav() });

export const myTasksQueryOptions = (userId: string) =>
	queryOptions({ queryKey: tasklineKeys.myTasks(userId), queryFn: () => listMyTasklineTasks() });

export const workspaceQueryOptions = (userId: string, ws: string) =>
	queryOptions({
		queryKey: tasklineKeys.workspace(userId, ws),
		queryFn: () => getTasklineWorkspace({ data: { ws } }),
	});

/** The workspace's active members (pickers: a project's new member, an assignee). */
export const workspaceMembersQueryOptions = (userId: string, ws: string) =>
	queryOptions({
		queryKey: tasklineKeys.members(userId, ws),
		queryFn: () => listTasklineMembers({ data: { ws } }),
	});

export const projectsQueryOptions = (userId: string, ws: string, archived: boolean) =>
	queryOptions({
		queryKey: tasklineKeys.projects(userId, ws, archived),
		queryFn: () => listTasklineProjects({ data: { ws, archived } }),
	});

/** A project with its statuses, labels, members and tasks: the layout loads it for every view. */
export const projectTasksQueryOptions = (userId: string, ws: string, key: string) =>
	queryOptions({
		queryKey: tasklineKeys.projectTasks(userId, ws, key),
		queryFn: () => listTasklineTasks({ data: { ws, key } }),
	});

export const projectMembersQueryOptions = (userId: string, ws: string, key: string) =>
	queryOptions({
		queryKey: [...tasklineKeys.project(userId, ws, key), "members"],
		queryFn: () => listTasklineProjectMembers({ data: { ws, key } }),
	});

export const projectActivityQueryOptions = (userId: string, ws: string, key: string) =>
	queryOptions({
		queryKey: [...tasklineKeys.project(userId, ws, key), "activity"],
		queryFn: () => listTasklineProjectActivity({ data: { ws, key } }),
	});

export const projectTrashQueryOptions = (userId: string, ws: string, key: string) =>
	queryOptions({
		queryKey: [...tasklineKeys.project(userId, ws, key), "trash"],
		queryFn: () => listTasklineTrash({ data: { ws, key } }),
	});

/** The list view's page; the previous page stays on screen while the next loads. */
export const taskPageQueryOptions = (userId: string) => (input: TaskListInput) =>
	queryOptions({
		queryKey: tasklineKeys.taskPage(userId, input),
		queryFn: () => listTasklineTaskPage({ data: input }),
		placeholderData: keepPreviousData,
	});

export const taskQueryOptions = (userId: string, ws: string, ref: string) =>
	queryOptions({
		queryKey: tasklineKeys.task(userId, ws, ref),
		queryFn: () => getTasklineTask({ data: { ws, ref } }),
	});

/**
 * The project's rev, polled while the page is visible (decision 0209): 10 s, and on
 * focus. Never cached for long: it's the question "did anything change?".
 */
export const projectRevQueryOptions = (userId: string, ws: string, key: string) =>
	queryOptions({
		queryKey: [...tasklineKeys.project(userId, ws, key), "rev"],
		queryFn: () => getTasklineProjectRev({ data: { ws, key } }),
		refetchInterval: 10_000,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: "always",
		staleTime: 0,
	});

/** After any write: everything of the user's in Taskline is stale (active queries refetch). */
export const refreshTaskline = (queryClient: QueryClient, userId: string) =>
	queryClient.invalidateQueries({ queryKey: tasklineKeys.user(userId) });

const write = <TInput, TResult>(
	queryClient: QueryClient,
	userId: string,
	mutationFn: (input: TInput) => Promise<TResult>,
) => mutationOptions({ mutationFn, onSettled: () => refreshTaskline(queryClient, userId) });

export const starProjectMutation = (queryClient: QueryClient, userId: string) =>
	write(queryClient, userId, (input: { ws: string; key: string; starred: boolean }) =>
		setTasklineProjectStar({ data: input }),
	);

export const createProjectMutation = (queryClient: QueryClient, userId: string) =>
	write(queryClient, userId, (input: CreateProjectInput) => createTasklineProject({ data: input }));

export const startSandboxMutation = (queryClient: QueryClient, userId: string) =>
	write(queryClient, userId, () => startTasklineSandbox());

/** Every write the views, the task and the lead's settings make. */
export const tasklineMutations = {
	createTask: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: CreateTaskInput) => createTasklineTask({ data: input })),
	updateTask: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: UpdateTaskInput) => updateTasklineTask({ data: input })),
	patchTask: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: PatchTaskInput) => patchTasklineTask({ data: input })),
	moveTask: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; ref: string; statusId: string; position: string }) =>
			moveTasklineTask({ data: input }),
		),
	setChecklist: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; ref: string; checklist: ChecklistItem[] }) =>
			setTasklineChecklist({ data: input }),
		),
	trashTask: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; ref: string }) => trashTasklineTask({ data: input })),
	restoreTask: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; ref: string }) => restoreTasklineTask({ data: input })),
	purgeTask: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; ref: string }) => purgeTasklineTask({ data: input })),
	bulk: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: BulkTasksInput) => bulkUpdateTasklineTasks({ data: input })),
	updateProject: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: UpdateProjectInput) => updateTasklineProject({ data: input })),
	setProjectState: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: SetProjectStateInput) => setTasklineProjectState({ data: input })),
	postProjectUpdate: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: PostProjectUpdateInput) => postTasklineProjectUpdate({ data: input })),
	deleteProjectUpdate: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: DeleteProjectUpdateInput) => deleteTasklineProjectUpdate({ data: input })),
	joinProject: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; key: string }) => joinTasklineProject({ data: input })),
	setArchived: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; key: string; archived: boolean }) =>
			setTasklineProjectArchived({ data: input }),
		),
	setProjectMember: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; key: string; memberId: string; role: ProjectRole }) =>
			setTasklineProjectMember({ data: input }),
		),
	removeProjectMember: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; key: string; memberId: string }) =>
			removeTasklineProjectMember({ data: input }),
		),
	createStatus: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: CreateStatusInput) => createTasklineStatus({ data: input })),
	updateStatus: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: UpdateStatusInput) => updateTasklineStatus({ data: input })),
	deleteStatus: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; key: string; id: string; moveTo?: string }) =>
			deleteTasklineStatus({ data: input }),
		),
	createLabel: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: CreateLabelInput) => createTasklineLabel({ data: input })),
	updateLabel: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: UpdateLabelInput) => updateTasklineLabel({ data: input })),
	deleteLabel: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; key: string; id: string }) =>
			deleteTasklineLabel({ data: input }),
		),
	/** Task 55: a project's own custom fields. */
	createField: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: CreateFieldInput) => createTasklineField({ data: input })),
	updateField: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: UpdateFieldInput) => updateTasklineField({ data: input })),
	deleteField: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; key: string; id: string }) =>
			deleteTasklineField({ data: input }),
		),
	/** Task 56: a project's own automations. */
	createAutomation: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: CreateAutomationInput) => createTasklineAutomation({ data: input })),
	updateAutomation: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: UpdateAutomationInput) => updateTasklineAutomation({ data: input })),
	toggleAutomation: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: ToggleAutomationInput) => toggleTasklineAutomation({ data: input })),
	deleteAutomation: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; key: string; id: string }) =>
			deleteTasklineAutomation({ data: input }),
		),
	addComment: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: AddCommentInput) => addTasklineComment({ data: input })),
	updateComment: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: UpdateCommentInput) => updateTasklineComment({ data: input })),
	deleteComment: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; ref: string; id: string }) =>
			deleteTasklineComment({ data: input }),
		),
	watch: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; ref: string; watching: boolean }) =>
			watchTasklineTask({ data: input }),
		),
	addFiles: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; ref: string; ids: string[] }) =>
			addTasklineTaskFiles({ data: input }),
		),
	removeFile: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; ref: string; id: string }) =>
			removeTasklineTaskFile({ data: input }),
		),
	markRead: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: MarkReadInput) => markTasklineRead({ data: input }),
			onSettled: () => queryClient.invalidateQueries({ queryKey: tasklineKeys.inbox(userId) }),
		}),
	saveView: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: SaveViewInput) => saveTasklineSavedView({ data: input }),
			onSettled: (_data, _error, input) =>
				queryClient.invalidateQueries({ queryKey: tasklineKeys.views(userId, input.ws, input.key, input.view) }),
		}),
	deleteView: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: { ws: string; key: string; id: string; view: SavedViewKind }) =>
				deleteTasklineSavedView({ data: { ws: input.ws, key: input.key, id: input.id } }),
			onSettled: (_data, _error, input) =>
				queryClient.invalidateQueries({ queryKey: tasklineKeys.views(userId, input.ws, input.key, input.view) }),
		}),
	importTasks: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: ImportTasksInput) => importTasklineTasks({ data: input })),
	saveNotifySettings: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: NotifySettingsInput) => saveTasklineNotifySettings({ data: input }),
			onSuccess: (saved) => queryClient.setQueryData(tasklineKeys.notifySettings(userId), saved),
		}),
	createSprint: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: CreateSprintInput) => createTasklineSprint({ data: input })),
	updateSprint: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: UpdateSprintInput) => updateTasklineSprint({ data: input })),
	deleteSprint: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; key: string; id: string }) =>
			deleteTasklineSprint({ data: input }),
		),
	startSprint: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; key: string; id: string }) =>
			startTasklineSprint({ data: input }),
		),
	completeSprint: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: CompleteSprintInput) => completeTasklineSprint({ data: input })),
	startTimer: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; ref: string }) => startTasklineTimer({ data: input })),
	stopTimer: (queryClient: QueryClient, userId: string) => write(queryClient, userId, () => stopTasklineTimer()),
	logTime: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: LogTimeInput) => logTasklineTime({ data: input })),
	updateTimeEntry: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: UpdateTimeEntryInput) => updateTasklineTimeEntry({ data: input })),
	deleteTimeEntry: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; id: string }) => deleteTasklineTimeEntry({ data: input })),
	setTimesheetCell: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: TimesheetCellInput) => setTasklineTimesheetCell({ data: input })),
	copyWeek: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; week: string }) => copyTasklineTimesheetWeek({ data: input })),
	createMilestone: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: CreateMilestoneInput) => createTasklineMilestone({ data: input })),
	updateMilestone: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: UpdateMilestoneInput) => updateTasklineMilestone({ data: input })),
	deleteMilestone: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; key: string; id: string }) =>
			deleteTasklineMilestone({ data: input }),
		),
	addDependency: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: DependencyInput) => addTasklineDependency({ data: input })),
	removeDependency: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: DependencyInput) => removeTasklineDependency({ data: input })),
};
