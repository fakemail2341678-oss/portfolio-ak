import type {
	Automation,
	AutomationRun,
	InboxPage,
	NavProject,
	NavWorkspace,
	NotifySettingsView,
	ProjectAutomations,
	ProjectReports,
	ProjectTasks,
	ProjectTime,
	ProjectUpdate,
	SprintReport,
	SprintSummary,
	TaskDetail,
	TaskField,
	TasklineLabel,
	TasklineMember,
	TasklineNav,
	TasklineStatus,
	TaskSummary,
	TemplateChoice,
	Timesheet,
} from "../../src/features/taskline/types";
import type { Session } from "../../src/lib/session";

/** Fixed Taskline data for the shell's stories and jsdom tests (no server functions). */

const team: NavWorkspace = {
	id: "ws-team",
	kind: "team",
	slug: "team",
	name: "Himal Studio",
	segment: "team",
	canCreateProject: true,
};
const sandbox: NavWorkspace = {
	id: "ws-sandbox",
	kind: "sandbox",
	slug: "sandbox",
	name: "Sandbox",
	segment: "sandbox",
	canCreateProject: true,
};

const project = (id: string, key: string, name: string, color: NavProject["color"], inSandbox = false): NavProject => ({
	id,
	key,
	name,
	color,
	ws: inSandbox ? "sandbox" : "team",
	workspaceKind: inSandbox ? "sandbox" : "team",
});

const web = project("p-web", "WEB", "Website relaunch", "teal");
const app = project("p-app", "APP", "Mobile app", "indigo");
const ops = project("p-ops", "OPS", "Operations", "amber");
const trial = project("p-try", "WEB", "Website relaunch", "teal", true);

/** A team member who also has a sandbox: the switcher shows. */
export const sampleTasklineNav: TasklineNav = {
	workspaces: [team, sandbox],
	projects: [app, ops, web, trial],
	starred: [web],
	recent: [app, web, trial],
	timer: null,
	readAt: "2026-10-31T06:00:00.000Z",
};

/** Task 53: the same member with a timer running on WEB-4 for 42 minutes. */
export const sampleTimerNav: TasklineNav = {
	...sampleTasklineNav,
	timer: {
		id: "te-run",
		ws: "team",
		workspaceKind: "team",
		projectKey: "WEB",
		ref: "WEB-4",
		title: "Fix the broken contact form",
		startedAt: "2026-10-31T05:18:00.000Z",
	},
};

/** A guest: their sandbox only. */
export const sampleGuestNav: TasklineNav = {
	workspaces: [sandbox],
	projects: [trial],
	starred: [],
	recent: [trial],
	timer: null,
	readAt: "2026-10-31T06:00:00.000Z",
};

export const sampleTasklineMember: Session = {
	user: { id: "asha-1", email: "asha@example.com", name: "Asha Gurung", role: "user", twoFactorEnabled: false },
	permissions: [],
};

export const sampleTasklineGuest: Session = {
	user: {
		id: "guest-1",
		email: "guest-1@anonymous.invalid",
		name: "Guest",
		role: "user",
		twoFactorEnabled: false,
	},
	permissions: [],
	isAnonymous: true,
};

// ---- A project, its tasks and one task (the board's, the list's and the task panel's stories) ----

const status = (
	id: string,
	name: string,
	category: TasklineStatus["category"],
	color: TasklineStatus["color"],
	position: string,
	wipLimit: number | null = null,
): TasklineStatus => ({
	id,
	name,
	category,
	color,
	position,
	wipLimit,
});

const statuses: TasklineStatus[] = [
	status("st-todo", "To do", "unstarted", "blue", "a0"),
	status("st-doing", "In progress", "started", "amber", "a1", 2),
	status("st-done", "Done", "completed", "green", "a2"),
];

const member = (id: string, name: string, title: string, userId: string | null = null): TasklineMember => ({
	id,
	userId,
	name,
	role: "member",
	title,
	placeholder: userId === null,
	deactivated: false,
});

const members: TasklineMember[] = [
	member("m-asha", "Asha Gurung", "Designer", "asha-1"),
	member("m-bikash", "Bikash Thapa", "Engineer"),
	member("m-sita", "Sita Rai", "Product manager"),
];

