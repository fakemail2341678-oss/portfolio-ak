import { z } from "zod";
import { listSchema } from "@/lib/crud/schema";
import { arrayParam, enumParam, pageParam, searchParam } from "@/lib/list/params";
import { REPORT_RANGES, TASK_TYPES } from "./types";

/**
 * Taskline's URL contracts (route files import these, never the form schemas, 0194).
 * Never strict: links carry utm tags.
 */

/** The project directory: cards or a list, the archived projects, and the create dialog (the palette opens it). */
export const projectsSearch = z.object({
	view: z.enum(["cards", "list"]).optional().catch(undefined),
	archived: z.literal(1).optional().catch(undefined),
	create: z.literal(1).optional().catch(undefined),
});

/** The inbox (Task 50): unread or everything, and the page. */
export const inboxSearch = z.object({
	filter: z.enum(["unread", "all"]).default("unread").catch("unread"),
	page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
});

/** An id filter: `all`, or one row's id (and, for the assignee, `none` or `me`). */
const idOr = <const T extends readonly [string, ...string[]]>(...words: T) =>
	z
		.union([z.enum(words), z.uuid()])
		.default(words[0])
		.catch(words[0]);

export const DUE_FILTERS = ["all", "overdue", "week", "none"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];
export const PRIORITY_FILTERS = ["all", "0", "1", "2", "3", "4"] as const;
export const BLOCKED_FILTERS = ["all", "yes", "no"] as const;

/**
 * Task 55: a custom field's filter, `<field id>:<value>` (`?cf=…&cf=…`, one per field;
 * what a value means is in features/taskline/fields.ts). Here, not there: route files
 * import this file, and the fields module would bring its messages and schemas along.
 */
export const FIELD_FILTER_PATTERN = /^([0-9a-f-]{36}):([\w-]{1,40})$/;

/**
 * The project's filters (the project layout's FilterBar): the board applies them to
 * the tasks it has, the list sends them to the server. Same URL, both views.
 */
export const taskFilterParams = {
	status: idOr("all"),
	assignee: idOr("all", "none", "me"),
	label: idOr("all"),
	priority: enumParam(PRIORITY_FILTERS, "all"),
	type: enumParam(["all", ...TASK_TYPES], "all"),
	due: enumParam(DUE_FILTERS, "all"),
	/** Task 52: the active sprint, the backlog (in no sprint), or one sprint. */
	sprint: idOr("all", "active", "none"),
	/** Task 54: one milestone, or none; blocked by an open task, or not. */
	milestone: idOr("all", "none"),
	blocked: enumParam(BLOCKED_FILTERS, "all"),
	/** Task 55: the custom fields' filters. */
	cf: arrayParam(z.string().regex(FIELD_FILTER_PATTERN), { max: 10 }),
};

export type TaskFilters = { q: string } & {
	[K in keyof typeof taskFilterParams]: z.output<(typeof taskFilterParams)[K]>;
};

/** `?task=WEB-12`: the task open in the sheet over a view (a masked route showing /$ws/t/WEB-12). */
const taskParam = z
	.string()
	.regex(/^[A-Z][A-Z0-9]{1,5}-[1-9][0-9]{0,8}$/)
	.optional()
	.catch(undefined);

export const SWIMLANES = ["none", "assignee", "priority"] as const;
export type Swimlanes = (typeof SWIMLANES)[number];

/** The board: the filters, swimlanes, and the open task. */
export const boardSearch = z.object({
	q: searchParam(),
	...taskFilterParams,
	swimlanes: enumParam(SWIMLANES, "none"),
	task: taskParam,
});

export const LIST_GROUPS = ["none", "status", "assignee"] as const;
export type ListGroup = (typeof LIST_GROUPS)[number];

/** The list: the filters, the list contract (sort, page, page size) and a grouping, server-side. */
export const taskList = listSchema({
	sorts: [
		"status",
		"-updated",
		"updated",
		"-number",
		"number",
		"title",
		"-title",
		"-priority",
		"priority",
		"due",
		"-due",
	],
	filters: { ...taskFilterParams, group: enumParam(LIST_GROUPS, "none") },
});
export const taskListSearch = taskList.search.extend({ task: taskParam });
/** The list's table: its saved page size, hidden columns and views. */
export const TASKS_TABLE_ID = "taskline-tasks";

