/**
 * Taskline's shapes, shared by the tables, the server and (from Task 47) the pages
 * (docs/guides/taskline.md). No imports: the schema files import these types, and
 * drizzle-kit loads them without the app's aliases.
 */

/** `team`: the one workspace the admin runs. `sandbox`: one per user, private, seeded for guests (0203). */
export const WORKSPACE_KINDS = ["team", "sandbox"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

/** The `$ws` segment that means "the caller's own sandbox". */
export const SANDBOX_SEGMENT = "sandbox";

/** A team member's role: `viewer` reads and comments, `member` also edits team-visible projects. */
export const TEAM_ROLES = ["member", "viewer"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const PROJECT_ROLES = ["lead", "member", "viewer"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

/** `team`: every team member sees it. `private`: only its project members (and the admins). */
export const PROJECT_VISIBILITIES = ["team", "private"] as const;
export type ProjectVisibility = (typeof PROJECT_VISIBILITIES)[number];

export const PROJECT_STATUSES = ["active", "paused", "completed", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_HEALTHS = ["on_track", "at_risk", "off_track"] as const;
export type ProjectHealth = (typeof PROJECT_HEALTHS)[number];

/** What a status means, whatever it's called: `completed` and `canceled` close a task (`completed_at`). */
export const STATUS_CATEGORIES = ["backlog", "unstarted", "started", "completed", "canceled"] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];
export const isClosedCategory = (category: StatusCategory) => category === "completed" || category === "canceled";

export const TASK_TYPES = ["task", "bug", "story", "epic"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

/** 0 none, 1 low, 2 medium, 3 high, 4 urgent. */
export const TASK_PRIORITIES = [0, 1, 2, 3, 4] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** A task's subtasks nest at most this deep: an epic (0), its story (1), the story's subtask (2). */
export const MAX_TASK_DEPTH = 2;

/**
 * Colours of projects, statuses and labels, stored by name (as the apps' palette,
 * 0192) so the values can be retuned without touching rows. The CSS values come
 * with the pages (Task 47).
 */
export const TASKLINE_COLORS = [
	"gray",
	"red",
	"orange",
	"amber",
	"green",
	"teal",
	"blue",
	"indigo",
	"violet",
	"pink",
] as const;
export type TasklineColor = (typeof TASKLINE_COLORS)[number];

export type ChecklistItem = { id: string; text: string; done: boolean };

/** How a member hears about one kind of event (Task 50): an email at once, the daily digest, or nothing. */
export const NOTIFY_MODES = ["instant", "digest", "off"] as const;
export type NotifyMode = (typeof NOTIFY_MODES)[number];

/**
 * The kinds of notification a member can tune. Task 50 sends assigned, mentioned,
 * comment and status (on a watched task), due (tomorrow), overdue and added (to a
 * project); invited, sprint, automation and timer come with their modules.
 */
export const NOTIFY_KINDS = [
	"assigned",
	"mentioned",
	"comment",
	"status",
	"due",
	"overdue",
	"added",
	"invited",
	"sprint",
	"automation",
	"timer",
] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];
export type NotificationKind = NotifyKind;
/** What a notification's row says about email, fixed when it's made from the recipient's mode. */
export type NotificationEmail = "instant" | "digest" | "none";
/** A notification's snapshot: what its sentence needs even after the task changes or goes. */
export type NotificationData = {
	actor?: string;
	ref?: string;
	title?: string;
	project?: string;
	status?: string;
	excerpt?: string;
	dueOn?: string;
	/** Task 52: the sprint's name, and whether it started or completed. */
	sprint?: string;
	sprintEvent?: "started" | "completed";
	/** Task 53: how long a timer the daily job stopped had counted. */
	minutes?: number;
	/** Task 56: the automation that caused it, and its "notify" action's message. */
	automation?: string;
	message?: string;
};

/** Everything `tl_activity.kind` holds; `data` carries the change (`{ from, to }` and the like). */
export const ACTIVITY_KINDS = [
	"project.created",
	"project.updated",
	"project.state",
	"project.archived",
	"project.restored",
	"project.member_added",
	"project.member_removed",
	"status.created",
	"status.updated",
	"status.deleted",
	"label.created",
	"label.updated",
	"label.deleted",
	"task.created",
	"task.updated",
	"task.moved",
	"task.trashed",
	"task.restored",
	"task.checklist",
	/** Deleted for good from the trash (Task 48): a project entry with the task's ref and title, its own history gone. */
	"task.deleted",
	/** Task 50: `{ commentId }`; the comment's body is in `tl_comment`. */
	"comment.added",
	"comment.deleted",
	/** Task 50: `{ attachmentId, name }`. */
	"attachment.added",
	"attachment.removed",
	/** Task 52: `{ sprintId, name }` (and on completion the points and where the open tasks went). */
	"sprint.created",
	"sprint.updated",
	"sprint.deleted",
	"sprint.started",
	"sprint.completed",
	/** Task 53: `{ minutes, entryId }` (and `auto: true` when the daily job stopped a forgotten timer). */
	"time.logged",
	/** Task 54: `{ milestoneId, name }`. */
	"milestone.created",
	"milestone.updated",
	"milestone.deleted",
	"milestone.completed",
	"milestone.reopened",
	/** Task 54, on each task's history: `{ relation: "blocks" | "blocked_by", ref, title }`, the other task. */
	"dependency.added",
	"dependency.removed",
	/** Task 55, a project's own fields: `{ id, name }` (and `archived` when archived or restored). */
	"field.created",
	"field.updated",
	"field.deleted",
	/** Task 56, a project's own automations: `{ id, name }` (and `enabled` when switched). */
	"automation.created",
	"automation.updated",
	"automation.deleted",
	/** Task 56, on a repeating task's history once it's closed: `{ ref }`, the next task of its series. */
	"task.recurred",
	/** Task 57: `{ updateId, health }`. */
	"project.update_posted",
	"project.update_deleted",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** Sandbox limits (11.5); the team's are in its settings. */
export const SANDBOX_QUOTAS = { projects: 5, tasks: 1000, statusesPerProject: 20, timeEntries: 500 } as const;
export type TasklineQuotas = { projects: number; tasks: number; statusesPerProject: number; timeEntries: number };

// ---- What the server returns (DTOs) -----------------------------------------------------------

export type WorkspaceSummary = { id: string; kind: WorkspaceKind; slug: string; name: string; segment: string };

/** What a caller may do in a project (src/server/taskline/access.ts, the table in docs/guides/taskline.md). */
export type ProjectCan = { view: boolean; comment: boolean; edit: boolean; manage: boolean; logTime: boolean };

export type TasklineMember = {
	id: string;
	userId: string | null;
	name: string;
	role: TeamRole;
	title: string;
	/** A sandbox's made-up teammate, or a deleted account's history (no user). */
	placeholder: boolean;
	deactivated: boolean;
};

export type WorkspaceView = {
	workspace: WorkspaceSummary;
	/** The caller's member row, or null for an admin reading as `taskline:read` / `taskline:manage`. */
	me: TasklineMember | null;
	canCreateProject: boolean;
	/** The working days (0 Sunday … 6 Saturday), the week start and the time zone: what dates are read in. */
	calendar: { workingDays: number[]; weekStart: number; timeZone: string };
	today: string;
};

export type ProjectSummary = {
	id: string;
	key: string;
	name: string;
	color: TasklineColor;
	icon: string;
	visibility: ProjectVisibility;
	status: ProjectStatus;
	health: ProjectHealth | null;
	leadId: string | null;
	starred: boolean;
	openTasks: number;
	archived: boolean;
	updatedAt: string;
};

export type ProjectSettings = {
	sprints: boolean;
	time: boolean;
	estimation: "points" | "time";
	blockCompletionWhileBlocked: boolean;
	/** Days a completed task stays on the board; null: the workspace's window. */
	doneColumnDays: number | null;
};

export type ProjectDetail = ProjectSummary & {
	description: string;
	startOn: string | null;
	targetOn: string | null;
	settings: ProjectSettings;
	role: ProjectRole | null;
	can: ProjectCan;
	rev: number;
	version: number;
};

export type ProjectMemberView = { memberId: string; name: string; role: ProjectRole; placeholder: boolean };

export type TasklineStatus = {
	id: string;
	name: string;
	category: StatusCategory;
	color: TasklineColor;
	position: string;
	wipLimit: number | null;
};

export type TasklineLabel = { id: string; name: string; color: TasklineColor; projectId: string | null };

export type TaskSummary = {
	id: string;
	ref: string;
	number: number;
	type: TaskType;
	title: string;
	statusId: string;
	priority: TaskPriority;
	assigneeId: string | null;
	parentId: string | null;
	labelIds: string[];
	position: string;
	startOn: string | null;
	dueOn: string | null;
	completedAt: string | null;
	checklist: { done: number; total: number };
	updatedAt: string;
	/** Task 52: the sprint it's planned in (null: the backlog), its estimate, and its place in the backlog. */
	sprintId: string | null;
	points: number | null;
	rank: string;
	/** Task 53: the estimate in minutes. */
	estimateMinutes: number | null;
	/** Task 54: the milestone it leads to, and whether an open task (in any project) blocks it. */
	milestoneId: string | null;
	blocked: boolean;
	/** Task 55: its custom fields' values, by field id (an empty one isn't there). */
	fields: TaskFieldValues;
	/** Task 56: how it repeats (null: it doesn't). */
	recurrence: Recurrence | null;
};

type ActivityScalar = string | number | boolean | null;
/** A value in an activity entry's `data`: short JSON (ids, names, a field's before and after). */
export type ActivityValue = ActivityScalar | string[] | { [key: string]: ActivityScalar };
export type ActivityData = Record<string, ActivityValue>;

export type TaskActivity = {
	id: string;
	kind: ActivityKind;
	actorId: string | null;
	data: ActivityData;
	at: string;
};

/** An image on a task or a comment (the attachments service's asset, with what the page needs). */
export type TaskAttachment = {
	id: string;
	/** The original file (a PDF to download). */
	url: string;
	/** A 160 px square preview (a PDF's first page). */
	thumbUrl: string;
	/** The image at a readable size. */
	src: string;
	width: number;
	height: number;
	format: string;
};

export type TaskComment = {
	id: string;
	authorId: string | null;
	/** Task 56: the name of the automation that wrote it (its author is then null). */
	automation: string | null;
	html: string;
	mentions: string[];
	attachments: TaskAttachment[];
	createdAt: string;
	editedAt: string | null;
	/** The caller's own (they may edit it), or theirs to moderate as the project's lead. */
	canEdit: boolean;
	canDelete: boolean;
};

export type TaskDetail = TaskSummary & {
	description: string;
	checklistItems: ChecklistItem[];
	reporterId: string | null;
	subtasks: TaskSummary[];
	deletedAt: string | null;
	version: number;
	activity: TaskActivity[];
	can: ProjectCan;
	/** Task 50: the conversation, oldest first; the images; who watches. */
	comments: TaskComment[];
	attachments: TaskAttachment[];
	watching: boolean;
	watcherIds: string[];
	/** Task 53: the time logged on it. */
	time: TaskTime;
	/** Task 54: what blocks it and what it blocks. */
	dependencies: TaskDependencies;
};

/** A project's tasks with what draws them: the board, the list and the task sheet start from it. */
export type ProjectTasks = {
	project: ProjectDetail;
	statuses: TasklineStatus[];
	labels: TasklineLabel[];
	members: TasklineMember[];
	tasks: TaskSummary[];
	today: string;
	/** Days a closed task stays on the board: the project's setting, else the workspace's. */
	doneColumnDays: number;
	/** The types a task can be given (the workspace's setting); a task keeps one turned off later. */
	taskTypes: TaskType[];
	/** When the server read it: relative times ("5 minutes ago") start from here, so both renders agree. */
	readAt: string;
	/** Task 52: the active and planned sprints (the active first, then by start), and the recent velocity. */
	sprints: SprintSummary[];
	velocity: Velocity;
	/** How many sprints the project has had (completed ones too): the next one's suggested number. */
	sprintCount: number;
	/** Task 54: the milestones in order, and the dependencies between the tasks above (the timeline's arrows). */
	milestones: Milestone[];
	dependencies: Dependency[];
	/** Task 55: the custom fields its tasks can have (the workspace's, then the project's; archived ones too). */
	fields: TaskField[];
};

export type TrashedTask = { id: string; ref: string; title: string; deletedAt: string };

/** An entry of a project's feed (the overview): the task it's about, when it still exists. */
export type ProjectActivity = TaskActivity & { task: { ref: string; title: string } | null };

/** What open pages poll (decision 0209): the project's `rev`, which every change moves. */
export type ProjectRev = { rev: number };

/** Where a project lives, for links that only know its id (the Kanban redirects, 0210). */
export type ProjectLocation = { ws: string; key: string };

/** A bulk change's outcome: how many tasks it changed. */
export type BulkResult = { count: number };

/** A project in the shell's sidebar and the palette, with the workspace it's in. */
export type NavProject = {
	id: string;
	key: string;
	name: string;
	color: TasklineColor;
	/** The workspace's `$ws` segment. */
	ws: string;
	workspaceKind: WorkspaceKind;
};

/** A workspace in the shell, with whether the caller may create projects in it. */
export type NavWorkspace = WorkspaceSummary & { canCreateProject: boolean };

/**
 * What the shell draws on every page: the caller's workspaces, every active project
 * they may see (the palette's), the starred ones and the ones they last worked on.
 */
export type TasklineNav = {
	workspaces: NavWorkspace[];
	projects: NavProject[];
	starred: NavProject[];
	recent: NavProject[];
	/** Task 53: the caller's running timer (the topbar's pill), wherever it runs, and when the server read it. */
	timer: RunningTimer | null;
	readAt: string;
};

/** An open task assigned to the caller or watched by them, for Home ("My work", every workspace at once). */
export type MyTask = {
	id: string;
	ref: string;
	title: string;
	type: TaskType;
	priority: TaskPriority;
	dueOn: string | null;
	status: { name: string; category: StatusCategory; color: TasklineColor };
	project: NavProject;
	/** Task 51: assigned to the caller, and whether they watch it. */
	assigned: boolean;
	watching: boolean;
};

/**
 * My work: the tasks, and the days they're grouped by (today and the last day of this
 * week, in the first workspace's calendar); Task 52: the active sprints of the projects
 * the caller may see.
 */
export type MyTasks = { tasks: MyTask[]; today: string; weekEnd: string; sprints: ActiveSprint[] };

// ---- Sprints and backlog (Task 52) ------------------------------------------------------------

/** `planned` → `active` (one per project at a time) → `completed`. */
export const SPRINT_STATES = ["planned", "active", "completed"] as const;
export type SprintState = (typeof SPRINT_STATES)[number];

/** Where a completed sprint's unfinished tasks go: the backlog, a planned sprint, or a new one. */
export const SPRINT_CARRY = ["backlog", "next", "new"] as const;
export type SprintCarry = (typeof SPRINT_CARRY)[number];

/** A task's points: what an estimate can be. */
export const POINTS_MAX = 100;

/** A sprint's work: everything in it but canceled tasks (scope), and the completed part (done), as points and as tasks. */
export type SprintTotals = {
	scopePoints: number;
	donePoints: number;
	scopeTasks: number;
	doneTasks: number;
	/** Task 53: estimated minutes (unestimated counts 0), what a project that estimates in time counts. */
	scopeMinutes: number;
	doneMinutes: number;
};

export type SprintSummary = {
	id: string;
	name: string;
	goal: string;
	state: SprintState;
	startOn: string;
	endOn: string;
	startedAt: string | null;
	completedAt: string | null;
	/** Stored at the start (scope then) and at the completion (done then); null before. */
	committed: { points: number; tasks: number; minutes: number } | null;
	completed: { points: number; tasks: number; minutes: number } | null;
};

/** The average of the last three completed sprints' completed work (null before the first). */
export type Velocity = { points: number | null; tasks: number | null; minutes: number | null; sprints: number };

/** One completed sprint on the velocity chart. */
export type VelocityRow = {
	id: string;
	name: string;
	committedPoints: number;
	completedPoints: number;
	committedTasks: number;
	completedTasks: number;
	committedMinutes: number;
	completedMinutes: number;
};

/** A day's close of an active sprint (the daily job's snapshot, decision 0216). */
export type SprintDay = SprintTotals & { day: string };

/** /$ws/p/$key/sprints/$sprintId: the sprint, its days, today's live totals, and the project's velocity. */
export type SprintReport = {
	sprint: SprintSummary;
	estimation: "points" | "time";
	days: SprintDay[];
	/** Now, for an active sprint (what today's point shows), or null. */
	live: SprintTotals | null;
	today: string;
	workingDays: number[];
	/** The last six completed sprints, oldest first. */
	velocity: VelocityRow[];
	/** Every sprint of the project, for the switcher (newest first). */
	sprints: Array<Pick<SprintSummary, "id" | "name" | "state">>;
};

/** An active sprint on Home and the admin's overview: where it is and how far along. */
export type ActiveSprint = {
	id: string;
	name: string;
	project: NavProject;
	startOn: string;
	endOn: string;
	totals: SprintTotals;
	estimation: "points" | "time";
};

// ---- Time tracking (Task 53) ------------------------------------------------------------------

/** A timer counts this long at most: the daily job stops one that ran longer, and tells its owner. */
export const TIMER_MAX_MINUTES = 720;
/** One entry (and one timesheet cell) is a day at most. */
export const DAY_MINUTES = 1440;
/** An estimate is a thousand hours at most. */
export const ESTIMATE_MAX_MINUTES = 60_000;

/** The caller's running timer: the task it runs on, and when the server started it. */
export type RunningTimer = {
	id: string;
	/** The workspace's `$ws` segment. */
	ws: string;
	workspaceKind: WorkspaceKind;
	projectKey: string;
	/** Null when its task was deleted for good while it ran. */
	ref: string | null;
	title: string;
	startedAt: string;
};

/** A time entry, as the task, the project's time and the admin show it. */
export type TimeEntry = {
	id: string;
	taskId: string | null;
	ref: string | null;
	title: string | null;
	project: { id: string; key: string; name: string };
	memberId: string;
	memberName: string;
	onDay: string;
	minutes: number;
	note: string;
	billable: boolean;
	running: boolean;
	startedAt: string | null;
	/** The caller's own (or theirs to change with `taskline:time`), on a day after the lock. */
	canEdit: boolean;
	/** On or before the workspace's lock date: nobody changes it. */
	locked: boolean;
};

/** The time on a task: what was logged (everyone's), the latest entries, and whether the caller may log. */
export type TaskTime = {
	loggedMinutes: number;
	billableMinutes: number;
	entries: TimeEntry[];
	/** A member who may edit the project (time needs a member row). */
	canLog: boolean;
	lockOn: string | null;
	today: string;
	/** Whether the project tracks time (its setting): when off, the task shows no time section. */
	enabled: boolean;
};

/** A row of the timesheet: a task (or a project's time whose task is gone) and its minutes per day of the week. */
export type TimesheetRow = {
	key: string;
	task: { id: string; ref: string; title: string; closed: boolean } | null;
	project: { id: string; key: string; name: string; color: TasklineColor };
	/** Whether the caller may change its cells (a task they may still log time on). */
	editable: boolean;
	/** Seven numbers, one per day of the week (`Timesheet.days`). */
	minutes: number[];
};

/** /$ws/timesheet: the caller's week in one workspace. */
export type Timesheet = {
	weekStart: string;
	days: string[];
	today: string;
	lockOn: string | null;
	workingDays: number[];
	rows: TimesheetRow[];
	/** Open tasks to add a row for: assigned to the caller, then the ones they last logged on. */
	suggestions: Array<Pick<TimesheetRow, "key" | "task" | "project">>;
	/** The caller's weekly capacity (the admin's), or null. */
	capacityMinutes: number | null;
	/** Whether the caller has a member row here (an admin reading the team has no timesheet). */
	canLog: boolean;
	/** Whether the week before has time to copy. */
	lastWeekMinutes: number;
};

/** What copying last week did: cells filled, and those skipped (already had time, locked, or the task is closed to the caller). */
export type CopyWeekResult = { copied: number; skipped: number };

export type ProjectTimeTask = {
	taskId: string;
	ref: string;
	title: string;
	assigneeId: string | null;
	estimateMinutes: number | null;
	loggedMinutes: number;
	billableMinutes: number;
	closed: boolean;
};

export type ProjectTimeMember = {
	memberId: string;
	name: string;
	/** The estimates of the tasks assigned to them. */
	estimateMinutes: number;
	loggedMinutes: number;
	billableMinutes: number;
};

/** A project's time page: estimate against actual by task and by member, and the latest entries. */
export type ProjectTime = {
	tasks: ProjectTimeTask[];
	members: ProjectTimeMember[];
	totals: { estimateMinutes: number; loggedMinutes: number; billableMinutes: number };
	/** Time left on the project by tasks deleted for good. */
	orphanMinutes: number;
	entries: TimeEntry[];
	today: string;
};

// ---- Finding things (Task 51) -----------------------------------------------------------------

/** The views a saved view can belong to. */
export const SAVED_VIEW_KINDS = ["list", "board", "calendar"] as const;
export type SavedViewKind = (typeof SAVED_VIEW_KINDS)[number];

/** A saved view of a project: a search string for one of its views. */
export type SavedViewDto = {
	id: string;
	name: string;
	view: SavedViewKind;
	search: string;
	shared: boolean;
	/** Whose it is, for a shared one's "by Asha". */
	author: string;
	mine: boolean;
	/** The author, or the project's lead for a shared one. */
	canDelete: boolean;
};

/** A project's saved views of one kind, and whether the caller may save (a member row) and share (an editor). */
export type SavedViews = { views: SavedViewDto[]; canSave: boolean; canShare: boolean };

/** A task found by search, with where it lives. */
export type FoundTask = {
	id: string;
	ref: string;
	title: string;
	type: TaskType;
	priority: TaskPriority;
	status: { name: string; category: StatusCategory; color: TasklineColor };
	project: NavProject;
	/** The start of its description's text, for the results' second line. */
	excerpt: string;
	closed: boolean;
};

/** A page of search results; `jump` is the task an exact reference ("WEB-12") names, when the caller may see it. */
export type TaskSearchPage = {
	items: FoundTask[];
	total: number;
	page: number;
	pageSize: number;
	jump: string | null;
};

/** What an import did: tasks made, and the names in the file that matched nothing (left blank). */
export type TaskImportResult = {
	inserted: number;
	unmatched: { statuses: string[]; assignees: string[]; labels: string[] };
};

// ---- Notifications (Task 50) ------------------------------------------------------------------

/** One row of the inbox, with where it points (the workspace's current segment). */
export type InboxItem = {
	id: string;
	kind: NotificationKind;
	data: NotificationData;
	ws: string;
	workspaceKind: WorkspaceKind;
	projectKey: string;
	ref: string | null;
	createdAt: string;
	read: boolean;
};

export type InboxPage = { items: InboxItem[]; unread: number; hasMore: boolean; readAt: string };

export type UnreadCount = { unread: number };

/** The caller's notification settings: the modes they chose over the team's defaults, and their email language. */
export type NotifySettingsView = {
	defaults: Record<NotifyKind, NotifyMode>;
	modes: Partial<Record<NotifyKind, NotifyMode>>;
	locale: "en" | "ne" | null;
	/** Whether they have a member row anywhere (an account with none has nothing to tune). */
	member: boolean;
	/** Whether email can reach them (guests' addresses can't). */
	email: boolean;
};

// ---- Timeline, milestones and dependencies (Task 54) ------------------------------------------

/** Milestones a project keeps. */
export const MILESTONES_MAX = 50;
/** Dependencies one task has on each side (what blocks it, what it blocks). */
export const DEPENDENCIES_MAX = 50;

export type Milestone = {
	id: string;
	name: string;
	description: string;
	dueOn: string | null;
	completedAt: string | null;
	/** Its place in the project's order (a fractional key). */
	position: string;
};

/** `blockerId` blocks `blockedId`. */
export type Dependency = { blockerId: string; blockedId: string };

/** The relation as one task sees it: the other task blocks it, or it blocks the other. */
export const DEPENDENCY_RELATIONS = ["blocked_by", "blocks"] as const;
export type DependencyRelation = (typeof DEPENDENCY_RELATIONS)[number];

/** The task at the other end of a dependency, where it lives, and whether it's still open. */
export type LinkedTask = {
	id: string;
	ref: string;
	title: string;
	projectKey: string;
	projectName: string;
	/** Another project of the workspace (its link leaves this one). */
	elsewhere: boolean;
	closed: boolean;
	startOn: string | null;
	dueOn: string | null;
};

/**
 * A task's dependencies, the ones in projects the caller may see; `hidden` counts the
 * rest (a blocker in a private project still blocks, decision 0219).
 */
export type TaskDependencies = {
	blockedBy: LinkedTask[];
	blocks: LinkedTask[];
	hidden: number;
	/** Whether the project refuses completing it while an open task blocks it. */
	blockCompletion: boolean;
};

// ---- Custom fields (Task 55) ------------------------------------------------------------------

export const FIELD_TYPES = ["text", "number", "select", "multi_select", "date", "member", "checkbox", "url"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export const isChoiceType = (type: FieldType) => type === "select" || type === "multi_select";

/** Fields one scope keeps (the workspace's, or one project's), archived ones too. */
export const FIELDS_MAX = 30;
/** Options one select field offers. */
export const FIELD_OPTIONS_MAX = 50;

/** A choice of a select field: its id is what values hold, so renaming it keeps them. */
export type FieldOption = { id: string; name: string; color: TasklineColor };

/**
 * A custom field (decision 0220): the workspace's (`projectId` null, the admin's) or a
 * project's (its lead's). Archived, it keeps its values but is offered nowhere.
 */
export type TaskField = {
	id: string;
	projectId: string | null;
	name: string;
	type: FieldType;
	options: FieldOption[];
	/** A task can't be completed while it's empty. */
	required: boolean;
	position: string;
	archived: boolean;
};

/**
 * One value, by type: text and URLs as text, a number, a select's option id, a
 * multi-select's option ids, a day (`YYYY-MM-DD`), a member's id, a ticked box (`true`).
 */
export type FieldValue = string | number | boolean | string[];
export type TaskFieldValues = Record<string, FieldValue>;

// ---- Automations and recurring tasks (Task 56) -----------------------------------------------

/** What starts an automation: a change to a task (in its write's transaction), or the daily job (the last two). */
export const AUTOMATION_TRIGGERS = [
	"task_created",
	"status_changed",
	"assignee_changed",
	"priority_changed",
	"label_added",
	"comment_added",
	"subtasks_done",
	"sprint_started",
	"due_soon",
	"overdue",
] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGERS)[number];
/** The triggers the daily job fires (once per task and due date). */
export const TIME_TRIGGERS: ReadonlyArray<AutomationTriggerType> = ["due_soon", "overdue"];

/**
 * A trigger and what narrows it: a status change into one status (a project's rule) or
 * one category (either scope), a priority or a label it changed to, a number of days
 * before the due date.
 */
export type AutomationTrigger =
	| { type: "task_created" }
	| { type: "status_changed"; statusId?: string; category?: StatusCategory }
	| { type: "assignee_changed" }
	| { type: "priority_changed"; priority?: TaskPriority }
	| { type: "label_added"; labelId?: string }
	| { type: "comment_added" }
	| { type: "subtasks_done" }
	| { type: "sprint_started" }
	| { type: "due_soon"; days: number }
	| { type: "overdue" };

export const AUTOMATION_CONDITIONS = ["task_type", "priority", "category", "label", "assignee", "field"] as const;
export type AutomationConditionType = (typeof AUTOMATION_CONDITIONS)[number];
/** What the task must be for the actions to run (every condition, as the task is after the change). */
export type AutomationCondition =
	| { type: "task_type"; in: TaskType[] }
	| { type: "priority"; in: TaskPriority[] }
	| { type: "category"; in: StatusCategory[] }
	| { type: "label"; labelId: string; has: boolean }
	/** A member's id, `none` (unassigned) or `any` (assigned to someone). */
	| { type: "assignee"; is: string }
	/** A custom field's filter value, as the `cf` filters write it (`any`, `none`, an option id, `yes`…). */
	| { type: "field"; fieldId: string; value: string };

export const AUTOMATION_ACTIONS = [
	"set_status",
	"assign",
	"set_priority",
	"add_label",
	"remove_label",
	"set_sprint",
	"set_due",
	"comment",
	"notify",
	"subtasks",
] as const;
export type AutomationActionType = (typeof AUTOMATION_ACTIONS)[number];
/** What an automation does to the task, in order. */
export type AutomationAction =
	| { type: "set_status"; statusId?: string; category?: StatusCategory }
	/** A member's id, `none`, the project's `lead` or the task's `reporter`. */
	| { type: "assign"; to: string }
	| { type: "set_priority"; priority: TaskPriority }
	| { type: "add_label"; labelId: string }
	| { type: "remove_label"; labelId: string }
	/** A sprint's id, the project's `active` sprint, or `none` (the backlog). */
	| { type: "set_sprint"; to: string }
	/** Due this many days after the day it runs. */
	| { type: "set_due"; days: number }
	| { type: "comment"; text: string }
	/** A member's id, or the task's `assignee`, `reporter`, `watchers`, or the project's `lead`. */
	| { type: "notify"; to: string; message: string }
	| { type: "subtasks"; titles: string[] };

/** At most this many actions and conditions per automation (11.5), and automations per scope. */
export const AUTOMATION_ACTIONS_MAX = 10;
export const AUTOMATION_CONDITIONS_MAX = 10;
export const AUTOMATIONS_MAX = 50;

export const AUTOMATION_OUTCOMES = ["ok", "skipped", "failed"] as const;
export type AutomationOutcome = (typeof AUTOMATION_OUTCOMES)[number];
/**
 * Why a run went as it did: skipped because the task didn't match (`conditions`), had
 * nothing to change (`unchanged`) or was past the per-change limit (`limit`); failed
 * with the refusal's message; ok with how many actions changed something.
 */
export type AutomationRunDetail = {
	reason?: "conditions" | "unchanged" | "limit";
	message?: string;
	applied?: number;
};

export type Automation = {
	id: string;
	/** Null: the workspace's (the admin's), on every team project's tasks. */
	projectId: string | null;
	name: string;
	enabled: boolean;
	trigger: AutomationTrigger;
	conditions: AutomationCondition[];
	actions: AutomationAction[];
	version: number;
	lastRun: { outcome: AutomationOutcome; at: string } | null;
	createdAt: string;
};

export type AutomationRun = {
	id: string;
	automationId: string;
	automation: string;
	/** The task's project and reference (null once the task is deleted for good). */
	projectKey: string | null;
	ref: string | null;
	title: string | null;
	outcome: AutomationOutcome;
	detail: AutomationRunDetail;
	at: string;
};

/** A project's automations page: its own rules, the workspace's that apply too, and the latest runs of its own. */
export type ProjectAutomations = {
	automations: Automation[];
	workspace: Automation[];
	runs: AutomationRun[];
};

/** How many open tasks an automation's conditions match now (the builder's preview). */
export type AutomationPreview = { count: number; capped: boolean };

export const RECURRENCE_FREQS = ["daily", "weekly", "monthly", "yearly"] as const;
export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number];
export const RECURRENCE_INTERVAL_MAX = 99;
export const RECURRENCE_COUNT_MAX = 999;

/**
 * A task's repeat (`tl_task.recurrence`): every `interval` days, weeks (on `weekdays`,
 * 0 Sunday … 6 Saturday), months or years from `anchor` (the due day it was set from:
 * a month's day, a year's month and day), ending on `until` or after `count` tasks.
 * `n` is this task's place in the series (1 first). Closing it creates the next one,
 * which takes the rule over.
 */
export type Recurrence = {
	freq: RecurrenceFreq;
	interval: number;
	weekdays?: number[];
	until?: string | null;
	count?: number | null;
	anchor: string;
	n: number;
};

// ---- Templates, reports and project updates (Task 57) -------------------------------------------

/** The templates in code, by id (their words are messages, in the caller's language). */
export const BUILTIN_TEMPLATES = ["scrum", "kanban", "marketing", "client", "event"] as const;
export type BuiltinTemplate = (typeof BUILTIN_TEMPLATES)[number];

export type TemplateCounts = {
	statuses: number;
	labels: number;
	fields: number;
	automations: number;
	milestones: number;
	tasks: number;
};

/** A template as "New project" offers it. */
export type TemplateChoice = {
	id: string;
	name: string;
	description: string;
	builtin: boolean;
	counts: TemplateCounts;
};

/** How a project is doing, posted by its lead. `author` null: an admin without a member row, or someone since removed. */
export type ProjectUpdate = {
	id: string;
	health: ProjectHealth;
	/** Sanitized when saved. */
	body: string;
	author: string | null;
	at: string;
};

/** How many weeks a report covers. */
export const REPORT_RANGES = ["4w", "12w", "26w"] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

export type ReportStatusCount = {
	statusId: string;
	name: string;
	color: TasklineColor;
	category: StatusCategory;
	count: number;
};
export type ReportPriorityCount = { priority: TaskPriority; count: number };

/** One week of a project: tasks created and completed in it, and those overdue at its close. */
export type ReportWeek = { week: string; created: number; completed: number; overdue: number };

/** A completed task's lead time (created to completed) and cycle time (first started to completed), in days. */
export type ReportCycleTask = {
	ref: string;
	title: string;
	completedOn: string;
	leadDays: number;
	cycleDays: number | null;
};

export type ReportWorkloadRow = {
	/** Null: nobody's yet. */
	memberId: string | null;
	name: string | null;
	open: number;
	overdue: number;
	estimateMinutes: number;
	points: number;
};

/** A project's reports (`/$ws/p/$key/reports`): everything over the weeks asked for, time when it's tracked. */
export type ProjectReports = {
	today: string;
	statuses: ReportStatusCount[];
	priorities: ReportPriorityCount[];
	weeks: ReportWeek[];
	cycle: {
		medianLeadDays: number | null;
		medianCycleDays: number | null;
		p85CycleDays: number | null;
		tasks: ReportCycleTask[];
	};
	workload: ReportWorkloadRow[];
	time: Pick<ProjectTime, "totals" | "members" | "tasks"> | null;
};