const labels: TasklineLabel[] = [
	{ id: "l-design", name: "Design", color: "violet", projectId: "p-web" },
	{ id: "l-bug", name: "Bug", color: "red", projectId: "p-web" },
];

const summary = (
	number: number,
	title: string,
	statusId: string,
	position: string,
	extra: Partial<TaskSummary> = {},
): TaskSummary => ({
	id: `t-${number}`,
	ref: `WEB-${number}`,
	number,
	type: "task",
	title,
	statusId,
	priority: 2,
	assigneeId: null,
	parentId: null,
	labelIds: [],
	position,
	startOn: null,
	dueOn: null,
	completedAt: null,
	checklist: { done: 0, total: 0 },
	updatedAt: "2026-10-30T09:00:00.000Z",
	sprintId: null,
	points: null,
	rank: `c${String(number).padStart(3, "0")}`,
	estimateMinutes: null,
	milestoneId: null,
	blocked: false,
	fields: {},
	recurrence: null,
	...extra,
});

/** Task 55: a workspace field and two of the project's (field ids are uuids: `?cf=` filters by them). */
export const FIELD_SEVERITY = "0f1e5e00-0000-4000-8000-000000000001";
export const FIELD_REVIEWER = "0f1e5e00-0000-4000-8000-000000000002";
export const FIELD_SIGNED_OFF = "0f1e5e00-0000-4000-8000-000000000003";
export const sampleFields: TaskField[] = [
	{
		id: FIELD_SEVERITY,
		projectId: null,
		name: "Severity",
		type: "select",
		options: [
			{ id: "olow001", name: "Low", color: "gray" },
			{ id: "omed001", name: "Medium", color: "amber" },
			{ id: "ohigh01", name: "High", color: "red" },
		],
		required: false,
		position: "a0",
		archived: false,
	},
	{
		id: FIELD_REVIEWER,
		projectId: "p-web",
		name: "Reviewer",
		type: "member",
		options: [],
		required: false,
		position: "a0",
		archived: false,
	},
	{
		id: FIELD_SIGNED_OFF,
		projectId: "p-web",
		name: "Signed off",
		type: "checkbox",
		options: [],
		required: true,
		position: "a1",
		archived: false,
	},
];

export const sampleTasks: TaskSummary[] = [
	summary(1, "Design the new navigation", "st-todo", "a0", {
		type: "story",
		assigneeId: "m-asha",
		labelIds: ["l-design"],
		priority: 3,
		startOn: "2026-10-27",
		dueOn: "2026-11-04",
		milestoneId: "ms-launch",
		fields: { [FIELD_SEVERITY]: "ohigh01", [FIELD_REVIEWER]: "m-sita" },
	}),
	summary(2, "Write the homepage copy", "st-todo", "a1", {
		assigneeId: "m-sita",
		startOn: "2026-09-28",
		dueOn: "2026-10-01",
		milestoneId: "ms-launch",
	}),
	summary(3, "Sketch the mobile menu", "st-doing", "a0", {
		parentId: "t-1",
		assigneeId: "m-asha",
		startOn: "2026-10-29",
		dueOn: "2026-11-02",
		blocked: true,
		milestoneId: "ms-launch",
	}),
	summary(4, "Fix the broken contact form", "st-doing", "a1", {
		type: "bug",
		priority: 4,
		labelIds: ["l-bug"],
		assigneeId: "m-bikash",
		checklist: { done: 1, total: 3 },
		startOn: "2026-10-30",
		dueOn: "2026-11-03",
		blocked: true,
	}),
	summary(5, "Check the contrast in dark mode", "st-doing", "a2", { parentId: "t-1" }),
	summary(6, "Replace the logo files", "st-done", "a0", {
		completedAt: "2026-10-29T10:00:00.000Z",
		priority: 1,
		startOn: "2026-10-20",
		dueOn: "2026-10-24",
		milestoneId: "ms-design",
	}),
];

