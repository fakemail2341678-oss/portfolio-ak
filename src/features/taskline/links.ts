import { linkOptions } from "@tanstack/react-router";

/**
 * Every link into Taskline (PLAN 11.5, "Base path"): pages link through these, so
 * renaming the app is a move of `src/routes/_taskline/app/taskline` and this file.
 */
export const tasklineLinks = {
	landing: () => linkOptions({ to: "/app/taskline" }),
	signIn: (redirect?: string) => linkOptions({ to: "/app/taskline/sign-in", search: { redirect } }),
	signUp: (redirect?: string) => linkOptions({ to: "/app/taskline/sign-up", search: { redirect } }),
	/** My work; the default (assigned to me) stays out of the URL. */
	home: (show?: "assigned" | "watching" | "all") =>
		linkOptions({ to: "/app/taskline/home", search: show ? { show } : {} }),
	account: () => linkOptions({ to: "/app/taskline/account" }),
	inbox: (filter?: "unread" | "all", page?: number) =>
		linkOptions({ to: "/app/taskline/inbox", search: { filter: filter ?? "unread", page: page ?? 1 } }),
	mySettings: () => linkOptions({ to: "/app/taskline/settings" }),
	projects: (ws: string) => linkOptions({ to: "/app/taskline/$ws/projects", params: { ws } }),
	project: (ws: string, key: string) => linkOptions({ to: "/app/taskline/$ws/p/$key", params: { ws, key } }),
	board: (ws: string, key: string) => linkOptions({ to: "/app/taskline/$ws/p/$key/board", params: { ws, key } }),
	list: (ws: string, key: string) => linkOptions({ to: "/app/taskline/$ws/p/$key/list", params: { ws, key } }),
	calendar: (ws: string, key: string) => linkOptions({ to: "/app/taskline/$ws/p/$key/calendar", params: { ws, key } }),
	/** Task 54: the timeline and the milestones. */
	timeline: (ws: string, key: string) => linkOptions({ to: "/app/taskline/$ws/p/$key/timeline", params: { ws, key } }),
	milestones: (ws: string, key: string) =>
		linkOptions({ to: "/app/taskline/$ws/p/$key/milestones", params: { ws, key } }),
	backlog: (ws: string, key: string) => linkOptions({ to: "/app/taskline/$ws/p/$key/backlog", params: { ws, key } }),
	sprint: (ws: string, key: string, sprintId: string) =>
		linkOptions({ to: "/app/taskline/$ws/p/$key/sprints/$sprintId", params: { ws, key, sprintId }, search: {} }),
	/** Task 53: my timesheet (this week unless `week` names a day of another), a project's time. */
	timesheet: (ws: string, week?: string) =>
		linkOptions({ to: "/app/taskline/$ws/timesheet", params: { ws }, search: week ? { week } : {} }),
	/** Task 57: a project's reports. */
	reports: (ws: string, key: string) =>
		linkOptions({ to: "/app/taskline/$ws/p/$key/reports", params: { ws, key }, search: { range: "12w" as const } }),
	time: (ws: string, key: string) =>
		linkOptions({ to: "/app/taskline/$ws/p/$key/time", params: { ws, key }, search: { by: "task" as const } }),
	search: (ws: string, q?: string) =>
		linkOptions({ to: "/app/taskline/$ws/search", params: { ws }, search: { q: q ?? "", page: 1 } }),
	settings: (
		ws: string,
		key: string,
		section: "general" | "members" | "workflow" | "labels" | "fields" | "automations" | "trash" = "general",
	) => linkOptions({ to: `/app/taskline/$ws/p/$key/settings/${section}` as const, params: { ws, key } }),
	task: (ws: string, ref: string) => linkOptions({ to: "/app/taskline/$ws/t/$ref", params: { ws, ref } }),
};

/** De-localized paths for redirects and `?redirect=` targets. */
export const TASKLINE_PATHS = { landing: "/app/taskline", home: "/app/taskline/home" } as const;
