import "@tanstack/react-start/server-only";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { newOptionId } from "@/features/taskline/fields";
import { storedRecurrence } from "@/features/taskline/recurrence";
import { workspaceSettings } from "@/features/taskline/settings";
import type { TaskFieldValues, TasklineColor, TaskPriority, TaskType } from "@/features/taskline/types";
import { generateKeysBetween } from "@/lib/fractional-index";
import { addDays, todayInZone, weekdayOf } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import {
	type TlMemberRow,
	type TlWorkspaceRow,
	tlActivity,
	tlAutomation,
	tlAutomationRun,
	tlComment,
	tlField,
	tlImport,
	tlInvitation,
	tlLabel,
	tlMember,
	tlNotification,
	tlProject,
	tlProjectMember,
	tlProjectUpdate,
	tlSavedView,
	tlStar,
	tlTask,
	tlTaskDependency,
	tlTaskLabel,
	tlTaskWatcher,
	tlTimeEntry,
	tlWorkspace,
} from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import type { GuestData } from "@/server/guests/data";
import type { ProjectAccess, WorkspaceAccess } from "./access";
import { recordActivity } from "./activity";
import * as fieldRepo from "./fields/repository";
import * as projects from "./projects/repository";
import { insertProjectWithWorkflow } from "./projects/service";
import { nextTaskNumber } from "./rev";
import { richText } from "./rules";
import * as sprints from "./sprints/repository";
import * as tasks from "./tasks/repository";
import * as timeline from "./timeline/repository";
import * as workflow from "./workflow/repository";
import * as workspaces from "./workspace/repository";

/**
 * The sandbox (decision 0203): a private workspace per user, seeded with sample work
 * and three placeholder teammates (members with no account), in the language the
 * user started in. Guests get one when they start (the `GUEST_DATA` entry, 0186);
 * an account can start one. When a guest signs up or in, the claim hands it over.
 */

const SAMPLE_KEY = "WEB";

type SampleTask = {
	title: (t: { locale: Locale }) => string;
	/** Index into the default statuses: 0 backlog, 1 to do, 2 in progress, 3 done, 4 canceled. */
	status: number;
	/** -1: the sandbox's owner; 0–2: a teammate; null: nobody. */
	assignee: number | null;
	priority: TaskPriority;
	labels?: number[];
	due?: number;
	type?: TaskType;
	/** Index of a sample task above: this one is its subtask. */
	parent?: number;
	checklist?: Array<(t: { locale: Locale }) => string>;
	/** Task 52: its estimate, and its sprint (0 the completed one, 1 the active one, 2 the planned one; none: the backlog). */
	points?: number;
	sprint?: 0 | 1 | 2;
	/** Task 53: its estimate, in hours. */
	estimate?: number;
	/** Task 54: its start (days from today), and its milestone (0 the design sign-off, 1 the launch). */
	start?: number;
	milestone?: 0 | 1;
	/** Task 58: a done task's past, in days from today, so the reports have real cycle and lead times. */
	history?: { created: number; started: number; completed: number };
};

const TEAMMATES = [
	{ name: m.taskline_seed_asha, title: m.taskline_seed_title_designer },
	{ name: m.taskline_seed_bikash, title: m.taskline_seed_title_engineer },
	{ name: m.taskline_seed_sita, title: m.taskline_seed_title_product },
];

const LABELS: ReadonlyArray<{ name: (t: { locale: Locale }) => string; color: TasklineColor }> = [
	{ name: (t) => m.taskline_seed_label_design({}, t), color: "violet" },
	{ name: (t) => m.taskline_seed_label_bug({}, t), color: "red" },
	{ name: (t) => m.taskline_seed_label_content({}, t), color: "teal" },
];