export const sampleProjectTasks: ProjectTasks = {
	project: {
		id: "p-web",
		key: "WEB",
		name: "Website relaunch",
		color: "teal",
		icon: "",
		visibility: "team",
		status: "active",
		health: null,
		leadId: "m-asha",
		starred: true,
		openTasks: 5,
		archived: false,
		updatedAt: "2026-10-30T09:00:00.000Z",
		description: "<p>A sample project to try Taskline with.</p>",
		startOn: null,
		targetOn: null,
		settings: {
			sprints: false,
			time: true,
			estimation: "points",
			blockCompletionWhileBlocked: false,
			doneColumnDays: null,
		},
		role: "lead",
		can: { view: true, comment: true, edit: true, manage: true, logTime: true },
		rev: 12,
		version: 1,
	},
	statuses,
	labels,
	members,
	tasks: sampleTasks,
	today: "2026-10-31",
	doneColumnDays: 14,
	taskTypes: ["task", "bug", "story", "epic"],
	readAt: "2026-10-31T06:00:00.000Z",
	sprints: [],
	velocity: { points: null, tasks: null, minutes: null, sprints: 0 },
	milestones: [
		{
			id: "ms-design",
			name: "Design signed off",
			description: "",
			dueOn: "2026-10-24",
			completedAt: "2026-10-24T10:00:00.000Z",
			position: "a0",
		},
		{
			id: "ms-launch",
			name: "Launch",
			description: "The new site goes live.",
			dueOn: "2026-11-12",
			completedAt: null,
			position: "a1",
		},
	],
	dependencies: [
		{ blockerId: "t-6", blockedId: "t-1" },
		{ blockerId: "t-1", blockedId: "t-3" },
		{ blockerId: "t-2", blockedId: "t-4" },
	],
	sprintCount: 0,
	fields: sampleFields,
};

/** Task 52: the same project with sprints on: an active sprint, the next one planned, and a backlog. */
const activeSprint: SprintSummary = {
	id: "s-2",
	name: "Sprint 2",
	goal: "Ship the new navigation",
	state: "active",
	startOn: "2026-10-24",
	endOn: "2026-11-06",
	startedAt: "2026-10-24T03:00:00.000Z",
	completedAt: null,
	committed: { points: 13, tasks: 4, minutes: 0 },
	completed: null,
};
const plannedSprint: SprintSummary = {
	id: "s-3",
	name: "Sprint 3",
	goal: "",
	state: "planned",
	startOn: "2026-11-07",
	endOn: "2026-11-20",
	startedAt: null,
	completedAt: null,
	committed: null,
	completed: null,
};
const IN_SPRINT: Record<string, { sprintId: string | null; points: number | null }> = {
	"t-1": { sprintId: "s-2", points: 5 },
	"t-2": { sprintId: "s-2", points: 3 },
	"t-3": { sprintId: "s-3", points: 2 },
	"t-4": { sprintId: "s-2", points: 3 },
	"t-5": { sprintId: "s-2", points: 2 },
	"t-6": { sprintId: null, points: 8 },
};
export const sampleSprintProject: ProjectTasks = {
	...sampleProjectTasks,
	project: { ...sampleProjectTasks.project, settings: { ...sampleProjectTasks.project.settings, sprints: true } },
	tasks: sampleTasks.map((task) => ({ ...task, ...(IN_SPRINT[task.id] ?? { sprintId: null, points: null }) })),
	sprints: [activeSprint, plannedSprint],
	velocity: { points: 9.5, tasks: 3, minutes: null, sprints: 2 },
	sprintCount: 4,
};

