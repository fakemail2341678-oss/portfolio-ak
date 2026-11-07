import { z } from "zod";
import { isOrderKey } from "@/lib/fractional-index";
import { isoDate, optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { automationCondition, automationDefinition } from "./automation-rules";
import { FIELD_NAME_MAX, fieldDefinition, fieldOptions, fieldValuesPatch } from "./fields";
import { recurrenceRule } from "./recurrence";
import { taskList } from "./search";
import { projectSettings } from "./settings";
import {
	BUILTIN_TEMPLATES,
	DAY_MINUTES,
	DEPENDENCY_RELATIONS,
	ESTIMATE_MAX_MINUTES,
	NOTIFY_KINDS,
	NOTIFY_MODES,
	POINTS_MAX,
	PROJECT_HEALTHS,
	PROJECT_ROLES,
	PROJECT_STATUSES,
	PROJECT_VISIBILITIES,
	REPORT_RANGES,
	SAVED_VIEW_KINDS,
	SPRINT_CARRY,
	STATUS_CATEGORIES,
	TASK_TYPES,
	TASKLINE_COLORS,
} from "./types";

/**
 * Taskline's inputs, checked on the server (and, from Task 47, by the forms). Every
 * input names its workspace (`ws`: the team's slug or `sandbox`) and, below it, a
 * project (`key`) or a task (`ref`, "WEB-12"): the resolver starts from those.
 * Ids of new rows may come from the browser, so an optimistic row and the saved one
 * share their key (as Kanban's, 0188).
 */

export const PROJECT_NAME_MAX = 80;
export const PROJECT_DESCRIPTION_MAX = 20_000;
export const STATUS_NAME_MAX = 40;
export const LABEL_NAME_MAX = 40;
export const TASK_TITLE_MAX = 240;
export const TASK_DESCRIPTION_MAX = 50_000;
export const CHECKLIST_MAX = 50;
export const LABELS_PER_TASK_MAX = 10;

/** 2–6 capitals and digits, a letter first: "WEB", "APP2". */
export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;
/** A task's reference: its project's key and its number. */
export const TASK_REF_PATTERN = /^([A-Z][A-Z0-9]{1,5})-([1-9][0-9]{0,8})$/;

const id = z.uuid();
const position = z.string().refine(isOrderKey);
const color = z.enum(TASKLINE_COLORS);
const points = z.number().int().min(0).max(POINTS_MAX);
const estimate = z.number().int().min(0).max(ESTIMATE_MAX_MINUTES);

export const ws = () => z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/);
export const projectKey = () =>
	z
		.string()
		.trim()
		.toUpperCase()
		.regex(PROJECT_KEY_PATTERN, { error: () => m.taskline_validation_key() });
/** A key from a name: its initials, or its first letters ("Website relaunch" → "WR", "Operations" → "OPE"). */
export const suggestKey = (name: string): string => {
	const words = name
		.normalize("NFKD")
		.toUpperCase()
		.replace(/[^A-Z0-9 ]/g, "")
		.split(/\s+/)
		.filter(Boolean);
	const initials = words.length > 1 ? words.map((word) => word[0]).join("") : (words[0] ?? "").slice(0, 3);
	const key = initials.replace(/^[0-9]+/, "").slice(0, 6);
	return key.length >= 2 ? key : "";
};

export const taskRef = () => z.string().regex(TASK_REF_PATTERN);

/** "WEB-12" → { key: "WEB", number: 12 }; null when it isn't a reference. */
export const parseTaskRef = (ref: string): { key: string; number: number } | null => {
	const match = TASK_REF_PATTERN.exec(ref);
	return match?.[1] && match[2] ? { key: match[1], number: Number(match[2]) } : null;
};

export const wsInput = z.strictObject({ ws: ws() });
export const projectInput = z.strictObject({ ws: ws(), key: projectKey() });
export const taskInput = z.strictObject({ ws: ws(), ref: taskRef() });

// ---- Projects -------------------------------------------------------------------------------

export const listProjectsInput = z.strictObject({ ws: ws(), archived: z.boolean().optional() });

const projectFields = {
	name: required({ max: PROJECT_NAME_MAX }),
	description: optionalText({ max: PROJECT_DESCRIPTION_MAX }).optional(),
	color: color.optional(),
	icon: optionalText({ max: 8 }).optional(),
	visibility: z.enum(PROJECT_VISIBILITIES).optional(),
	startOn: isoDate().nullable().optional(),
	targetOn: isoDate().nullable().optional(),
};