// ---- Task 51: the calendar, search and My work ---------------------------------------------------

export const CALENDAR_MODES = ["month", "week"] as const;
export type CalendarMode = (typeof CALENDAR_MODES)[number];
/** Which date places a task on the calendar. */
export const CALENDAR_DATES = ["due", "start"] as const;
export type CalendarDate = (typeof CALENDAR_DATES)[number];

/** The calendar: the filters, month or week, by due or start date, the day it shows (omitted: today), and the open task. */
export const calendarSearch = z.object({
	q: searchParam(),
	...taskFilterParams,
	mode: enumParam(CALENDAR_MODES, "month"),
	by: enumParam(CALENDAR_DATES, "due"),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.catch(undefined),
	task: taskParam,
});

/** /$ws/search: the words (or a reference) and the page of results. */
export const SEARCH_PAGE_SIZE = 20;
export const taskSearchSearch = z.object({ q: searchParam(), page: pageParam(50) });

/** My work (Home): the tasks assigned to the caller, the ones they watch, or both. */
export const MY_WORK_SHOWS = ["assigned", "watching", "all"] as const;
export type MyWorkShow = (typeof MY_WORK_SHOWS)[number];
export const homeSearch = z.object({ show: enumParam(MY_WORK_SHOWS, "assigned") });

// ---- Task 52: the backlog and a sprint's report --------------------------------------------------

/** The backlog: the open task (a sheet, masked as its page). */
export const backlogSearch = z.object({ task: taskParam });

/** What a sprint's charts count: points, estimated hours (Task 53) or tasks (omitted: the project's estimation). */
export const SPRINT_MEASURES = ["points", "hours", "tasks"] as const;
export type SprintMeasure = (typeof SPRINT_MEASURES)[number];
export const sprintReportSearch = z.object({ by: z.enum(SPRINT_MEASURES).optional().catch(undefined) });

/** The project key of a task reference ("WEB-12" → "WEB"), or null when it isn't one (route files can't import schema.ts). */
export const keyOfRef = (ref: string): string | null => /^([A-Z][A-Z0-9]{1,5})-[1-9][0-9]{0,8}$/.exec(ref)?.[1] ?? null;

// ---- Task 53: time ------------------------------------------------------------------------------

const dayParam = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.optional()
	.catch(undefined);

/** My timesheet: the week holding `?week=` (omitted: this week). */
export const timesheetSearch = z.object({ week: dayParam });

/** A project's time: estimate against actual by task or by member, and the open task. */
export const PROJECT_TIME_VIEWS = ["task", "member"] as const;
export const projectTimeSearch = z.object({ by: enumParam(PROJECT_TIME_VIEWS, "task"), task: taskParam });

// ---- Task 57: reports -----------------------------------------------------------------------------

/** How many weeks a project's reports cover. */
export const projectReportsSearch = z.object({ range: enumParam(REPORT_RANGES, "12w") });

// ---- Task 54: the timeline ----------------------------------------------------------------------

export const TIMELINE_ZOOMS = ["day", "week", "month"] as const;
export type TimelineZoom = (typeof TIMELINE_ZOOMS)[number];
export const TIMELINE_GROUPS = ["none", "epic", "milestone", "assignee"] as const;
export type TimelineGroupBy = (typeof TIMELINE_GROUPS)[number];

/** The timeline: the filters, the zoom, the grouping, the day it's around (omitted: today), and the open task. */
export const timelineSearch = z.object({
	q: searchParam(),
	...taskFilterParams,
	zoom: enumParam(TIMELINE_ZOOMS, "week"),
	group: enumParam(TIMELINE_GROUPS, "none"),
	date: dayParam,
	task: taskParam,
});

/** The milestones page: the open task (a sheet, masked as its page). */
export const milestonesSearch = z.object({ task: taskParam });