const TASKS: ReadonlyArray<SampleTask> = [
	{ title: (t) => m.taskline_seed_task_try({}, t), status: 1, assignee: -1, priority: 2, points: 1 },
	{
		title: (t) => m.taskline_seed_task_copy({}, t),
		status: 1,
		assignee: 2,
		priority: 3,
		labels: [2],
		due: 3,
		points: 3,
		sprint: 1,
		estimate: 4,
		start: -1,
		milestone: 1,
	},
	{
		title: (t) => m.taskline_seed_task_navigation({}, t),
		status: 2,
		assignee: 0,
		priority: 3,
		labels: [0],
		due: 1,
		type: "story",
		points: 5,
		sprint: 1,
		estimate: 12,
		start: -5,
		milestone: 1,
	},
	{
		title: (t) => m.taskline_seed_task_mobile_menu({}, t),
		status: 3,
		assignee: 0,
		priority: 2,
		parent: 2,
		points: 2,
		sprint: 1,
		estimate: 3,
		start: -5,
		due: -2,
		milestone: 1,
		history: { created: -9, started: -5, completed: -3 },
	},
	{
		title: (t) => m.taskline_seed_task_contrast({}, t),
		status: 1,
		assignee: 1,
		priority: 2,
		parent: 2,
		points: 2,
		start: 0,
		due: 2,
		milestone: 1,
	},
	{
		title: (t) => m.taskline_seed_task_contact_form({}, t),
		status: 2,
		assignee: 1,
		priority: 4,
		labels: [1],
		due: -1,
		type: "bug",
		checklist: [
			(t) => m.taskline_seed_check_reproduce({}, t),
			(t) => m.taskline_seed_check_logs({}, t),
			(t) => m.taskline_seed_check_test({}, t),
		],
		points: 3,
		sprint: 1,
		estimate: 6,
		start: -3,
	},
	{
		title: (t) => m.taskline_seed_task_launch_date({}, t),
		status: 1,
		assignee: -1,
		priority: 2,
		due: 7,
		points: 2,
		sprint: 2,
		start: 6,
		milestone: 1,
	},
	{ title: (t) => m.taskline_seed_task_analytics({}, t), status: 0, assignee: null, priority: 1, points: 5 },
	{ title: (t) => m.taskline_seed_task_blog({}, t), status: 0, assignee: 2, priority: 0, labels: [2] },
	{
		title: (t) => m.taskline_seed_task_logo({}, t),
		status: 3,
		assignee: 0,
		priority: 2,
		labels: [0],
		points: 8,
		sprint: 0,
		estimate: 10,
		start: -14,
		due: -9,
		milestone: 0,
		history: { created: -21, started: -14, completed: -13 },
	},
];

/**
 * Task 54: the milestones (the design signed off, done; the launch ahead), in days from
 * today, and which sample tasks block which: the logo blocks the navigation, the
 * navigation and the copy block the launch date, and the copy blocks the contrast
 * check, which starts before the copy is due (the timeline warns about it).
 */
const MILESTONES = [
	{ name: m.taskline_seed_milestone_design, due: -9, completed: true },
	{ name: m.taskline_seed_milestone_launch, due: 8, completed: false },
] as const;
const DEPENDENCIES: ReadonlyArray<readonly [blocker: number, blocked: number]> = [
	[9, 2],
	[2, 6],
	[1, 6],
	[1, 4],
];

/**
 * The sample sprints (Task 52), in days from today: a completed one (its commitment
 * included the copy task, carried over), the active one, and the next. The burndown's
 * days are made up: the work in each sprint was done by `doneOn`.
 */
const SPRINTS = [
	{ start: -22, end: -9, committed: { points: 11, tasks: 2 }, doneOn: -13 },
	{ start: -8, end: 5, committed: { points: 13, tasks: 4 }, doneOn: -3 },
	{ start: 6, end: 19, committed: null, doneOn: null },
] as const;

/**
 * The user's sandbox, created and seeded if they have none (in the caller's
 * transaction), or the one they have.
 */