/** A built-in template's id or a saved one's (Task 57). */
export const templateRef = z.union([z.enum(BUILTIN_TEMPLATES), id]);

export const createProjectInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	...projectFields,
	template: templateRef.optional(),
});

/** The project form: everything it shows, saved with the version it started from. */
export const updateProjectInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	version: z.number().int().positive(),
	...projectFields,
	settings: projectSettings.partial().optional(),
});

export const setProjectStateInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	status: z.enum(PROJECT_STATUSES).exclude(["archived"]).optional(),
	health: z.enum(PROJECT_HEALTHS).nullable().optional(),
});

export const setProjectArchivedInput = z.strictObject({ ws: ws(), key: projectKey(), archived: z.boolean() });
export const setProjectStarInput = z.strictObject({ ws: ws(), key: projectKey(), starred: z.boolean() });

export const setProjectMemberInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	memberId: id,
	role: z.enum(PROJECT_ROLES),
});
export const removeProjectMemberInput = z.strictObject({ ws: ws(), key: projectKey(), memberId: id });

// ---- Statuses and labels --------------------------------------------------------------------

export const createStatusInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	id: id.optional(),
	name: required({ max: STATUS_NAME_MAX }),
	category: z.enum(STATUS_CATEGORIES),
	color: color.optional(),
	/** Omitted: after the last status. */
	position: position.optional(),
	wipLimit: z.number().int().positive().max(999).nullable().optional(),
});

export const updateStatusInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	id,
	name: required({ max: STATUS_NAME_MAX }).optional(),
	category: z.enum(STATUS_CATEGORIES).optional(),
	color: color.optional(),
	position: position.optional(),
	wipLimit: z.number().int().positive().max(999).nullable().optional(),
});

/** A status with tasks moves them to `moveTo` (trashed ones too) before it goes. */
export const deleteStatusInput = z.strictObject({ ws: ws(), key: projectKey(), id, moveTo: id.optional() });

export const createLabelInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	id: id.optional(),
	name: required({ max: LABEL_NAME_MAX }),
	color: color.optional(),
});
export const updateLabelInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	id,
	name: required({ max: LABEL_NAME_MAX }).optional(),
	color: color.optional(),
});
export const deleteLabelInput = z.strictObject({ ws: ws(), key: projectKey(), id });

// ---- Tasks ----------------------------------------------------------------------------------

const labelIds = z
	.array(id)
	.max(LABELS_PER_TASK_MAX)
	.refine((ids) => new Set(ids).size === ids.length);

export const checklistItem = z.strictObject({ id, text: required({ max: TASK_TITLE_MAX }), done: z.boolean() });

export const createTaskInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	id: id.optional(),
	title: required({ max: TASK_TITLE_MAX }),
	description: optionalText({ max: TASK_DESCRIPTION_MAX }).optional(),
	type: z.enum(TASK_TYPES).optional(),
	/** Omitted: the project's first status that isn't backlog (or its first). */
	statusId: id.optional(),
	/** Omitted: at the end of its status. */
	position: position.optional(),
	priority: z.number().int().min(0).max(4).optional(),
	assigneeId: id.nullable().optional(),
	parentId: id.nullable().optional(),
	labelIds: labelIds.optional(),
	startOn: isoDate().nullable().optional(),
	dueOn: isoDate().nullable().optional(),
	/** Task 52: planned in a sprint (omitted: the backlog), and its estimate. */
	sprintId: id.nullable().optional(),
	points: points.nullable().optional(),
	/** Task 53: the estimate in minutes. */
	estimateMinutes: estimate.nullable().optional(),
	/** Task 54: the milestone it leads to. */
	milestoneId: id.nullable().optional(),
	/** Task 55: custom field values by field id (checked against the fields by the server). */
	fields: fieldValuesPatch().optional(),
});

/** The title and description: saved with the version they started from. */
export const updateTaskInput = z.strictObject({
	ws: ws(),
	ref: taskRef(),
	version: z.number().int().positive(),
	title: required({ max: TASK_TITLE_MAX }),
	description: optionalText({ max: TASK_DESCRIPTION_MAX }),
});