/** The active sprint's report: a week of days so far, and two completed sprints before it. */
export const sampleSprintReport: SprintReport = {
	sprint: activeSprint,
	estimation: "points",
	days: [
		{ day: "2026-10-23", scopePoints: 13, donePoints: 0, scopeTasks: 4, doneTasks: 0, scopeMinutes: 0, doneMinutes: 0 },
		{ day: "2026-10-26", scopePoints: 13, donePoints: 0, scopeTasks: 4, doneTasks: 0, scopeMinutes: 0, doneMinutes: 0 },
		{ day: "2026-10-27", scopePoints: 15, donePoints: 2, scopeTasks: 5, doneTasks: 1, scopeMinutes: 0, doneMinutes: 0 },
		{ day: "2026-10-29", scopePoints: 15, donePoints: 5, scopeTasks: 5, doneTasks: 2, scopeMinutes: 0, doneMinutes: 0 },
	],
	live: { scopePoints: 15, donePoints: 5, scopeTasks: 5, doneTasks: 2, scopeMinutes: 0, doneMinutes: 0 },
	today: "2026-10-31",
	workingDays: [0, 1, 2, 3, 4, 5],
	velocity: [
		{
			id: "s-0",
			name: "Sprint 0",
			committedPoints: 10,
			completedPoints: 11,
			committedTasks: 3,
			completedTasks: 3,
			committedMinutes: 0,
			completedMinutes: 0,
		},
		{
			id: "s-1",
			name: "Sprint 1",
			committedPoints: 11,
			completedPoints: 8,
			committedTasks: 3,
			completedTasks: 2,
			committedMinutes: 0,
			completedMinutes: 0,
		},
	],
	sprints: [
		{ id: "s-3", name: "Sprint 3", state: "planned" },
		{ id: "s-2", name: "Sprint 2", state: "active" },
		{ id: "s-1", name: "Sprint 1", state: "completed" },
		{ id: "s-0", name: "Sprint 0", state: "completed" },
	],
};

export const sampleTaskDetail: TaskDetail = {
	...(sampleTasks[3] as TaskSummary),
	description: "<p>The form's submit button does nothing on a phone.</p>",
	checklistItems: [
		{ id: "c1", text: "Reproduce it on a phone", done: true },
		{ id: "c2", text: "Read the server logs", done: false },
		{ id: "c3", text: "Add a test", done: false },
	],
	reporterId: "m-asha",
	subtasks: [],
	deletedAt: null,
	version: 1,
	activity: [
		{
			id: "a1",
			kind: "task.created",
			actorId: "m-asha",
			data: { title: "Fix the broken contact form" },
			at: "2026-10-30T08:00:00.000Z",
		},
		{
			id: "a2",
			kind: "task.moved",
			actorId: "m-bikash",
			data: { from: "st-todo", to: "st-doing" },
			at: "2026-10-30T09:00:00.000Z",
		},
	],
	can: { view: true, comment: true, edit: true, manage: true, logTime: true },
	comments: [
		{
			id: "cm1",
			authorId: "m-bikash",
			automation: null,
			html: '<p><span data-type="mention" class="mention" data-id="m-asha" data-label="Asha Gurung">@Asha Gurung</span> it only fails on Safari. I attached the console output.</p>',
			mentions: ["m-asha"],
			attachments: [],
			createdAt: "2026-10-30T10:00:00.000Z",
			editedAt: null,
			canEdit: false,
			canDelete: true,
		},
		{
			id: "cm2",
			authorId: "m-asha",
			automation: null,
			html: "<p>Thanks, I'll take it from here.</p>",
			mentions: [],
			attachments: [],
			createdAt: "2026-10-30T11:30:00.000Z",
			editedAt: "2026-10-30T11:35:00.000Z",
			canEdit: true,
			canDelete: true,
		},
	],
	attachments: [],
	watching: true,
	watcherIds: ["m-asha", "m-bikash"],
	estimateMinutes: 360,
	dependencies: {
		blockedBy: [
			{
				id: "t-2",
				ref: "WEB-2",
				title: "Write the homepage copy",
				projectKey: "WEB",
				projectName: "Website relaunch",
				elsewhere: false,
				closed: false,
				startOn: "2026-09-28",
				dueOn: "2026-10-01",
			},
		],
		blocks: [
			{
				id: "t-ops-3",
				ref: "OPS-3",
				title: "Switch the DNS",
				projectKey: "OPS",
				projectName: "Operations",
				elsewhere: true,
				closed: false,
				startOn: null,
				dueOn: "2026-11-06",
			},
		],
		hidden: 0,
		blockCompletion: true,
	},
	time: {
		loggedMinutes: 270,
		billableMinutes: 90,
		entries: [
			{
				id: "te-1",
				taskId: "t-4",
				ref: "WEB-4",
				title: "Fix the broken contact form",
				project: { id: "p-web", key: "WEB", name: "Website relaunch" },
				memberId: "m-bikash",
				memberName: "Bikash Thapa",
				onDay: "2026-10-30",
				minutes: 180,
				note: "Found the cause, writing the fix",
				billable: false,
				running: false,
				startedAt: null,
				canEdit: false,
				locked: false,
			},
			{
				id: "te-2",
				taskId: "t-4",
				ref: "WEB-4",
				title: "Fix the broken contact form",
				project: { id: "p-web", key: "WEB", name: "Website relaunch" },
				memberId: "m-asha",
				memberName: "Asha Gurung",
				onDay: "2026-10-29",
				minutes: 90,
				note: "",
				billable: true,
				running: false,
				startedAt: null,
				canEdit: true,
				locked: false,
			},
		],
		canLog: true,
		lockOn: "2026-10-25",
		today: "2026-10-31",
		enabled: true,
	},
};

