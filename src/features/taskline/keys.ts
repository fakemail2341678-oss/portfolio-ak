import type { TaskListInput } from "./schema";
import type { SavedViewKind } from "./types";

/**
 * Taskline's reads and writes (Query; the board's TanStack DB collection reads the
 * project query, board/collection.ts). Keys carry the user's id, so another account
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