export async function seedSandbox(tx: Tx, userId: string, locale: Locale): Promise<TlWorkspaceRow> {
	const existing = await workspaces.sandboxOf(tx, userId);
	if (existing) return existing;
	const t = { locale };
	const workspace = await workspaces.insertSandbox(tx, userId, m.taskline_sandbox_name({}, t));
	const account = await workspaces.userIdentity(tx, userId);
	// A guest's name is "Guest" whatever they speak (auth.ts); the claim puts the account's name here.
	const ownerName = account?.isAnonymous ? m.guest_label({}, t) : (account?.name ?? "");
	const [owner, ...teammates] = await workspaces.insertMembers(tx, [
		{ workspaceId: workspace.id, userId, displayName: ownerName },
		...TEAMMATES.map((mate) => ({
			workspaceId: workspace.id,
			userId: null,
			displayName: mate.name({}, t),
			title: mate.title({}, t),
		})),
	]);
	if (!owner) throw new Error("Sandbox owner insert returned no row");
	const access: WorkspaceAccess = {
		workspace,
		settings: workspaceSettings.parse(workspace.settings),
		member: owner,
		sandboxOwner: true,
		admin: null,
		canCreateProject: true,
	};
	const created = await insertProjectWithWorkflow(
		tx,
		access,
		{
			key: SAMPLE_KEY,
			name: m.taskline_seed_project({}, t),
			descriptionHtml: `<p>${m.taskline_seed_project_description({}, t)}</p>`,
			descriptionText: m.taskline_seed_project_description({}, t),
			color: "teal",
		},
		locale,
	);
	const project = created.project;
	for (const mate of teammates) {
		await tx.insert(tlProjectMember).values({ projectId: project.id, memberId: mate.id, role: "member" });
	}
	const statuses = await workflow.listStatuses(tx, project.id);
	const labels = await workflow.insertLabels(
		tx,
		LABELS.map((label) => ({
			workspaceId: workspace.id,
			projectId: project.id,
			name: label.name(t),
			color: label.color,
		})),
	);
	const today = todayInZone(APP_TIME_ZONE);
	const memberFor = (index: number | null) => (index === null ? null : index === -1 ? owner.id : teammates[index]?.id);
	const positions = new Map<string, string[]>();
	for (const status of statuses) {
		const count = TASKS.filter((task) => statuses[task.status]?.id === status.id).length;
		positions.set(status.id, generateKeysBetween(null, null, count));
	}
	const ids: string[] = [];
	const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
	for (const sample of TASKS) {
		const status = statuses[sample.status] ?? statuses[0];
		if (!status) break;
		const closed = status.category === "completed" || status.category === "canceled";
		const past = sample.history;
		const task = await tasks.insertTask(tx, {
			workspaceId: workspace.id,
			projectId: project.id,
			number: await nextTaskNumber(tx, project.id),
			title: sample.title(t),
			type: sample.type ?? "task",
			statusId: status.id,
			position: positions.get(status.id)?.shift() ?? "a0",
			priority: sample.priority,
			assigneeId: memberFor(sample.assignee) ?? null,
			reporterId: owner.id,
			parentId: sample.parent === undefined ? null : (ids[sample.parent] ?? null),
			startOn: sample.start === undefined ? null : addDays(today, sample.start),
			dueOn: sample.due === undefined ? null : addDays(today, sample.due),
			checklist: (sample.checklist ?? []).map((text, index) => ({
				id: crypto.randomUUID(),
				text: text(t),
				done: index === 0,
			})),
			completedAt: past ? daysFromNow(past.completed) : closed ? new Date() : null,
			...(past ? { createdAt: daysFromNow(past.created) } : {}),
			points: sample.points ?? null,
			estimateMinutes: sample.estimate === undefined ? null : sample.estimate * 60,
		});
		ids.push(task.id);
		await tasks.setLabels(
			tx,
			task.id,
			(sample.labels ?? []).flatMap((index) => (labels[index] ? [labels[index].id] : [])),
		);
		await tasks.addWatchers(tx, task.id, [owner.id, task.assigneeId]);
		if (!past) {
			await recordActivity(tx, created, { kind: "task.created", taskId: task.id, data: { title: task.title } });
			continue;
		}
		// Task 58: its life so far, with the days it happened (to do, in progress, done).
		const [toDo, inProgress] = [statuses[1]?.id ?? status.id, statuses[2]?.id ?? status.id];
		const entry = { workspaceId: workspace.id, projectId: project.id, taskId: task.id, actorId: task.assigneeId };
		await tx.insert(tlActivity).values([
			{ ...entry, kind: "task.created", data: { title: task.title }, at: daysFromNow(past.created) },
			{ ...entry, kind: "task.moved", data: { from: toDo, to: inProgress }, at: daysFromNow(past.started) },
			{ ...entry, kind: "task.moved", data: { from: inProgress, to: status.id }, at: daysFromNow(past.completed) },
		]);
	}
	await seedConversation(tx, { workspaceId: workspace.id, projectId: project.id, owner, teammates, taskIds: ids, t });
	await seedSprints(tx, created, ids, today, t);
	await seedTime(tx, { workspaceId: workspace.id, projectId: project.id, owner, teammates, taskIds: ids, today, t });
	await seedTimeline(tx, project.id, ids, today, t);
	await seedFields(tx, { workspaceId: workspace.id, projectId: project.id, teammates, taskIds: ids, t });
	await seedAutomations(tx, {
		workspaceId: workspace.id,
		projectId: project.id,
		owner,
		teammates,
		labelIds: labels.map((label) => label.id),
		taskIds: ids,
		today,
		t,
	});
	// Task 51: a view Asha shared with the project (the list, due this week, soonest first).
	const asha = teammates[0];
	if (asha) {
		// Task 57: her update on how WEB is doing, which sets its health.
		const update = m.taskline_seed_update({}, t);
		await tx.insert(tlProjectUpdate).values({
			projectId: project.id,
			authorId: asha.id,
			health: "on_track",
			bodyHtml: `<p>${escapeHtml(update)}</p>`,
			bodyText: update,
		});
		await tx.update(tlProject).set({ health: "on_track" }).where(eq(tlProject.id, project.id));
		await tx.insert(tlSavedView).values({
			workspaceId: workspace.id,
			projectId: project.id,
			memberId: asha.id,
			name: m.taskline_seed_view_due({}, t),
			view: "list",
			search: "?due=week&sort=due",
			shared: true,
		});
	}
	return workspace;
}

/**
 * The project's sprints (Task 52): sprints on, a completed sprint with its numbers and
 * days, the active one with the days so far, and the next one planned.
 */