/** Task 53: Asha's week (Sunday 26 October to Saturday 1 November), locked through the 25th. */
export const sampleTimesheet: Timesheet = {
	weekStart: "2026-10-26",
	days: ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"],
	today: "2026-10-31",
	lockOn: "2026-10-25",
	workingDays: [0, 1, 2, 3, 4, 5],
	rows: [
		{
			key: "t-1",
			task: { id: "t-1", ref: "WEB-1", title: "Design the new navigation", closed: false },
			project: { id: "p-web", key: "WEB", name: "Website relaunch", color: "teal" },
			editable: true,
			minutes: [120, 240, 0, 180, 60, 0, 0],
		},
		{
			key: "t-4",
			task: { id: "t-4", ref: "WEB-4", title: "Fix the broken contact form", closed: false },
			project: { id: "p-web", key: "WEB", name: "Website relaunch", color: "teal" },
			editable: true,
			minutes: [0, 0, 90, 90, 0, 0, 0],
		},
		{
			key: "project:p-app",
			task: null,
			project: { id: "p-app", key: "APP", name: "Mobile app", color: "indigo" },
			editable: false,
			minutes: [30, 0, 0, 0, 0, 0, 0],
		},
	],
	suggestions: [
		{
			key: "t-2",
			task: { id: "t-2", ref: "WEB-2", title: "Write the launch copy", closed: false },
			project: { id: "p-web", key: "WEB", name: "Website relaunch", color: "teal" },
		},
	],
	capacityMinutes: 2400,
	canLog: true,
	lastWeekMinutes: 1500,
};

/** Task 53: WEB's time against its estimates. */
export const sampleProjectTime: ProjectTime = {
	tasks: [
		{
			taskId: "t-1",
			ref: "WEB-1",
			title: "Design the new navigation",
			assigneeId: "m-asha",
			estimateMinutes: 720,
			loggedMinutes: 600,
			billableMinutes: 0,
			closed: false,
		},
		{
			taskId: "t-4",
			ref: "WEB-4",
			title: "Fix the broken contact form",
			assigneeId: "m-bikash",
			estimateMinutes: 240,
			loggedMinutes: 270,
			billableMinutes: 90,
			closed: false,
		},
		{
			taskId: "t-6",
			ref: "WEB-6",
			title: "Choose the analytics tool",
			assigneeId: null,
			estimateMinutes: 300,
			loggedMinutes: 0,
			billableMinutes: 0,
			closed: false,
		},
	],
	members: [
		{ memberId: "m-asha", name: "Asha Gurung", estimateMinutes: 720, loggedMinutes: 690, billableMinutes: 90 },
		{ memberId: "m-bikash", name: "Bikash Thapa", estimateMinutes: 240, loggedMinutes: 180, billableMinutes: 0 },
	],
	totals: { estimateMinutes: 1260, loggedMinutes: 870, billableMinutes: 90 },
	orphanMinutes: 0,
	entries: [],
	today: "2026-10-31",
};