/** One or more single fields, last write wins (each change is in the task's history). */
export const patchTaskInput = z.strictObject({
	ws: ws(),
	ref: taskRef(),
	type: z.enum(TASK_TYPES).optional(),
	priority: z.number().int().min(0).max(4).optional(),
	assigneeId: id.nullable().optional(),
	parentId: id.nullable().optional(),
	labelIds: labelIds.optional(),
	startOn: isoDate().nullable().optional(),
	dueOn: isoDate().nullable().optional(),
	sprintId: id.nullable().optional(),
	points: points.nullable().optional(),
	estimateMinutes: estimate.nullable().optional(),
	milestoneId: id.nullable().optional(),
	/** Task 55: custom field values to set (null clears one); the others stay. */
	fields: fieldValuesPatch().optional(),
	/** Task 56: how it repeats (null: it stops repeating). */
	recurrence: recurrenceRule.nullable().optional(),
});

/** A drop on the board: a status and a position in it (an order key the browser computed). */
export const moveTaskInput = z.strictObject({ ws: ws(), ref: taskRef(), statusId: id, position });

/** A drop on the backlog (Task 52): a sprint (null: the backlog) and a rank (an order key the browser computed). */
export const rankTaskInput = z.strictObject({ ws: ws(), ref: taskRef(), sprintId: id.nullable(), rank: position });
export type RankTaskInput = z.infer<typeof rankTaskInput>;

export const setChecklistInput = z.strictObject({
	ws: ws(),
	ref: taskRef(),
	checklist: z.array(checklistItem).max(CHECKLIST_MAX),
});

/** The list view's page: the list contract (taskList, search.ts) in a project. */
export const taskListInput = taskList.input.extend({ ws: ws(), key: projectKey() });
export type TaskListInput = z.infer<typeof taskListInput>;

export const BULK_MAX = 100;

/**
 * The list's bulk actions on selected tasks of one project: one change at a time
 * (a status, an assignee, a priority, a label added or removed, or the trash).
 */
export const bulkTasksInput = z
	.strictObject({
		ws: ws(),
		key: projectKey(),
		ids: z.array(id).min(1).max(BULK_MAX),
		statusId: id.optional(),
		assigneeId: id.nullable().optional(),
		priority: z.number().int().min(0).max(4).optional(),
		addLabelId: id.optional(),
		removeLabelId: id.optional(),
		trash: z.literal(true).optional(),
	})
	.refine(
		(input) =>
			[input.statusId, input.assigneeId, input.priority, input.addLabelId, input.removeLabelId, input.trash].filter(
				(value) => value !== undefined,
			).length === 1,
		{ error: "One change at a time" },
	);
export type BulkTasksInput = z.infer<typeof bulkTasksInput>;

// ---- Comments, watching, files and notifications (Task 50) ---------------------------------

export const COMMENT_MAX = 20_000;
export const FILES_PER_CHANGE_MAX = 10;

const files = z
	.array(id)
	.max(FILES_PER_CHANGE_MAX)
	.refine((ids) => new Set(ids).size === ids.length);

/** A comment: rich text (mentions are member ids in it, which the server reads itself) and the files uploaded for it. */
export const addCommentInput = z.strictObject({
	ws: ws(),
	ref: taskRef(),
	body: optionalText({ max: COMMENT_MAX }),
	attachmentIds: files.optional(),
});
export const updateCommentInput = z.strictObject({
	ws: ws(),
	ref: taskRef(),
	id,
	body: optionalText({ max: COMMENT_MAX }),
});
export const deleteCommentInput = z.strictObject({ ws: ws(), ref: taskRef(), id });
export const watchTaskInput = z.strictObject({ ws: ws(), ref: taskRef(), watching: z.boolean() });
export const taskFilesInput = z.strictObject({ ws: ws(), ref: taskRef(), ids: files.min(1) });
export const taskFileInput = z.strictObject({ ws: ws(), ref: taskRef(), id });
export const confirmFileInput = z.strictObject({ publicId: z.string().min(1).max(255) });
export const fileIdInput = z.strictObject({ id });

export const INBOX_PAGE = 30;
export const inboxInput = z.strictObject({
	filter: z.enum(["unread", "all"]),
	page: z.number().int().min(1).max(1000),
});
/** Marks some of the caller's notifications read (or unread), or all of them read. */
export const markReadInput = z.union([
	z.strictObject({ ids: z.array(id).min(1).max(100), read: z.boolean() }),
	z.strictObject({ all: z.literal(true) }),
]);
/** The caller's modes per kind (missing: the team's default) and their email language. */
export const notifySettingsInput = z.strictObject({
	modes: z.partialRecord(z.enum(NOTIFY_KINDS), z.enum(NOTIFY_MODES)),
	locale: z.enum(["en", "ne"]).nullable(),
});