async function seedSprints(tx: Tx, access: ProjectAccess, taskIds: string[], today: string, t: { locale: Locale }) {
	const projectId = access.project.id;
	await tx
		.update(tlProject)
		.set({ settings: { sprints: true } })
		.where(eq(tlProject.id, projectId));
	const goals = [m.taskline_seed_sprint_goal_1, m.taskline_seed_sprint_goal_2, m.taskline_seed_sprint_goal_3];
	for (const [index, plan] of SPRINTS.entries()) {
		const state = index === 0 ? "completed" : index === 1 ? "active" : "planned";
		const startOn = addDays(today, plan.start);
		const sprint = await sprints.insertSprint(tx, {
			projectId,
			name: m.taskline_sprint_default_name({ number: formatNumber(index + 1, {}, t.locale) }, t),
			goal: goals[index]?.({}, t) ?? "",
			state,
			startOn,
			endOn: addDays(today, plan.end),
			startedAt: state === "planned" ? null : new Date(`${startOn}T03:00:00Z`),
			completedAt: state === "completed" ? new Date(`${addDays(today, plan.end)}T12:00:00Z`) : null,
			committedPoints: plan.committed?.points ?? null,
			committedTasks: plan.committed?.tasks ?? null,
			completedPoints: state === "completed" ? 8 : null,
			completedTasks: state === "completed" ? 1 : null,
		});
		const mine = TASKS.flatMap((sample, at) => (sample.sprint === index && taskIds[at] ? [taskIds[at]] : []));
		if (mine.length > 0) await tx.update(tlTask).set({ sprintId: sprint.id }).where(inArray(tlTask.id, mine));
		if (!plan.committed || plan.doneOn === null) continue;
		// The days: the commitment until `doneOn`, then what's done in it (the logo, or the mobile menu).
		const done = index === 0 ? { points: 8, tasks: 1 } : { points: 2, tasks: 1 };
		const last = Math.min(plan.end, -1);
		for (let day = plan.start - 1; day <= last; day++) {
			const finished = day >= plan.doneOn;
			const scope = plan.committed;
			await sprints.writeSnapshot(
				tx,
				sprint.id,
				addDays(today, day),
				{
					scopePoints: scope.points,
					scopeTasks: scope.tasks,
					donePoints: finished ? done.points : 0,
					doneTasks: finished ? done.tasks : 0,
					scopeMinutes: 0,
					doneMinutes: 0,
				},
				{ replace: true },
			);
		}
		await recordActivity(tx, access, {
			kind: index === 0 ? "sprint.completed" : "sprint.started",
			data: { sprintId: sprint.id, name: sprint.name, points: index === 0 ? done.points : plan.committed.points },
		});
	}
}

/**
 * Task 53: a week of time on the sample tasks, by the owner and the teammates, on the
 * workspace's working days before today (and some today), with a few notes; the
 * logo's time was billable. Days and minutes are relative, so every sandbox reads the same.
 */
const SAMPLE_TIME: ReadonlyArray<{
	task: number;
	who: -1 | 0 | 1 | 2;
	/** Working days back: 0 is the latest (today, on a working day). */
	day: number;
	minutes: number;
	note?: (t: { locale: Locale }) => string;
	billable?: boolean;
}> = [
	{ task: 0, who: -1, day: 0, minutes: 30 },
	{ task: 2, who: 0, day: 0, minutes: 120, note: (t) => m.taskline_seed_time_note_design({}, t) },
	{ task: 5, who: 1, day: 0, minutes: 90, note: (t) => m.taskline_seed_time_note_fix({}, t) },
	{ task: 6, who: -1, day: 1, minutes: 60, note: (t) => m.taskline_seed_time_note_call({}, t) },
	{ task: 1, who: 2, day: 1, minutes: 150 },
	{ task: 2, who: 0, day: 1, minutes: 240 },
	{ task: 3, who: 0, day: 2, minutes: 180 },
	{ task: 5, who: 1, day: 2, minutes: 210, note: (t) => m.taskline_seed_time_note_review({}, t) },
	{ task: 1, who: -1, day: 3, minutes: 45, note: (t) => m.taskline_seed_time_note_review({}, t) },
	{ task: 9, who: 0, day: 4, minutes: 300, billable: true },
	{ task: 9, who: 0, day: 5, minutes: 240, billable: true },
	{ task: 6, who: -1, day: 4, minutes: 90 },
];

async function seedTime(
	tx: Tx,
	{
		workspaceId,
		projectId,
		owner,
		teammates,
		taskIds,
		today,
		t,
	}: {
		workspaceId: string;
		projectId: string;
		owner: TlMemberRow;
		teammates: TlMemberRow[];
		taskIds: string[];
		today: string;
		t: { locale: Locale };
	},
): Promise<void> {
	const working = workspaceSettings.parse({}).workingDays;
	const days: string[] = [];
	for (let day = today; days.length < 7; day = addDays(day, -1)) if (working.includes(weekdayOf(day))) days.push(day);
	const values = SAMPLE_TIME.flatMap((sample) => {
		const memberId = sample.who === -1 ? owner.id : teammates[sample.who]?.id;
		const taskId = taskIds[sample.task];
		const onDay = days[sample.day];
		if (!memberId || !taskId || !onDay) return [];
		return [
			{
				workspaceId,
				projectId,
				taskId,
				memberId,
				onDay,
				minutes: sample.minutes,
				note: sample.note?.(t) ?? "",
				billable: sample.billable ?? false,
			},
		];
	});
	if (values.length > 0) await tx.insert(tlTimeEntry).values(values);
}