/** The inbox (Task 50): two unread, one read. */
export const sampleInbox: InboxPage = {
	items: [
		{
			id: "n1",
			kind: "mentioned",
			data: {
				actor: "Bikash Rai",
				ref: "WEB-4",
				title: "Fix the broken contact form",
				project: "Website relaunch",
				excerpt: "@Asha Gurung it only fails on Safari.",
			},
			ws: "team",
			workspaceKind: "team",
			projectKey: "WEB",
			ref: "WEB-4",
			createdAt: "2026-10-31T05:30:00.000Z",
			read: false,
		},
		{
			id: "n2",
			kind: "assigned",
			data: { actor: "Sita Sharma", ref: "WEB-2", title: "Write the launch post", project: "Website relaunch" },
			ws: "team",
			workspaceKind: "team",
			projectKey: "WEB",
			ref: "WEB-2",
			createdAt: "2026-10-31T04:00:00.000Z",
			read: false,
		},
		{
			id: "n3",
			kind: "due",
			data: { ref: "WEB-1", title: "Choose the fonts", project: "Website relaunch", dueOn: "2026-11-01" },
			ws: "team",
			workspaceKind: "team",
			projectKey: "WEB",
			ref: "WEB-1",
			createdAt: "2026-10-31T01:15:00.000Z",
			read: true,
		},
	],
	unread: 2,
	hasMore: false,
	readAt: "2026-10-31T06:00:00.000Z",
};

export const sampleNotifySettings: NotifySettingsView = {
	defaults: {
		assigned: "instant",
		mentioned: "instant",
		comment: "digest",
		status: "digest",
		due: "digest",
		overdue: "digest",
		added: "digest",
		invited: "digest",
		sprint: "digest",
		automation: "digest",
		timer: "digest",
	},
	modes: { status: "off" },
	locale: null,
	member: true,
	email: true,
};

/** Task 56: WEB's own rules (one on, one off), a workspace rule, and the latest runs. */
export const sampleAutomations: Automation[] = [
	{
		id: "0a000000-0000-4000-8000-000000000001",
		projectId: "p-web",
		name: "Ship bugs",
		enabled: true,
		trigger: { type: "status_changed", statusId: "st-done" },
		conditions: [{ type: "task_type", in: ["bug"] }],
		actions: [
			{ type: "add_label", labelId: "l-bug" },
			{ type: "notify", to: "reporter", message: "Check the release notes." },
		],
		version: 2,
		lastRun: { outcome: "ok", at: "2026-10-31T09:00:00.000Z" },
		createdAt: "2026-10-20T09:00:00.000Z",
	},
	{
		id: "0a000000-0000-4000-8000-000000000002",
		projectId: "p-web",
		name: "New work goes to Bikash",
		enabled: false,
		trigger: { type: "task_created" },
		conditions: [],
		actions: [{ type: "assign", to: "m-bikash" }],
		version: 1,
		lastRun: null,
		createdAt: "2026-10-21T09:00:00.000Z",
	},
];

export const sampleWorkspaceAutomation: Automation = {
	id: "0a000000-0000-4000-8000-000000000003",
	projectId: null,
	name: "Remind two days ahead",
	enabled: true,
	trigger: { type: "due_soon", days: 2 },
	conditions: [{ type: "assignee", is: "any" }],
	actions: [{ type: "notify", to: "assignee", message: "Due in two days." }],
	version: 1,
	lastRun: { outcome: "failed", at: "2026-10-31T01:15:00.000Z" },
	createdAt: "2026-10-01T09:00:00.000Z",
};

export const sampleAutomationRuns: AutomationRun[] = [
	{
		id: "0b000000-0000-4000-8000-000000000001",
		automationId: "0a000000-0000-4000-8000-000000000001",
		automation: "Ship bugs",
		projectKey: "WEB",
		ref: "WEB-6",
		title: "Contact form fails on Safari",
		outcome: "ok",
		detail: { applied: 2 },
		at: "2026-10-31T09:00:00.000Z",
	},
	{
		id: "0b000000-0000-4000-8000-000000000002",
		automationId: "0a000000-0000-4000-8000-000000000001",
		automation: "Ship bugs",
		projectKey: "WEB",
		ref: "WEB-3",
		title: "Navigation",
		outcome: "skipped",
		detail: { reason: "conditions" },
		at: "2026-10-30T15:00:00.000Z",
	},
	{
		id: "0b000000-0000-4000-8000-000000000003",
		automationId: "0a000000-0000-4000-8000-000000000001",
		automation: "Ship bugs",
		projectKey: null,
		ref: null,
		title: null,
		outcome: "failed",
		detail: { message: "Something it names no longer exists." },
		at: "2026-10-29T15:00:00.000Z",
	},
];