// ---- Task 57: project updates and reports ----------------------------------------------------------

export const postProjectUpdateInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	health: z.enum(PROJECT_HEALTHS),
	body: optionalText({ max: COMMENT_MAX }),
});
export const deleteProjectUpdateInput = z.strictObject({ ws: ws(), key: projectKey(), id });
export const projectReportsInput = z.strictObject({ ws: ws(), key: projectKey(), range: z.enum(REPORT_RANGES) });
export type PostProjectUpdateInput = z.infer<typeof postProjectUpdateInput>;
export type DeleteProjectUpdateInput = z.infer<typeof deleteProjectUpdateInput>;

export type AddCommentInput = z.infer<typeof addCommentInput>;
export type UpdateCommentInput = z.infer<typeof updateCommentInput>;
export type DeleteCommentInput = z.infer<typeof deleteCommentInput>;
export type TaskFilesInput = z.infer<typeof taskFilesInput>;
export type InboxInput = z.infer<typeof inboxInput>;
export type MarkReadInput = z.infer<typeof markReadInput>;
export type NotifySettingsInput = z.infer<typeof notifySettingsInput>;

// ---- Saved views, search and the CSV import (Task 51) ---------------------------------------

export const SAVED_VIEW_NAME_MAX = 60;
/** Views one member keeps per project (shared ones included). */
export const SAVED_VIEWS_MAX = 50;
/** A view's search string: "" or "?…", no fragment, no spaces. */
export const VIEW_SEARCH_PATTERN = /^(?:\?[^#\s]{0,1999})?$/;

export const savedViewsInput = z.strictObject({ ws: ws(), key: projectKey(), view: z.enum(SAVED_VIEW_KINDS) });
export const saveViewInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	view: z.enum(SAVED_VIEW_KINDS),
	name: required({ max: SAVED_VIEW_NAME_MAX }),
	search: z.string().regex(VIEW_SEARCH_PATTERN),
	shared: z.boolean(),
});
export const deleteViewInput = z.strictObject({ ws: ws(), key: projectKey(), id });

/** /$ws/search's question: words (ranked full-text search) or a reference ("WEB-12"). */
export const searchTasksInput = z.strictObject({
	ws: ws(),
	q: z.string().trim().min(1).max(80),
	page: z.number().int().min(1).max(50),
});
/** The palette's question: across the caller's workspaces, the best few. */
export const findTasksInput = z.strictObject({ q: z.string().trim().min(2).max(80) });

export const IMPORT_ROWS_MAX = 1000;
export const IMPORT_DESCRIPTION_MAX = 5000;
export const IMPORT_NAME_MAX = 120;

const importName = z.string().trim().max(IMPORT_NAME_MAX);

/**
 * One row of a CSV import of tasks, as the import dialog sends it after mapping (and
 * the server checks again): names (a status, an assignee, labels) are matched on the
 * server without case; one that matches nothing is left blank and reported.
 */
export const importTaskRow = z.object({
	title: required({ max: TASK_TITLE_MAX }),
	/** Plain text: the server escapes it into paragraphs. */
	description: z.string().max(IMPORT_DESCRIPTION_MAX),
	type: z.enum(TASK_TYPES).nullable(),
	status: importName,
	assignee: importName,
	priority: z.number().int().min(0).max(4),
	labels: z.array(z.string().trim().min(1).max(LABEL_NAME_MAX)).max(LABELS_PER_TASK_MAX),
	startOn: isoDate().nullable(),
	dueOn: isoDate().nullable(),
	/** Task 55: custom field values, already typed by the dialog (option and member names matched there). */
	fields: fieldValuesPatch().optional(),
});
export type ImportTaskRow = z.infer<typeof importTaskRow>;

export const importTasksInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	/** One key per import the user means to make (docs/guides/routing-data.md, "Idempotency keys"). */
	idempotencyKey: id,
	rows: z.array(importTaskRow).min(1).max(IMPORT_ROWS_MAX),
});

