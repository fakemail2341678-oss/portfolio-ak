import { keepPreviousData, mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import {
	createTasklineAutomation,
	deleteTasklineAutomation,
	listTasklineAutomations,
	setTasklineAutomationEnabled,
	updateTasklineAutomation,
} from "@/functions/taskline/automations";
import {
	addTasklineComment,
	addTasklineTaskFiles,
	deleteTasklineComment,
	followTasklineTask,
	removeTasklineTaskFile,
	updateTasklineComment,
} from "@/functions/taskline/collab";
import { createTasklineField, deleteTasklineField, updateTasklineField } from "@/functions/taskline/fields";
import {
	createTasklineSavedView,
	deleteTasklineSavedView,
	importTasklineTasks,
	listTasklineFindResults,
	listTasklineSavedViews,
	searchTasklineTasks,
} from "@/functions/taskline/find";
import { getTasklineNav, listMyTasklineTasks } from "@/functions/taskline/home";
import {
	getTasklineNotifySettings,
	getTasklineUnread,
	listTasklineInbox,
	setTasklineNotificationsRead,
	setTasklineNotifySettings,
} from "@/functions/taskline/inbox";
import {
	createTasklineProject,
	createTasklineProjectUpdate,
	deleteTasklineProjectUpdate,
	joinTasklineProject,
	listTasklineProjectMembers,
	listTasklineProjects,
	listTasklineProjectUpdates,
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
	createTasklineTask,
	getTasklineProjectRev,
	getTasklineTask,
	listTasklineProjectActivity,
	listTasklineTaskPage,
	listTasklineTasks,
	listTasklineTrash,
	moveTasklineTask,
	purgeTasklineTask,
	restoreTasklineTask,
	setTasklineChecklist,
	setTasklineTaskField,
	trashTasklineTask,
	updateTasklineTask,
	updateTasklineTasks,
} from "@/functions/taskline/tasks";
import { listTasklineTemplates } from "@/functions/taskline/templates";
import {
	copyTasklineTimesheetWeek,
	deleteTasklineTimeEntry,
	getTasklineProjectTime,
	getTasklineTimesheet,
	recordTasklineTime,
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
import { tasklineKeys } from "./keys";
import { refreshTaskline } from "./lib/refresh";
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
import type { ChecklistItem, ProjectRole, ReportRange, SavedViewKind } from "./types";

/** A project's automations (its lead's settings page). */
export const projectAutomationsQueryOptions = (userId: string, ws: string, key: string) =>
	queryOptions({
		queryKey: tasklineKeys.automations(userId, ws, key),
		queryFn: () => listTasklineAutomations({ data: { ws, key } }),
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
		queryFn: () => listTasklineFindResults({ data: { q } }),
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

const write = <TInput, TResult>(
	queryClient: QueryClient,
	userId: string,
	mutationFn: (input: TInput) => Promise<TResult>,
) => mutationOptions({ mutationFn, onSettled: () => refreshTaskline(queryClient, userId) });

/** Every write the views, the task and the lead's settings make. */
export const tasklineMutations = {
	createTask: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: CreateTaskInput) => createTasklineTask({ data: input })),
	updateTask: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: UpdateTaskInput) => updateTasklineTask({ data: input })),
	patchTask: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: PatchTaskInput) => setTasklineTaskField({ data: input })),
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
		write(queryClient, userId, (input: BulkTasksInput) => updateTasklineTasks({ data: input })),
	updateProject: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: UpdateProjectInput) => updateTasklineProject({ data: input })),
	setProjectState: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: SetProjectStateInput) => setTasklineProjectState({ data: input })),
	postProjectUpdate: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: PostProjectUpdateInput) => createTasklineProjectUpdate({ data: input })),
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
		write(queryClient, userId, (input: ToggleAutomationInput) => setTasklineAutomationEnabled({ data: input })),
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
			followTasklineTask({ data: input }),
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
			mutationFn: (input: MarkReadInput) => setTasklineNotificationsRead({ data: input }),
			onSettled: () => queryClient.invalidateQueries({ queryKey: tasklineKeys.inbox(userId) }),
		}),
	saveView: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: SaveViewInput) => createTasklineSavedView({ data: input }),
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
			mutationFn: (input: NotifySettingsInput) => setTasklineNotifySettings({ data: input }),
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
		write(queryClient, userId, (input: LogTimeInput) => recordTasklineTime({ data: input })),
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

	starProject: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: { ws: string; key: string; starred: boolean }) =>
			setTasklineProjectStar({ data: input }),
		),
	createProject: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: CreateProjectInput) => createTasklineProject({ data: input })),
	startSandbox: (queryClient: QueryClient, userId: string) => write(queryClient, userId, () => startTasklineSandbox()),
};
