import "@tanstack/react-start/server-only";
import type {
	CompleteSprintInput,
	CreateSprintInput,
	RankTaskInput,
	UpdateSprintInput,
} from "@/features/taskline/schema";
import { PLANNED_SPRINTS_MAX } from "@/features/taskline/schema";
import { projectSettings } from "@/features/taskline/settings";
import type { SprintReport, SprintSummary, SprintTotals, TaskSummary } from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { isUniqueViolation, notFound } from "@/server/db/crud";
import type { TlSprintRow } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { assertCan, type ProjectAccess, resolveProject, type TasklineServices } from "../access";
import { recordActivity } from "../activity";
import { runAutomations } from "../automations/engine";
import { sprintStartEvents } from "../automations/hooks";
import { actorOf, type NotifyEvent, produce } from "../notify/produce";
import * as projects from "../projects/repository";
import { bumpRev } from "../rev";
import { fieldError } from "../rules";
import * as tasks from "../tasks/repository";
import { resolveTask } from "../tasks/service";
import * as repo from "./repository";

/**
 * Sprints and the backlog (docs/guides/taskline.md, "Sprints and backlog"; decision
 * 0216). A project plans sprints, starts one at a time, and completes it: its
 * unfinished tasks go on to the next sprint, a new one or the backlog, and what was
 * committed and done is kept on the sprint. Everyone who may edit the project plans;
 * the project's "sprints" setting only shows or hides the backlog and its fields.
 */

/** The report's velocity chart shows this many. */
const VELOCITY_CHART = 6;

const conflict = (what: string, message: string) => ruleError("CONFLICT", `Taskline: ${what}`, message);

/** A sprint of the resolved project, or NOT_FOUND. */
async function sprintOf(db: Db, access: ProjectAccess, sprintId: string): Promise<TlSprintRow> {
	const sprint = await repo.getSprint(db, access.project.id, sprintId);
	if (!sprint) throw notFound("Sprint");
	return sprint;
}

/** The project's members (who hear about a sprint starting and completing). */
async function sprintEvent(
	db: Db,
	access: ProjectAccess,
	sprint: TlSprintRow,
	event: "started" | "completed",
): Promise<NotifyEvent> {
	const people = await projects.projectMembers(db, access.project.id);
	return {
		kind: "sprint",
		taskId: null,
		to: people.map((person) => person.memberId),
		data: { project: access.project.name, sprint: sprint.name, sprintEvent: event },
	};
}

const deliverAfter = (services: TasklineServices, ids: string[]) => {
	if (ids.length > 0) services.deliver?.(ids);
};

/** Planning: a new sprint in the project, planned. */
export async function createSprint(
	{ db, user }: TasklineServices,
	{ ws, key, name, goal, startOn, endOn }: CreateSprintInput,
): Promise<SprintSummary> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "edit");
		if ((await repo.countSprints(tx, access.project.id, "planned")) >= PLANNED_SPRINTS_MAX) {
			throw conflict(
				"too many planned sprints",
				m.taskline_sprint_error_planned_max({ max: formatNumber(PLANNED_SPRINTS_MAX) }),
			);
		}
		const sprint = await repo.insertSprint(tx, {
			projectId: access.project.id,
			name,
			goal: goal ?? "",
			startOn,
			endOn,
		});
		await recordActivity(tx, access, { kind: "sprint.created", data: { sprintId: sprint.id, name } });
		await bumpRev(tx, access.project.id);
		return repo.sprintDto(sprint);
	});
}

/** A planned or active sprint's name, goal and dates (an active one keeps its start). */
export async function updateSprint(
	{ db, user }: TasklineServices,
	{ ws, key, id, ...fields }: UpdateSprintInput,
): Promise<SprintSummary> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "edit");
		const before = await sprintOf(tx, access, id);
		if (before.state === "completed") throw repo.completedError();
		const startOn = before.state === "active" ? before.startOn : (fields.startOn ?? before.startOn);
		const endOn = fields.endOn ?? before.endOn;
		if (endOn < startOn) throw fieldError("BAD_REQUEST", "endOn", m.taskline_sprint_error_dates());
		const sprint = await repo.patchSprint(tx, id, {
			name: fields.name ?? before.name,
			goal: fields.goal ?? before.goal,
			startOn,
			endOn,
		});
		await recordActivity(tx, access, { kind: "sprint.updated", data: { sprintId: id, name: sprint.name } });
		await bumpRev(tx, access.project.id);
		return repo.sprintDto(sprint);
	});
}