export const sampleProjectAutomations: ProjectAutomations = {
	automations: sampleAutomations,
	workspace: [sampleWorkspaceAutomation],
	runs: sampleAutomationRuns,
};

// ---- Task 57: templates, reports and updates ------------------------------------------------------

export const sampleProjectUpdates: ProjectUpdate[] = [
	{
		id: "71000000-0000-4000-8000-000000000001",
		health: "at_risk",
		body: "<p>Two bugs are holding the launch back.</p>",
		author: "Asha Gurung",
		at: "2026-10-29T10:00:00.000Z",
	},
	{
		id: "71000000-0000-4000-8000-000000000002",
		health: "on_track",
		body: "<p>The beta is out.</p>",
		author: null,
		at: "2026-10-20T10:00:00.000Z",
	},
];

export const sampleTemplateChoices: TemplateChoice[] = [
	{
		id: "scrum",
		name: "Scrum software",
		description: "Sprints and a backlog.",
		builtin: true,
		counts: { statuses: 6, labels: 3, fields: 1, automations: 2, milestones: 1, tasks: 4 },
	},
	{
		id: "72000000-0000-4000-8000-000000000001",
		name: "Website launch",
		description: "Design, build and launch.",
		builtin: false,
		counts: { statuses: 5, labels: 0, fields: 1, automations: 1, milestones: 1, tasks: 3 },
	},
];

const reportWeek = (week: string, created: number, completed: number, overdue: number) => ({
	week,
	created,
	completed,
	overdue,
});

export const sampleProjectReports: ProjectReports = {
	today: "2026-10-31",
	statuses: [
		{ statusId: "s1", name: "To do", color: "blue", category: "unstarted", count: 4 },
		{ statusId: "s2", name: "In progress", color: "amber", category: "started", count: 2 },
		{ statusId: "s3", name: "Done", color: "green", category: "completed", count: 6 },
	],
	priorities: [
		{ priority: 0, count: 1 },
		{ priority: 1, count: 0 },
		{ priority: 2, count: 3 },
		{ priority: 3, count: 2 },
		{ priority: 4, count: 0 },
	],
	weeks: [
		reportWeek("2026-10-04", 3, 1, 0),
		reportWeek("2026-10-11", 4, 2, 1),
		reportWeek("2026-10-18", 2, 2, 2),
		reportWeek("2026-10-25", 3, 1, 1),
	],
	cycle: {
		medianLeadDays: 6.5,
		medianCycleDays: 3,
		p85CycleDays: 5.25,
		tasks: [
			{ ref: "WEB-3", title: "Fix the header", completedOn: "2026-10-28", leadDays: 9.5, cycleDays: 5.25 },
			{ ref: "WEB-1", title: "Write the copy", completedOn: "2026-10-20", leadDays: 3, cycleDays: null },
		],
	},
	workload: [
		{ memberId: "m1", name: "Asha Gurung", open: 3, overdue: 1, estimateMinutes: 240, points: 5 },
		{ memberId: null, name: null, open: 3, overdue: 0, estimateMinutes: 0, points: 2 },
	],
	time: {
		totals: { estimateMinutes: 480, loggedMinutes: 300, billableMinutes: 60 },
		members: [{ memberId: "m1", name: "Asha Gurung", estimateMinutes: 480, loggedMinutes: 300, billableMinutes: 60 }],
		tasks: [
			{
				taskId: "t1",
				ref: "WEB-3",
				title: "Fix the header",
				assigneeId: "m1",
				estimateMinutes: 480,
				loggedMinutes: 300,
				billableMinutes: 60,
				closed: false,
			},
		],
	},
};