export type SaveViewInput = z.infer<typeof saveViewInput>;
export type ImportTasksInput = z.infer<typeof importTasksInput>;

// ---- Sprints (Task 52) ----------------------------------------------------------------------

export const SPRINT_NAME_MAX = 60;
export const SPRINT_GOAL_MAX = 500;
/** A sprint lasts at most this many days. */
export const SPRINT_DAYS_MAX = 60;
/** Sprints a project keeps planned at once. */
export const PLANNED_SPRINTS_MAX = 10;

const sprintFields = {
	name: required({ max: SPRINT_NAME_MAX }),
	goal: optionalText({ max: SPRINT_GOAL_MAX }).optional(),
	startOn: isoDate(),
	endOn: isoDate(),
};

/** The dates' order and length, as a field error on `endOn` (the form shows it under the end date). */
const sprintDates = <T extends { startOn?: string; endOn?: string }>(input: T, context: z.RefinementCtx) => {
	if (!input.startOn || !input.endOn) return;
	if (input.endOn < input.startOn) {
		context.addIssue({ code: "custom", path: ["endOn"], message: m.taskline_sprint_error_dates() });
		return;
	}
	const days = (Date.parse(input.endOn) - Date.parse(input.startOn)) / 86_400_000 + 1;
	if (days > SPRINT_DAYS_MAX) {
		context.addIssue({
			code: "custom",
			path: ["endOn"],
			message: m.taskline_sprint_error_length({ days: SPRINT_DAYS_MAX }),
		});
	}
};

export const createSprintInput = z
	.strictObject({ ws: ws(), key: projectKey(), ...sprintFields })
	.superRefine(sprintDates);
export const updateSprintInput = z
	.strictObject({
		ws: ws(),
		key: projectKey(),
		id,
		name: sprintFields.name.optional(),
		goal: sprintFields.goal,
		startOn: isoDate().optional(),
		endOn: isoDate().optional(),
	})
	.superRefine(sprintDates);
export const sprintInput = z.strictObject({ ws: ws(), key: projectKey(), id });
/**
 * Completing the active sprint: its unfinished tasks go to the backlog, to a planned
 * sprint (`nextId`), or to a new sprint that starts the next day, as long as this one was.
 */
export const completeSprintInput = z
	.strictObject({ ws: ws(), key: projectKey(), id, carryTo: z.enum(SPRINT_CARRY), nextId: id.optional() })
	.refine((input) => (input.carryTo === "next") === (input.nextId !== undefined), {
		error: "A next sprint with `next`, none otherwise",
	});

export type CreateSprintInput = z.infer<typeof createSprintInput>;
export type UpdateSprintInput = z.infer<typeof updateSprintInput>;
export type CompleteSprintInput = z.infer<typeof completeSprintInput>;

// ---- Time tracking (Task 53) ----------------------------------------------------------------

export const TIME_NOTE_MAX = 500;
/** Entries the task shows (the newest); the project's time page shows as many. */
export const TASK_TIME_ENTRIES = 50;

const minutes = z.number().int().min(1).max(DAY_MINUTES);
const timeNote = optionalText({ max: TIME_NOTE_MAX });

/** Time logged by hand on a task: a day, how long, a note, billable. */
export const logTimeInput = z.strictObject({
	ws: ws(),
	ref: taskRef(),
	onDay: isoDate(),
	minutes,
	note: timeNote.optional(),
	billable: z.boolean().optional(),
});
/** An entry changed (the caller's own, or anyone's in the team with `taskline:time`). */
export const updateTimeEntryInput = z.strictObject({
	ws: ws(),
	id,
	onDay: isoDate().optional(),
	minutes: minutes.optional(),
	note: timeNote.optional(),
	billable: z.boolean().optional(),
});
export const timeEntryInput = z.strictObject({ ws: ws(), id });
/** The timesheet of the week holding `week` (any of its days). */
export const timesheetInput = z.strictObject({ ws: ws(), week: isoDate() });
/** A timesheet cell's new total (0 clears it). */
export const timesheetCellInput = z.strictObject({
	ws: ws(),
	ref: taskRef(),
	onDay: isoDate(),
	minutes: z.number().int().min(0).max(DAY_MINUTES),
});

export type LogTimeInput = z.infer<typeof logTimeInput>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntryInput>;
export type TimesheetCellInput = z.infer<typeof timesheetCellInput>;

// ---- Timeline, milestones and dependencies (Task 54) ----------------------------------------