/** Deletes a planned sprint; its tasks go back to the backlog. An active one is completed instead. */
export async function deleteSprint({ db, user }: TasklineServices, ws: string, key: string, id: string): Promise<void> {
	await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "edit");
		const sprint = await sprintOf(tx, access, id);
		if (sprint.state !== "planned") throw conflict("sprint not planned", m.taskline_sprint_error_delete());
		await repo.deleteSprint(tx, id);
		await recordActivity(tx, access, { kind: "sprint.deleted", data: { sprintId: id, name: sprint.name } });
		await bumpRev(tx, access.project.id);
	});
}

/**
 * Starts a planned sprint: one active per project. A sprint planned to start later
 * starts today. What's in it then is its commitment, and the burndown's first point.
 */
export async function startSprint(services: TasklineServices, ws: string, key: string, id: string) {
	const { db, user } = services;
	const { sprint, notify } = await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "edit");
		const before = await sprintOf(tx, access, id);
		if (before.state !== "planned") throw conflict("sprint not planned", m.taskline_sprint_error_not_planned());
		if (await repo.activeSprint(tx, access.project.id)) throw activeError();
		const today = todayInZone(access.settings.timeZone);
		const startOn = before.startOn > today ? today : before.startOn;
		const endOn = before.endOn < startOn ? startOn : before.endOn;
		const totals = (await repo.totalsOf(tx, [id])).get(id) as SprintTotals;
		let sprint: TlSprintRow;
		try {
			sprint = await repo.patchSprint(tx, id, {
				state: "active",
				startOn,
				endOn,
				startedAt: new Date(),
				committedPoints: totals.scopePoints,
				committedTasks: totals.scopeTasks,
				committedMinutes: totals.scopeMinutes,
			});
		} catch (error) {
			// Two starts at once: the partial unique index lets one through.
			if (isUniqueViolation(error, "tl_sprint_one_active")) throw activeError();
			throw error;
		}
		// The state it started from is the close of the day before its first.
		await repo.writeSnapshot(tx, id, addDays(startOn, -1), totals, { replace: true });
		await recordActivity(tx, access, {
			kind: "sprint.started",
			data: { sprintId: id, name: sprint.name, points: totals.scopePoints, tasks: totals.scopeTasks },
		});
		await bumpRev(tx, access.project.id);
		const actor = actorOf(access, user.id);
		const notify = await produce(tx, access, actor, [await sprintEvent(tx, access, sprint, "started")]);
		notify.push(...(await runAutomations(tx, access, actor, await sprintStartEvents(tx, id))));
		return { sprint: repo.sprintDto(sprint), notify };
	});
	deliverAfter(services, notify);
	return sprint;
}

const activeError = () => conflict("another sprint active", m.taskline_sprint_error_active());

/**
 * Completes the active sprint: what was done is stored, today's close is its last
 * snapshot, and its unfinished tasks go to the backlog, a planned sprint, or a new one
 * (starting tomorrow, as long as this one was). Returns the completed sprint.
 */