/** Task 54: the project's milestones with their tasks, and the dependencies between the sample tasks. */
async function seedTimeline(tx: Tx, projectId: string, taskIds: string[], today: string, t: { locale: Locale }) {
	const keys = generateKeysBetween(null, null, MILESTONES.length);
	const milestones: string[] = [];
	for (const [index, sample] of MILESTONES.entries()) {
		const milestone = await timeline.insertMilestone(tx, {
			projectId,
			name: sample.name({}, t),
			description: index === 1 ? m.taskline_seed_milestone_launch_description({}, t) : "",
			dueOn: addDays(today, sample.due),
			completedAt: sample.completed ? new Date(`${addDays(today, sample.due)}T12:00:00Z`) : null,
			position: keys[index] ?? "a0",
		});
		milestones.push(milestone.id);
	}
	for (const [index, milestoneId] of milestones.entries()) {
		const mine = TASKS.flatMap((sample, at) => (sample.milestone === index && taskIds[at] ? [taskIds[at]] : []));
		if (mine.length > 0) await tx.update(tlTask).set({ milestoneId }).where(inArray(tlTask.id, mine));
	}
	const pairs = DEPENDENCIES.flatMap(([blocker, blocked]) => {
		const blockerId = taskIds[blocker];
		const blockedId = taskIds[blocked];
		return blockerId && blockedId ? [{ blockerId, blockedId }] : [];
	});
	if (pairs.length > 0) await tx.insert(tlTaskDependency).values(pairs);
}