export const MILESTONE_NAME_MAX = 80;
export const MILESTONE_DESCRIPTION_MAX = 2000;

export const createMilestoneInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	id: id.optional(),
	name: required({ max: MILESTONE_NAME_MAX }),
	description: optionalText({ max: MILESTONE_DESCRIPTION_MAX }).optional(),
	dueOn: isoDate().nullable().optional(),
});
/** A milestone's fields, its place (an order key the browser computed), or whether it's complete. */
export const updateMilestoneInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	id,
	name: required({ max: MILESTONE_NAME_MAX }).optional(),
	description: optionalText({ max: MILESTONE_DESCRIPTION_MAX }).optional(),
	dueOn: isoDate().nullable().optional(),
	position: position.optional(),
	completed: z.boolean().optional(),
});
export const milestoneInput = z.strictObject({ ws: ws(), key: projectKey(), id });

/** A dependency seen from the task `ref`: `other` blocks it (`blocked_by`) or it blocks `other` (`blocks`). */
export const dependencyInput = z.strictObject({
	ws: ws(),
	ref: taskRef(),
	relation: z.enum(DEPENDENCY_RELATIONS),
	other: taskRef(),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneInput>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneInput>;
export type DependencyInput = z.infer<typeof dependencyInput>;

// ---- Custom fields (Task 55) ----------------------------------------------------------------

/** A project's own field (its lead's): what it is, in the definition's shape. */
export const createFieldInput = z.strictObject({ ws: ws(), key: projectKey(), field: fieldDefinition });
/**
 * A field's changes: its name, whether it's required, a select's options (an option
 * left out comes off every task), archived or not, or its place (an order key). Its
 * type never changes: values of one type don't become another's.
 */
export const fieldChanges = {
	id,
	name: required({ max: FIELD_NAME_MAX }).optional(),
	required: z.boolean().optional(),
	options: fieldOptions().optional(),
	archived: z.boolean().optional(),
	position: position.optional(),
};
export const updateFieldInput = z.strictObject({ ws: ws(), key: projectKey(), ...fieldChanges });
export const deleteFieldInput = z.strictObject({ ws: ws(), key: projectKey(), id });

export type CreateFieldInput = z.infer<typeof createFieldInput>;
export type UpdateFieldInput = z.infer<typeof updateFieldInput>;
export type FieldChanges = Omit<UpdateFieldInput, "ws" | "key">;

// ---- Automations (Task 56) -----------------------------------------------------------------

/** A project's own automations (its lead's), as the builder saves them. */
export const createAutomationInput = z.strictObject({ ws: ws(), key: projectKey(), automation: automationDefinition });
/** The builder's form, against the version it started from. */
export const updateAutomationInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	id,
	version: z.number().int().positive(),
	automation: automationDefinition,
});
/** On or off at once (last write wins; the version stays). */
export const toggleAutomationInput = z.strictObject({ ws: ws(), key: projectKey(), id, enabled: z.boolean() });
export const automationInput = z.strictObject({ ws: ws(), key: projectKey(), id });
/** The builder's "would match N open tasks". */
export const previewAutomationInput = z.strictObject({
	ws: ws(),
	key: projectKey(),
	conditions: z.array(automationCondition).max(10),
});

export type CreateAutomationInput = z.infer<typeof createAutomationInput>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationInput>;
export type ToggleAutomationInput = z.infer<typeof toggleAutomationInput>;
export type PreviewAutomationInput = z.infer<typeof previewAutomationInput>;

/** A project by id: where an old Kanban board's link goes (0210). */
export const projectByIdInput = z.strictObject({ id });

export type CreateProjectInput = z.infer<typeof createProjectInput>;
export type UpdateProjectInput = z.infer<typeof updateProjectInput>;
export type SetProjectStateInput = z.infer<typeof setProjectStateInput>;
export type CreateStatusInput = z.infer<typeof createStatusInput>;
export type UpdateStatusInput = z.infer<typeof updateStatusInput>;
export type CreateLabelInput = z.infer<typeof createLabelInput>;
export type UpdateLabelInput = z.infer<typeof updateLabelInput>;
export type CreateTaskInput = z.infer<typeof createTaskInput>;
export type UpdateTaskInput = z.infer<typeof updateTaskInput>;
export type PatchTaskInput = z.infer<typeof patchTaskInput>;
