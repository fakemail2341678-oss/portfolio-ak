import { z } from "zod";
import type { Paged } from "@/lib/list/paging";
import { isoDate, optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { automationCondition, automationDefinition } from "../automation-rules";
import { fieldDefinition } from "../fields";
import { fieldChanges, LABEL_NAME_MAX, PROJECT_NAME_MAX, projectKey, TIME_NOTE_MAX, templateRef } from "../schema";
import { DEFAULT_STATUS_MAX, defaultStatus, TEAM_SLUG_PATTERN, workspaceSettings } from "../settings";
import {
	TEMPLATE_DESCRIPTION_MAX,
	TEMPLATE_NAME_MAX,
	type TemplateDefinition,
	templateDefinition,
} from "../template-definition";
import {
	type ActiveSprint,
	type Automation,
	type AutomationRun,
	DAY_MINUTES,
	PROJECT_HEALTHS,
	PROJECT_ROLES,
	PROJECT_STATUSES,
	PROJECT_VISIBILITIES,
	type ProjectHealth,
	type ProjectRole,
	type ProjectStatus,
	type ProjectVisibility,
	REPORT_RANGES,
	TASK_TYPES,
	TASKLINE_COLORS,
	type TaskActivity,
	type TaskField,
	type TasklineColor,
	type TasklineLabel,
	type TasklineMember,
	type TasklineStatus,
	type TaskType,
	TEAM_ROLES,
	type TeamRole,
	type TimeEntry,
} from "../types";

/**
 * /admin/taskline's inputs (strict, checked again on the server) and what its
 * functions return. The admin runs the team workspace only: sandboxes are their
 * owners', and the admin sees them as counts (PLAN 11.5).
 */

const id = z.uuid();
const color = z.enum(TASKLINE_COLORS);
export const TITLE_MAX = 80;
/** A week's capacity, in hours on the form and minutes on the server. */
export const CAPACITY_HOURS_MAX = 80;

// ---- Overview ---------------------------------------------------------------------------------

export type AdminWeekCount = { week: string; created: number; completed: number };

export type AdminProjectHealthRow = {
	id: string;
	key: string;
	name: string;
	color: TasklineColor;
	status: ProjectStatus;
	health: ProjectHealth | null;
	lead: string | null;
	open: number;
	overdue: number;
	done: number;
	targetOn: string | null;
	/** Task 57: when its lead last posted an update. */
	updatedOn: string | null;
};

export type AdminOverview = {
	stats: { activeProjects: number; openTasks: number; overdueTasks: number; doneThisWeek: number };
	weeks: AdminWeekCount[];
	projects: AdminProjectHealthRow[];
	/** Counts only: what is in the sandboxes is their owners'. */
	sandboxes: { total: number; guests: number; projects: number; tasks: number };
	/** Task 53: loggedThisWeek is the team's time this week, in minutes. */
	members: { active: number; invited: number; loggedThisWeek: number };
	today: string;
	/** Task 52: the team's active sprints, soonest ending first. */
	sprints: ActiveSprint[];
};

// ---- Projects -----------------------------------------------------------------------------------

export type AdminProjectItem = {
	id: string;
	key: string;
	name: string;
	color: TasklineColor;
	visibility: ProjectVisibility;
	status: ProjectStatus;
	health: ProjectHealth | null;
	lead: { id: string; name: string } | null;
	members: number;
	open: number;
	archived: boolean;
	updatedAt: string;
	/** The team's `$ws` segment: "Open in Taskline" links there. */
	ws: string;
};
export type AdminProjectPage = Paged<AdminProjectItem>;

export type AdminProjectMember = { memberId: string; name: string; email: string | null; role: ProjectRole };

export type AdminProjectDetail = AdminProjectItem & {
	description: string;
	startOn: string | null;
	targetOn: string | null;
	version: number;
	projectMembers: AdminProjectMember[];
	statuses: (TasklineStatus & { tasks: number })[];
	labels: (TasklineLabel & { tasks: number })[];
	counts: { tasks: number; done: number; trashed: number };
};

export const adminCreateProjectInput = z.strictObject({
	key: projectKey(),
	name: required({ max: PROJECT_NAME_MAX }),
	/** A team member; empty: no lead yet. */
	leadId: id.nullable(),
	visibility: z.enum(PROJECT_VISIBILITIES),
	color,
	/** Task 57: what it starts from, and the day its days count from (omitted: today). */
	template: templateRef.optional(),
	startOn: isoDate().nullable().optional(),
});
export type AdminCreateProjectInput = z.infer<typeof adminCreateProjectInput>;

/** The details tab, saved from the version it started from (`updatedAt` carries it, as every admin form). */
export const adminUpdateProjectInput = z.strictObject({
	id,
	updatedAt: z.string().regex(/^[1-9][0-9]*$/),
	name: required({ max: PROJECT_NAME_MAX }),
	visibility: z.enum(PROJECT_VISIBILITIES),
	color,
	startOn: isoDate().nullable(),
	targetOn: isoDate().nullable(),
});
export type AdminUpdateProjectInput = z.infer<typeof adminUpdateProjectInput>;

/** The create form's check while typing: whether a key is free. */
export const projectKeyInput = z.strictObject({ key: projectKey() });

export const adminProjectStateInput = z.strictObject({
	id,
	status: z.enum(PROJECT_STATUSES).exclude(["archived"]).optional(),
	health: z.enum(PROJECT_HEALTHS).nullable().optional(),
});
export const adminArchiveProjectInput = z.strictObject({ id, archived: z.boolean() });
export const adminTransferLeadInput = z.strictObject({ id, memberId: id });
/** Deleting takes the key typed again: what the confirm asks for. */
export const adminDeleteProjectInput = z.strictObject({ id, confirmKey: z.string().max(6) });
export const adminExportProjectInput = z.strictObject({ id, format: z.enum(["json", "csv"]) });
export const adminProjectMemberInput = z.strictObject({ id, memberId: id, role: z.enum(PROJECT_ROLES) });
export const adminRemoveProjectMemberInput = z.strictObject({ id, memberId: id });

export type ProjectExport = { filename: string; type: string; content: string };

// ---- Members and invitations -------------------------------------------------------------------

export type AdminMemberItem = {
	id: string;
	userId: string | null;
	name: string;
	email: string | null;
	role: TeamRole;
	title: string;
	capacityMinutesWeek: number;
	/** Open tasks assigned to them: their workload. */
	open: number;
	overdue: number;
	projects: number;
	deactivated: boolean;
	joinedAt: string;
};
export type AdminMemberPage = Paged<AdminMemberItem>;

export type AccountOption = { value: string; label: string };

export const searchAccountsInput = z.strictObject({ q: z.string().trim().max(80) });

export const addMembersInput = z.strictObject({
	userIds: z.array(z.string().min(1).max(64)).min(1).max(20),
	role: z.enum(TEAM_ROLES),
});

export const updateMemberInput = z.strictObject({
	id,
	role: z.enum(TEAM_ROLES),
	title: optionalText({ max: TITLE_MAX }),
	capacityMinutesWeek: z
		.number()
		.int()
		.min(0)
		.max(CAPACITY_HOURS_MAX * 60),
});
export type UpdateMemberInput = z.infer<typeof updateMemberInput>;

/** Their open tasks go to `reassignTo` (another active member), or are left unassigned (null). */
export const deactivateMemberInput = z.strictObject({ id, reassignTo: id.nullable() });
export const reactivateMemberInput = z.strictObject({ id });

export type AdminInvitation = {
	id: string;
	email: string;
	role: TeamRole;
	project: { id: string; key: string; name: string } | null;
	invitedBy: string | null;
	expiresAt: string;
	expired: boolean;
	createdAt: string;
};

export const inviteMemberInput = z.strictObject({
	email: z
		.email({ error: () => m.validation_email() })
		.max(254)
		.transform((email) => email.toLowerCase()),
	role: z.enum(TEAM_ROLES),
	/** Also added to this project (as a member), and the email's link lands there. */
	projectId: id.nullable(),
});
export type InviteMemberInput = z.input<typeof inviteMemberInput>;
export const invitationIdInput = z.strictObject({ id });

/** Days an invitation stays good; resending starts them again. */
export const INVITATION_DAYS = 7;

// ---- Settings and workflows -------------------------------------------------------------------

/** The workspace as the settings form edits it: its name and URL segment, and the settings it holds. */
export const workspaceForm = workspaceSettings.pick({
	projectCreation: true,
	defaultVisibility: true,
	membersCanJoin: true,
	workingDays: true,
	weekStart: true,
	timeZone: true,
	digestHour: true,
	notify: true,
	trashRetentionDays: true,
	doneColumnDays: true,
});

const quotas = z.strictObject({
	projects: z.number().int().positive().max(100_000),
	tasks: z.number().int().positive().max(10_000_000),
	statusesPerProject: z.number().int().positive().max(200),
	timeEntries: z.number().int().positive().max(100_000_000),
});

export const updateWorkspaceInput = z.strictObject({
	updatedAt: z.string().regex(/^[1-9][0-9]*$/),
	name: required({ max: 60 }),
	slug: z
		.string()
		.trim()
		.toLowerCase()
		.regex(TEAM_SLUG_PATTERN, { error: () => m.taskline_admin_validation_slug() }),
	settings: workspaceForm.extend({ quotas }).strict(),
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInput>;

export type AdminWorkspace = {
	id: string;
	name: string;
	slug: string;
	/** The version, as a string: what the form sends back (`updatedAt`, as every admin form). */
	updatedAt: string;
	settings: z.output<typeof workspaceForm> & { quotas: z.output<typeof quotas> };
	/** What exists now: the quotas can't go below it. */
	usage: { projects: number; tasks: number; statusesPerProject: number; timeEntries: number };
};

export type DefaultStatus = z.output<typeof defaultStatus>;

export type AdminWorkflows = {
	updatedAt: string;
	/** The statuses a new project starts with; `custom` false: the built-in ones, in the creator's language. */
	statuses: DefaultStatus[];
	custom: boolean;
	taskTypes: TaskType[];
	labels: (TasklineLabel & { tasks: number })[];
};

export const updateWorkflowsInput = z.strictObject({
	updatedAt: z.string().regex(/^[1-9][0-9]*$/),
	/** Null: back to the built-in statuses. */
	statuses: z.array(defaultStatus).min(2).max(DEFAULT_STATUS_MAX).nullable(),
	taskTypes: z.array(z.enum(TASK_TYPES)).min(1).max(TASK_TYPES.length),
});
export type UpdateWorkflowsInput = z.infer<typeof updateWorkflowsInput>;

export const workspaceLabelInput = z.strictObject({ name: required({ max: LABEL_NAME_MAX }), color });
export const updateWorkspaceLabelInput = workspaceLabelInput.extend({ id });
export const deleteWorkspaceLabelInput = z.strictObject({ id });

// ---- Custom fields (Task 55) --------------------------------------------------------------------

/** /admin/taskline/fields: the workspace's fields (on every team project's tasks), with how many tasks have a value. */
export type AdminField = TaskField & { tasks: number };
export type AdminFields = { fields: AdminField[] };

export const adminCreateFieldInput = z.strictObject({ field: fieldDefinition });
export const adminUpdateFieldInput = z.strictObject(fieldChanges);
export const adminDeleteFieldInput = z.strictObject({ id });
export type AdminCreateFieldInput = z.infer<typeof adminCreateFieldInput>;
export type AdminUpdateFieldInput = z.infer<typeof adminUpdateFieldInput>;

// ---- Automations (Task 56) ----------------------------------------------------------------------

/**
 * /admin/taskline/automations: the workspace's rules (on every team project's tasks),
 * the latest runs of every team automation, and what the builder offers a workspace
 * rule (the workspace's labels and fields, the active members).
 */
export type AdminAutomations = {
	/** The team's `$ws` (the runs' task links). */
	ws: string;
	automations: Automation[];
	runs: AutomationRun[];
	labels: TasklineLabel[];
	members: TasklineMember[];
	fields: TaskField[];
	/** When the server read it: relative times start from here, so both renders agree. */
	readAt: string;
};

export const adminCreateAutomationInput = z.strictObject({ automation: automationDefinition });
export const adminUpdateAutomationInput = z.strictObject({
	id,
	version: z.number().int().positive(),
	automation: automationDefinition,
});
export const adminToggleAutomationInput = z.strictObject({ id, enabled: z.boolean() });
export const adminDeleteAutomationInput = z.strictObject({ id });
export const adminPreviewAutomationInput = z.strictObject({ conditions: z.array(automationCondition).max(10) });
export type AdminCreateAutomationInput = z.infer<typeof adminCreateAutomationInput>;
export type AdminUpdateAutomationInput = z.infer<typeof adminUpdateAutomationInput>;

// ---- Activity -----------------------------------------------------------------------------------

export type AdminActivityEntry = TaskActivity & {
	project: { id: string; key: string; name: string };
	task: { ref: string; title: string } | null;
};

/** A page of the team's history, with what its sentences name (members, statuses). */
export type AdminActivityPage = Paged<AdminActivityEntry> & {
	members: TasklineMember[];
	statuses: TasklineStatus[];
};

/** The activity filters' choices: the team's projects and members. */
export type AdminActivityOptions = {
	projects: { id: string; key: string; name: string }[];
	members: { id: string; name: string }[];
};

// ---- Timesheets (Task 53) -----------------------------------------------------------------------

/** A page of the team's time, with its totals (every matching entry, not only the page's). */
export type AdminTimePage = Paged<TimeEntry> & { totalMinutes: number; billableMinutes: number };

/** The timesheets page's choices and state: members and projects to filter by, the lock date, the week. */
export type AdminTimeOptions = {
	members: { id: string; name: string }[];
	projects: { id: string; key: string; name: string }[];
	lockOn: string | null;
	today: string;
	weekStart: number;
};

/** Each active member's time over some days, against their capacity for those days. */
export type AdminUtilization = {
	from: string;
	to: string;
	rows: Array<{
		memberId: string;
		name: string;
		capacityMinutes: number;
		loggedMinutes: number;
		billableMinutes: number;
	}>;
};

/** The days utilization covers at most. */
export const UTILIZATION_DAYS_MAX = 92;

export const adminUpdateTimeEntryInput = z.strictObject({
	id,
	onDay: isoDate().optional(),
	minutes: z.number().int().min(1).max(DAY_MINUTES).optional(),
	note: optionalText({ max: TIME_NOTE_MAX }).optional(),
	billable: z.boolean().optional(),
});
export type AdminUpdateTimeEntryInput = z.infer<typeof adminUpdateTimeEntryInput>;
export const adminTimeEntryInput = z.strictObject({ id });
/** Entries on or before `lockOn` can't change (null: nothing is locked). */
export const timesheetLockInput = z.strictObject({ lockOn: isoDate().nullable() });
export const utilizationInput = z
	.strictObject({ from: isoDate(), to: isoDate() })
	.refine(
		(input) =>
			input.to >= input.from && (Date.parse(input.to) - Date.parse(input.from)) / 86_400_000 < UTILIZATION_DAYS_MAX,
		{ error: "A range of at most 92 days" },
	);
/** Exports at most this many entries (the filters narrow it). */
export const TIME_EXPORT_MAX = 10_000;

// ---- Templates (Task 57) ------------------------------------------------------------------------

const templateName = () => required({ max: TEMPLATE_NAME_MAX });
const templateDescription = () => optionalText({ max: TEMPLATE_DESCRIPTION_MAX });

export const adminCreateTemplateInput = z.strictObject({
	name: templateName(),
	description: templateDescription(),
	definition: templateDefinition,
});
export type AdminCreateTemplateInput = z.infer<typeof adminCreateTemplateInput>;
export const adminUpdateTemplateInput = adminCreateTemplateInput.extend({
	id,
	version: z.number().int().positive(),
});
export type AdminUpdateTemplateInput = z.infer<typeof adminUpdateTemplateInput>;
export const adminDeleteTemplateInput = z.strictObject({ id });
export const saveProjectAsTemplateInput = z.strictObject({
	projectId: id,
	name: templateName(),
	description: templateDescription(),
	/** Also the project's tasks, as samples. */
	tasks: z.boolean(),
});
export type SaveProjectAsTemplateInput = z.infer<typeof saveProjectAsTemplateInput>;

/** A template on the admin's page. A built-in reads only: `version` 0 and no `updatedAt`. */
export type AdminTemplate = {
	id: string;
	name: string;
	description: string;
	builtin: boolean;
	version: number;
	updatedAt: string | null;
	definition: TemplateDefinition;
};
export type AdminTemplates = { builtins: AdminTemplate[]; templates: AdminTemplate[] };
/** What "Save project as template" made; `leftOut`: the rules that name what a template can't hold. */
export type SavedProjectTemplate = { id: string; name: string; leftOut: number };

// ---- Reports (Task 57) --------------------------------------------------------------------------

export const adminReportsInput = z.strictObject({ range: z.enum(REPORT_RANGES) });

export type AdminReportHealth = {
	id: string;
	key: string;
	name: string;
	color: TasklineColor;
	status: ProjectStatus;
	health: ProjectHealth | null;
	lead: string | null;
	/** Completed tasks out of those not canceled, 0 to 1; null with no tasks. */
	progress: number | null;
	open: number;
	overdue: number;
	milestonesAtRisk: number;
	lastActivityAt: string | null;
	update: { health: ProjectHealth; at: string; author: string | null } | null;
	targetOn: string | null;
};
export type AdminReportWorkload = {
	memberId: string;
	name: string;
	capacityMinutes: number;
	open: number;
	overdue: number;
	/** Estimates of all their open tasks, and of those due within a week or overdue. */
	estimateMinutes: number;
	dueSoonMinutes: number;
};
export type AdminReportTime = { id: string; label: string; minutes: number; billableMinutes: number };
export type AdminReports = {
	today: string;
	readAt: string;
	/** The first day the time covers. */
	from: string;
	health: AdminReportHealth[];
	workload: AdminReportWorkload[];
	timeByProject: AdminReportTime[];
	timeByMember: AdminReportTime[];
};