const escapeHtml = (text: string) =>
	text.replace(
		/[&<>"']/g,
		(char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
	);

/**
 * Task 50: a short conversation on the second task (a teammate mentions the owner, who
 * then sees it in their inbox) and an assignment notice for the first. Seeded notices
 * are never emailed.
 */
async function seedConversation(
	tx: Tx,
	{
		workspaceId,
		projectId,
		owner,
		teammates,
		taskIds,
		t,
	}: {
		workspaceId: string;
		projectId: string;
		owner: TlMemberRow;
		teammates: TlMemberRow[];
		taskIds: string[];
		t: { locale: Locale };
	},
): Promise<void> {
	const [asha, , sita] = teammates;
	const [first, second] = taskIds;
	if (!asha || !sita || !first || !second || !owner.userId) return;
	const ownerName = owner.displayName || m.taskline_seed_you({}, t);
	const mention = `<span data-type="mention" class="mention" data-id="${owner.id}" data-label="${escapeHtml(ownerName)}">@${escapeHtml(ownerName)}</span>`;
	const comments = [
		{ author: asha, html: `<p>${m.taskline_seed_comment_scope({}, t)}</p>`, mentions: [] as string[], minutes: 90 },
		{
			author: asha,
			html: `<p>${mention} ${m.taskline_seed_comment_mention({}, t)}</p>`,
			mentions: [owner.id],
			minutes: 60,
		},
		{ author: sita, html: `<p>${m.taskline_seed_comment_reply({}, t)}</p>`, mentions: [] as string[], minutes: 30 },
	];
	const now = Date.now();
	for (const comment of comments) {
		const safe = richText(comment.html);
		await tx.insert(tlComment).values({
			projectId,
			taskId: second,
			authorId: comment.author.id,
			bodyHtml: safe.html,
			bodyText: safe.text,
			mentions: comment.mentions,
			createdAt: new Date(now - comment.minutes * 60_000),
		});
	}
	const [secondTask, firstTask, project] = await Promise.all([
		tasks.getById(tx, projectId, second),
		tasks.getById(tx, projectId, first),
		tx.select().from(tlProject).where(eq(tlProject.id, projectId)),
	]);
	const key = project[0]?.key ?? SAMPLE_KEY;
	const name = project[0]?.name ?? "";
	await tx.insert(tlNotification).values([
		{
			userId: owner.userId,
			workspaceId,
			projectId,
			taskId: second,
			actorId: asha.id,
			kind: "mentioned",
			data: {
				actor: asha.displayName,
				ref: tasks.taskRef(key, secondTask?.number ?? 2),
				title: secondTask?.title ?? "",
				project: name,
				excerpt: `@${ownerName} ${m.taskline_seed_comment_mention({}, t)}`,
			},
			email: "none",
			createdAt: new Date(now - 60 * 60_000),
		},
		{
			userId: owner.userId,
			workspaceId,
			projectId,
			taskId: first,
			actorId: asha.id,
			kind: "assigned",
			data: {
				actor: asha.displayName,
				ref: tasks.taskRef(key, firstTask?.number ?? 1),
				title: firstTask?.title ?? "",
				project: name,
			},
			email: "none",
			createdAt: new Date(now - 120 * 60_000),
		},
	]);
}

/** `base`, or the first of `base2`, `base3`… (shortened to six characters) not in `taken`. */
export function freeProjectKey(base: string, taken: ReadonlySet<string>): string {
	if (!taken.has(base)) return base;
	for (let suffix = 2; ; suffix++) {
		const candidate = `${base.slice(0, 6 - String(suffix).length)}${suffix}`;
		if (!taken.has(candidate)) return candidate;
	}
}

/**
 * Task 55: the project's own fields (an area to choose, a reviewer, a sign-off box) in
 * the guest's language, with values on most tasks: the panel, the list's columns and
 * the filters have something to show.
 */
async function seedFields(
	tx: Tx,
	{
		workspaceId,
		projectId,
		teammates,
		taskIds,
		t,
	}: {
		workspaceId: string;
		projectId: string;
		teammates: ReadonlyArray<{ id: string }>;
		taskIds: string[];
		t: { locale: Locale };
	},
) {
	const options = [
		{ id: newOptionId(), name: m.taskline_seed_option_design({}, t), color: "violet" as const },
		{ id: newOptionId(), name: m.taskline_seed_option_content({}, t), color: "amber" as const },
		{ id: newOptionId(), name: m.taskline_seed_option_engineering({}, t), color: "blue" as const },
	];
	const scope = { workspaceId, projectId };
	const area = await fieldRepo.insertField(tx, {
		...scope,
		name: m.taskline_seed_field_area({}, t),
		type: "select",
		options,
		position: "a0",
	});
	const reviewer = await fieldRepo.insertField(tx, {
		...scope,
		name: m.taskline_seed_field_reviewer({}, t),
		type: "member",
		position: "a1",
	});
	const signedOff = await fieldRepo.insertField(tx, {
		...scope,
		name: m.taskline_seed_field_signed_off({}, t),
		type: "checkbox",
		position: "a2",
	});
	for (const [index, taskId] of taskIds.entries()) {
		const sample = TASKS[index];
		const values: TaskFieldValues = {};
		const option = options[index % options.length];
		if (option && index < 8) values[area.id] = option.id;
		const mate = teammates[index % teammates.length];
		if (mate && index % 3 === 0) values[reviewer.id] = mate.id;
		if (sample?.status === 3) values[signedOff.id] = true;
		if (Object.keys(values).length > 0) await tx.update(tlTask).set({ fields: values }).where(eq(tlTask.id, taskId));
	}
}

/**
 * Task 56: three of WEB's own rules in the guest's language (a parent closes when its
 * subtasks are done; new bugs go to Bikash with the Bug label, with one run already in
 * the log, on the contact form; a reminder two days before a task is due), and the blog
 * post repeating every month.
 */
async function seedAutomations(
	tx: Tx,
	{
		workspaceId,
		projectId,
		owner,
		teammates,
		labelIds,
		taskIds,
		today,
		t,
	}: {
		workspaceId: string;
		projectId: string;
		owner: TlMemberRow;
		teammates: ReadonlyArray<{ id: string }>;
		labelIds: ReadonlyArray<string>;
		taskIds: ReadonlyArray<string>;
		today: string;
		t: { locale: Locale };
	},
) {
	const bikash = teammates[1];
	const bug = labelIds[1];
	const scope = { workspaceId, projectId, createdById: owner.id };
	const [, bugs] = await tx
		.insert(tlAutomation)
		.values([
			{
				...scope,
				name: m.taskline_seed_automation_subtasks({}, t),
				trigger: { type: "subtasks_done" },
				conditions: [],
				actions: [{ type: "set_status", category: "completed" }],
			},
			{
				...scope,
				name: m.taskline_seed_automation_bugs({}, t),
				trigger: { type: "task_created" },
				conditions: [{ type: "task_type", in: ["bug"] }],
				actions: [
					...(bikash ? [{ type: "assign" as const, to: bikash.id }] : []),
					...(bug ? [{ type: "add_label" as const, labelId: bug }] : []),
				],
			},
			{
				...scope,
				name: m.taskline_seed_automation_due({}, t),
				trigger: { type: "due_soon", days: 2 },
				conditions: [{ type: "assignee", is: "any" }],
				actions: [{ type: "notify", to: "assignee", message: m.taskline_seed_automation_due_message({}, t) }],
			},
		])
		.returning({ id: tlAutomation.id });
	const contactForm = taskIds[5];
	if (bugs && contactForm) {
		await tx.insert(tlAutomationRun).values({
			automationId: bugs.id,
			taskId: contactForm,
			outcome: "ok",
			detail: { applied: 2 },
			at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
		});
	}
	const blog = taskIds[8];
	if (blog) {
		await tx
			.update(tlTask)
			.set({ recurrence: storedRecurrence({ freq: "monthly", interval: 1 }, today) })
			.where(eq(tlTask.id, blog));
	}
}

/** Points every id an automation names (a member, a label) at another: uuids, so a text replace is exact. */
async function replaceInAutomations(tx: Tx, from: string, to: string): Promise<void> {
	await tx.execute(
		sql`update ${tlAutomation} set trigger = replace(trigger::text, ${from}, ${to})::jsonb, conditions = replace(conditions::text, ${from}, ${to})::jsonb, actions = replace(actions::text, ${from}, ${to})::jsonb where position(${from} in trigger::text || conditions::text || actions::text) > 0`,
	);
}

/** Points every reference to one member at another (the claim's merge). */
async function remapMember(tx: Tx, from: string, to: string): Promise<void> {
	await tx.update(tlTask).set({ assigneeId: to }).where(eq(tlTask.assigneeId, from));
	await tx.update(tlTask).set({ reporterId: to }).where(eq(tlTask.reporterId, from));
	await tx.update(tlProject).set({ leadId: to }).where(eq(tlProject.leadId, from));
	await tx.update(tlActivity).set({ actorId: to }).where(eq(tlActivity.actorId, from));
	await tx.update(tlInvitation).set({ invitedById: to }).where(eq(tlInvitation.invitedById, from));
	await tx.update(tlProjectMember).set({ memberId: to }).where(eq(tlProjectMember.memberId, from));
	// Stars and watchers have the pair as their key: keep one row per pair.
	await tx.execute(
		sql`insert into ${tlStar} (member_id, project_id) select ${to}, project_id from ${tlStar} where member_id = ${from} on conflict do nothing`,
	);
	await tx.delete(tlStar).where(eq(tlStar.memberId, from));
	await tx.execute(
		sql`insert into ${tlTaskWatcher} (task_id, member_id) select task_id, ${to} from ${tlTaskWatcher} where member_id = ${from} on conflict do nothing`,
	);
	await tx.delete(tlTaskWatcher).where(eq(tlTaskWatcher.memberId, from));
	// Task 50: comments' authors and mentions, and who caused notifications.
	await tx.update(tlComment).set({ authorId: to }).where(eq(tlComment.authorId, from));
	await tx.execute(
		sql`update ${tlComment} set mentions = array_replace(mentions, ${from}::uuid, ${to}::uuid) where ${from}::uuid = any(mentions)`,
	);
	await tx.update(tlNotification).set({ actorId: to }).where(eq(tlNotification.actorId, from));
	// Saved views (Task 51): the guest's projects are distinct from the account's, so names can't collide.
	await tx.update(tlSavedView).set({ memberId: to }).where(eq(tlSavedView.memberId, from));
	// Time (Task 53): one timer runs per member, so the guest's stops first (what it counted is kept).
	await tx.execute(
		sql`update ${tlTimeEntry} set ended_at = now(), minutes = least(720, greatest(1, round(extract(epoch from now() - started_at) / 60)::int)) where member_id = ${from} and started_at is not null and ended_at is null`,
	);
	await tx.update(tlTimeEntry).set({ memberId: to }).where(eq(tlTimeEntry.memberId, from));
	// Automations (Task 56): who made a rule, and the members its conditions and actions name.
	await tx.update(tlAutomation).set({ createdById: to }).where(eq(tlAutomation.createdById, from));
	// Project updates (Task 57): who posted them.
	await tx.update(tlProjectUpdate).set({ authorId: to }).where(eq(tlProjectUpdate.authorId, from));
	await replaceInAutomations(tx, from, to);
	// Custom fields (Task 55): a person field's value is a member id.
	await tx.execute(
		sql`update ${tlTask} set fields = (select jsonb_object_agg(e.key, case when e.value = to_jsonb(${from}::text) and e.key in (select id::text from ${tlField} where type = 'member') then to_jsonb(${to}::text) else e.value end) from jsonb_each(${tlTask.fields}) as e) where exists (select 1 from jsonb_each(${tlTask.fields}) as e where e.value = to_jsonb(${from}::text))`,
	);
}

/**
 * Hands a guest's sandbox to an account (decision 0186's claim). With no sandbox of
 * its own the account simply takes it over. Otherwise the guest's projects, teammates
 * and history move into the account's sandbox: a project whose key is taken there
 * gets a suffix (WEB → WEB2), workspace labels merge by name, and what the guest did
 * becomes the account's. Quotas don't apply: nothing the guest made is lost.
 */
export async function claimSandbox(tx: Tx, fromUserId: string, toUserId: string): Promise<void> {
	const guest = await workspaces.sandboxOf(tx, fromUserId);
	if (!guest) return;
	const guestMember = await workspaces.memberOf(tx, guest.id, fromUserId);
	const accountName = (await workspaces.userName(tx, toUserId)) ?? "";
	const target = await workspaces.sandboxOf(tx, toUserId);
	// The guest's inbox is the account's now (Task 50).
	await tx.update(tlNotification).set({ userId: toUserId }).where(eq(tlNotification.userId, fromUserId));
	await tx.update(tlImport).set({ userId: toUserId }).where(eq(tlImport.userId, fromUserId));
	if (!target) {
		await tx.update(tlWorkspace).set({ ownerId: toUserId }).where(eq(tlWorkspace.id, guest.id));
		if (guestMember) {
			await tx
				.update(tlMember)
				.set({ userId: toUserId, displayName: accountName })
				.where(eq(tlMember.id, guestMember.id));
		}
		return;
	}
	const accountMember =
		(await workspaces.memberOf(tx, target.id, toUserId)) ??
		(await workspaces.insertMembers(tx, [{ workspaceId: target.id, userId: toUserId, displayName: accountName }]))[0];
	if (guestMember && accountMember) await remapMember(tx, guestMember.id, accountMember.id);
	// The teammates (everyone but the guest) move with their work.
	await tx
		.update(tlMember)
		.set({ workspaceId: target.id })
		.where(and(eq(tlMember.workspaceId, guest.id), guestMember ? ne(tlMember.id, guestMember.id) : undefined));
	const taken = await projects.projectKeys(tx, target.id);
	const moving = await tx.select().from(tlProject).where(eq(tlProject.workspaceId, guest.id));
	for (const project of moving) {
		const key = freeProjectKey(project.key, taken);
		taken.add(key);
		await tx.update(tlProject).set({ workspaceId: target.id, key }).where(eq(tlProject.id, project.id));
	}
	await tx.update(tlTask).set({ workspaceId: target.id }).where(eq(tlTask.workspaceId, guest.id));
	await tx.update(tlActivity).set({ workspaceId: target.id }).where(eq(tlActivity.workspaceId, guest.id));
	await tx.update(tlNotification).set({ workspaceId: target.id }).where(eq(tlNotification.workspaceId, guest.id));
	await tx.update(tlSavedView).set({ workspaceId: target.id }).where(eq(tlSavedView.workspaceId, guest.id));
	await tx.update(tlTimeEntry).set({ workspaceId: target.id }).where(eq(tlTimeEntry.workspaceId, guest.id));
	await tx
		.update(tlLabel)
		.set({ workspaceId: target.id })
		.where(and(eq(tlLabel.workspaceId, guest.id), sql`${tlLabel.projectId} is not null`));
	// Task 56: the projects' own automations go with them (a sandbox has no workspace rules).
	await tx
		.update(tlAutomation)
		.set({ workspaceId: target.id })
		.where(and(eq(tlAutomation.workspaceId, guest.id), sql`${tlAutomation.projectId} is not null`));
	await mergeWorkspaceLabels(tx, guest.id, target.id);
	// Task 55: the projects' own fields go with them (a sandbox has no workspace fields of its own to merge).
	await tx
		.update(tlField)
		.set({ workspaceId: target.id })
		.where(and(eq(tlField.workspaceId, guest.id), sql`${tlField.projectId} is not null`));
	// What's left (the guest's own member row) goes with the workspace.
	await tx.delete(tlWorkspace).where(eq(tlWorkspace.id, guest.id));
}

/** Workspace-wide labels: one the target has by name (any case) takes the guest's tasks; the rest move. */
async function mergeWorkspaceLabels(tx: Tx, fromWorkspaceId: string, toWorkspaceId: string): Promise<void> {
	const guestLabels = await tx
		.select()
		.from(tlLabel)
		.where(and(eq(tlLabel.workspaceId, fromWorkspaceId), isNull(tlLabel.projectId)));
	if (guestLabels.length === 0) return;
	const existing = await tx
		.select()
		.from(tlLabel)
		.where(and(eq(tlLabel.workspaceId, toWorkspaceId), isNull(tlLabel.projectId)));
	const byName = new Map(existing.map((label) => [label.name.toLowerCase(), label.id]));
	const moving: string[] = [];
	for (const label of guestLabels) {
		const same = byName.get(label.name.toLowerCase());
		if (!same) {
			moving.push(label.id);
			continue;
		}
		await tx.execute(
			sql`insert into ${tlTaskLabel} (task_id, label_id) select task_id, ${same} from ${tlTaskLabel} where label_id = ${label.id} on conflict do nothing`,
		);
		await replaceInAutomations(tx, label.id, same);
		await tx.delete(tlLabel).where(eq(tlLabel.id, label.id));
	}
	if (moving.length > 0) {
		await tx.update(tlLabel).set({ workspaceId: toWorkspaceId }).where(inArray(tlLabel.id, moving));
	}
}

/** Taskline's entry in `GUEST_DATA` (src/server/guests/data.ts): a guest's sandbox and its claim. */
export const TASKLINE_GUEST_DATA: GuestData = {
	slug: "taskline",
	seedGuestData: async (tx, userId, locale) => {
		await seedSandbox(tx, userId, locale);
	},
	claim: claimSandbox,
};