export async function completeSprint(services: TasklineServices, input: CompleteSprintInput) {
	const { db, user } = services;
	const { sprint, notify } = await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, input.ws, input.key);
		assertCan(access, "edit");
		const before = await sprintOf(tx, access, input.id);
		if (before.state !== "active") throw conflict("sprint not active", m.taskline_sprint_error_not_active());
		const today = todayInZone(access.settings.timeZone);
		let target: TlSprintRow | null = null;
		if (input.carryTo === "next" && input.nextId) {
			target = await sprintOf(tx, access, input.nextId);
			if (target.state !== "planned") throw conflict("next not planned", m.taskline_sprint_error_next());
		} else if (input.carryTo === "new") {
			const length = Math.max(1, Math.round((Date.parse(before.endOn) - Date.parse(before.startOn)) / 86_400_000) + 1);
			const startOn = addDays(today, 1);
			const number = (await repo.allSprints(tx, access.project.id)).length + 1;
			target = await repo.insertSprint(tx, {
				projectId: access.project.id,
				name: m.taskline_sprint_default_name({ number: formatNumber(number) }),
				startOn,
				endOn: addDays(startOn, length - 1),
			});
			await recordActivity(tx, access, { kind: "sprint.created", data: { sprintId: target.id, name: target.name } });
		}
		const totals = (await repo.totalsOf(tx, [before.id])).get(before.id) as SprintTotals;
		await repo.writeSnapshot(tx, before.id, today, totals, { replace: true });
		const carried = await repo.moveOpenTasks(tx, before.id, target?.id ?? null);
		const sprint = await repo.patchSprint(tx, before.id, {
			state: "completed",
			completedAt: new Date(),
			completedPoints: totals.donePoints,
			completedTasks: totals.doneTasks,
			completedMinutes: totals.doneMinutes,
		});
		await recordActivity(tx, access, {
			kind: "sprint.completed",
			data: {
				sprintId: sprint.id,
				name: sprint.name,
				points: totals.donePoints,
				tasks: totals.doneTasks,
				carried: carried.length,
				to: target?.name ?? null,
			},
		});
		await bumpRev(tx, access.project.id);
		const notify = await produce(tx, access, actorOf(access, user.id), [
			await sprintEvent(tx, access, sprint, "completed"),
		]);
		return { sprint: repo.sprintDto(sprint), notify };
	});
	deliverAfter(services, notify);
	return sprint;
}

/**
 * A drop on the backlog: the task into a sprint (or the backlog, null) at a rank the
 * browser computed. Changing its sprint is in its history; reordering isn't, as on the board.
 */
export async function rankTask(
	{ db, user }: TasklineServices,
	{ ws, ref, sprintId, rank }: RankTaskInput,
): Promise<TaskSummary> {
	return db.transaction(async (tx) => {
		const { access, task: before } = await resolveTask(tx, user, ws, ref);
		assertCan(access, "edit");
		if (before.deletedAt) throw conflict("task in trash", m.taskline_error_in_trash());
		if (sprintId !== null && sprintId !== before.sprintId) await repo.checkSprint(tx, access.project.id, sprintId);
		const task = await tasks.patchTask(tx, before.id, { sprintId, rank });
		if (before.sprintId !== sprintId) {
			await recordActivity(tx, access, {
				kind: "task.updated",
				taskId: task.id,
				data: { field: "sprintId", from: before.sprintId, to: sprintId },
			});
		}
		await bumpRev(tx, access.project.id);
		const [summary] = await tasks.summaries(tx, [task], access.project.key);
		return summary as TaskSummary;
	});
}

/** A sprint's report: its days (the snapshots), today's totals while active, and the project's velocity. */
export async function getSprintReport(
	{ db, user }: TasklineServices,
	ws: string,
	key: string,
	id: string,
): Promise<SprintReport> {
	const access = await resolveProject(db, user, ws, key);
	const sprint = await sprintOf(db, access, id);
	const [days, live, velocity, all] = await Promise.all([
		repo.snapshotsOf(db, id),
		sprint.state === "active" ? repo.totalsOf(db, [id]).then((totals) => totals.get(id) ?? null) : null,
		repo.velocityRows(db, access.project.id, VELOCITY_CHART),
		repo.allSprints(db, access.project.id),
	]);
	return {
		sprint: repo.sprintDto(sprint),
		estimation: projectSettings.parse(access.project.settings).estimation,
		days,
		live,
		today: todayInZone(access.settings.timeZone),
		workingDays: access.settings.workingDays,
		velocity,
		sprints: all.map((row) => ({ id: row.id, name: row.name, state: row.state })),
	};
}
