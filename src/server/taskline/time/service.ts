import "@tanstack/react-start/server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { startOfWeek, weekOf } from "@/features/taskline/calendar/grid";
import type { LogTimeInput, TimesheetCellInput, UpdateTimeEntryInput } from "@/features/taskline/schema";
import { TASK_TIME_ENTRIES } from "@/features/taskline/schema";
import { planCell } from "@/features/taskline/time/sheet";
import {
	type CopyWeekResult,
	isClosedCategory,
	type ProjectTime,
	type RunningTimer,
	type StatusCategory,
	TIMER_MAX_MINUTES,
	type TimeEntry,
	type Timesheet,
	type TimesheetRow,
} from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import { isUniqueViolation, notFound } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import {
	type TlProjectRow,
	type TlTaskRow,
	type TlTimeEntryRow,
	tlMember,
	tlProject,
	tlStatus,
	tlTask,
	tlTimeEntry,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import {
	assertCan,
	type ProjectAccess,
	projectAccess,
	resolveProject,
	resolveWorkspace,
	type TasklineServices,
	type TasklineUser,
	type WorkspaceAccess,
} from "../access";
import { recordActivity } from "../activity";
import { visibleProjectRows } from "../home/service";
import { bumpRev } from "../rev";
import { notMemberError, quotaError, quotaScope, quotasOf } from "../rules";
import { taskRef } from "../tasks/repository";
import { resolveTask } from "../tasks/service";
import * as repo from "./repository";
import { assertOpenDay, entryRights, isLocked, isTimeAdmin, lockedError, runningTimer } from "./rules";

/**
 * Time tracking (docs/guides/taskline.md, "Time"; decision 0218): the timer, time
 * logged by hand, the timesheet's cells and its copy of last week, and a project's
 * estimate against actual. Time is a member's: it needs a member row and the right
 * to edit the project (`can.logTime`); the lock date and the rules are in ./rules.ts.
 * Every write moves the project's `rev` (open time pages and tasks refresh), and new
 * time leaves `time.logged` in the task's history.
 */

const MINUTE_MS = 60_000;

const conflict = (what: string, message: string) => ruleError("CONFLICT", `Taskline: ${what}`, message);

/** The caller's member row: time is a member's (an admin reading the team has none). */
function memberOf(access: WorkspaceAccess) {
	if (!access.member) throw notMemberError();
	return access.member;
}

/** A task time can go on: the caller may log in its project, and it isn't in the trash. */
async function loggableTask(tx: Tx, user: TasklineUser, ws: string, ref: string) {
	const { access, task } = await resolveTask(tx, user, ws, ref);
	assertCan(access, "logTime");
	const member = memberOf(access);
	if (task.deletedAt) throw conflict("task in trash", m.taskline_error_in_trash());
	return { access, task, member };
}

/** Counts the workspace's entries under its quota lock; refuses when `adding` more would pass it. */
async function checkQuota(tx: Tx, access: WorkspaceAccess, adding = 1): Promise<void> {
	await lockQuota(tx, quotaScope(access.workspace.id));
	const max = quotasOf(access).timeEntries;
	if ((await repo.countEntries(tx, access.workspace.id)) + adding > max) throw quotaError("timeEntries", max);
}

/** A timer's minutes when it stops at `at`: whole minutes, 12 hours at most. */
const timerMinutes = (row: TlTimeEntryRow, at: Date) =>
	Math.min(TIMER_MAX_MINUTES, Math.round((at.getTime() - (row.startedAt?.getTime() ?? at.getTime())) / MINUTE_MS));

/**
 * Stops every running timer of the account's (in any workspace): each becomes an entry
 * of what it counted, or goes when it ran under a minute (a start pressed by mistake).
 * Stopping is bookkeeping on the caller's own rows, so it needs no project access.
 */
async function stopRunning(tx: Tx, userId: string, at: Date): Promise<TlTimeEntryRow[]> {
	const stopped: TlTimeEntryRow[] = [];
	for (const { entry } of await repo.runningOfUser(tx, userId)) {
		const minutes = timerMinutes(entry, at);
		if (minutes < 1) {
			await repo.deleteEntries(tx, [entry.id]);
		} else {
			const row = await repo.patchEntry(tx, entry.id, { endedAt: at, minutes });
			await repo.recordLogged(tx, row);
			stopped.push(row);
		}
		await bumpRev(tx, entry.projectId);
	}
	return stopped;
}

/**
 * Starts the caller's timer on a task. One runs per person: one already running
 * (here or in their other workspace) stops first and is logged. The server's clock
 * stamps the start, and the day is today in the workspace's time zone.
 */
export async function startTimer({ db, user }: TasklineServices, ws: string, ref: string): Promise<RunningTimer> {
	await db.transaction(async (tx) => {
		const { access, task, member } = await loggableTask(tx, user, ws, ref);
		const now = new Date();
		await stopRunning(tx, user.id, now);
		await checkQuota(tx, access);
		try {
			await repo.insertEntry(tx, {
				workspaceId: access.workspace.id,
				projectId: access.project.id,
				taskId: task.id,
				memberId: member.id,
				onDay: todayInZone(access.settings.timeZone, now),
				startedAt: now,
			});
		} catch (error) {
			// Two starts at once: the partial unique index lets one through.
			if (isUniqueViolation(error, "tl_time_entry_one_running")) {
				throw conflict("timer running", m.taskline_time_error_running());
			}
			throw error;
		}
		await bumpRev(tx, access.project.id);
	});
	const timer = await runningTimer(db, user.id);
	if (!timer) throw new Error("Started timer not found");
	return timer;
}

/** Stops the caller's running timer: the entry it made, or null (none ran, or it ran under a minute). */
export async function stopTimer({ db, user }: TasklineServices): Promise<{ minutes: number } | null> {
	const stopped = await db.transaction((tx) => stopRunning(tx, user.id, new Date()));
	const minutes = stopped.reduce((sum, row) => sum + row.minutes, 0);
	return stopped.length > 0 ? { minutes } : null;
}

async function entryOf(db: Db, access: ProjectAccess, user: TasklineUser, row: TlTimeEntryRow): Promise<TimeEntry> {
	const [described] = await repo.describe(db, [row]);
	if (!described) throw notFound("Time entry");
	return repo.entryDto(described, entryRights(access, user, row));
}

/** Time logged by hand on a task. */
export async function logTime({ db, user }: TasklineServices, input: LogTimeInput): Promise<TimeEntry> {
	return db.transaction(async (tx) => {
		const { access, task, member } = await loggableTask(tx, user, input.ws, input.ref);
		assertOpenDay(access, input.onDay);
		await checkQuota(tx, access);
		const row = await repo.insertEntry(tx, {
			workspaceId: access.workspace.id,
			projectId: access.project.id,
			taskId: task.id,
			memberId: member.id,
			onDay: input.onDay,
			minutes: input.minutes,
			note: input.note ?? "",
			billable: input.billable ?? false,
		});
		await recordActivity(tx, access, {
			kind: "time.logged",
			taskId: task.id,
			data: { minutes: row.minutes, entryId: row.id },
		});
		await bumpRev(tx, access.project.id);
		return entryOf(tx, access, user, row);
	});
}

/**
 * An entry of the workspace the caller may change: theirs (or, in the team with
 * `taskline:time`, anyone's) in a project they may still log in, on an open day, not running.
 * One they can't see is NOT_FOUND, as everything else.
 */
async function changeableEntry(tx: Tx, user: TasklineUser, ws: string, id: string, { discard = false } = {}) {
	const workspace = await resolveWorkspace(tx, user, ws);
	const row = await repo.getEntry(tx, workspace.workspace.id, id);
	if (!row) throw notFound("Time entry");
	const [project] = await tx.select().from(tlProject).where(eq(tlProject.id, row.projectId));
	if (!project) throw notFound("Time entry");
	const access = await projectAccess(tx, workspace, project);
	const own = access.member !== null && access.member.id === row.memberId;
	if (!own && !isTimeAdmin(access, user)) {
		throw ruleError("FORBIDDEN", "Taskline: not your time", m.taskline_time_error_not_yours());
	}
	assertCan(access, "logTime");
	if (isLocked(access.settings, row.onDay) && access.settings.timesheetLockOn) {
		throw lockedError(access.settings.timesheetLockOn);
	}
	const running = row.startedAt !== null && row.endedAt === null;
	if (running && !discard) throw conflict("timer running", m.taskline_time_error_edit_running());
	return { access, row };
}

/** An entry's day, length, note or billable flag. */
export async function updateEntry(
	{ db, user }: TasklineServices,
	{ ws, id, ...fields }: UpdateTimeEntryInput,
): Promise<TimeEntry> {
	return db.transaction(async (tx) => {
		const { access, row: before } = await changeableEntry(tx, user, ws, id);
		if (fields.onDay !== undefined && fields.onDay !== before.onDay) assertOpenDay(access, fields.onDay);
		const row = await repo.patchEntry(tx, id, fields);
		await bumpRev(tx, access.project.id);
		return entryOf(tx, access, user, row);
	});
}

/** Deletes an entry; a running timer is discarded (nothing logged). */
export async function deleteEntry({ db, user }: TasklineServices, ws: string, id: string): Promise<void> {
	await db.transaction(async (tx) => {
		const { access, row } = await changeableEntry(tx, user, ws, id, { discard: true });
		await repo.deleteEntries(tx, [row.id]);
		await bumpRev(tx, access.project.id);
	});
}

/**
 * A timesheet cell typed: the caller's time on a task and day becomes `minutes`
 * (`planCell`: a new entry for more, the newest entries cut for less).
 */
export async function setCell(
	{ db, user }: TasklineServices,
	{ ws, ref, onDay, minutes }: TimesheetCellInput,
): Promise<{ minutes: number }> {
	return db.transaction(async (tx) => {
		const { access, task, member } = await loggableTask(tx, user, ws, ref);
		assertOpenDay(access, onDay);
		const plan = planCell(await repo.cellEntries(tx, member.id, task.id, onDay), minutes);
		if (plan.insert !== null) {
			await checkQuota(tx, access);
			const row = await repo.insertEntry(tx, {
				workspaceId: access.workspace.id,
				projectId: access.project.id,
				taskId: task.id,
				memberId: member.id,
				onDay,
				minutes: plan.insert,
			});
			await recordActivity(tx, access, {
				kind: "time.logged",
				taskId: task.id,
				data: { minutes: row.minutes, entryId: row.id },
			});
		}
		for (const change of plan.update) await repo.patchEntry(tx, change.id, { minutes: change.minutes });
		await repo.deleteEntries(tx, plan.remove);
		if (plan.insert !== null || plan.update.length > 0 || plan.remove.length > 0) {
			await bumpRev(tx, access.project.id);
		}
		return { minutes };
	});
}

/** What a timesheet's rows say about their tasks and projects: names, and whether the caller may log on them. */
async function rowContext(db: Db, access: WorkspaceAccess, projectIds: string[], taskIds: string[]) {
	const [projects, tasks] = await Promise.all([
		projectIds.length === 0
			? Promise.resolve([] as TlProjectRow[])
			: db.select().from(tlProject).where(inArray(tlProject.id, projectIds)),
		taskIds.length === 0
			? Promise.resolve([] as Array<{ task: TlTaskRow; category: StatusCategory }>)
			: db
					.select({ task: tlTask, category: tlStatus.category })
					.from(tlTask)
					.innerJoin(tlStatus, eq(tlStatus.id, tlTask.statusId))
					.where(inArray(tlTask.id, taskIds)),
	]);
	const writable = new Map<string, boolean>();
	for (const project of projects) {
		try {
			const projectAcc = await projectAccess(db, access, project);
			writable.set(project.id, projectAcc.can.logTime && access.member !== null);
		} catch {
			// A project they can't see any more (they left a private one): their time shows, read only.
			writable.set(project.id, false);
		}
	}
	return {
		project: new Map(projects.map((row) => [row.id, row])),
		task: new Map(tasks.map((row) => [row.task.id, row])),
		writable,
	};
}

/**
 * The caller's week in a workspace (/$ws/timesheet): a row per task they logged on
 * (and per project whose task is gone), seven days from the workspace's week start,
 * with tasks to add as rows. An admin without a member row has nothing to log.
 */
export async function getTimesheet(services: TasklineServices, ws: string, week: string): Promise<Timesheet> {
	const { db, user } = services;
	const access = await resolveWorkspace(db, user, ws);
	const days = weekOf(startOfWeek(week, access.settings.weekStart), access.settings.weekStart);
	const first = days[0] ?? week;
	const last = days[6] ?? week;
	const base = {
		weekStart: first,
		days,
		today: todayInZone(access.settings.timeZone),
		lockOn: access.settings.timesheetLockOn,
		workingDays: access.settings.workingDays,
	};
	const member = access.member;
	if (!member) {
		return { ...base, rows: [], suggestions: [], capacityMinutes: null, canLog: false, lastWeekMinutes: 0 };
	}
	const [sums, lastWeek, visible] = await Promise.all([
		repo.sumsByCell(db, member.id, first, last),
		repo.sumsByCell(db, member.id, addDays(first, -7), addDays(first, -1)),
		visibleProjectRows(db, access, { archived: false }),
	]);
	const assigned = await repo.assignedOpenTasks(
		db,
		member.id,
		visible.map((row) => row.id),
		30,
	);
	const context = await rowContext(
		db,
		access,
		[...new Set([...sums.map((row) => row.projectId), ...assigned.map((row) => row.projectId)])],
		[...new Set([...sums.flatMap((row) => (row.taskId ? [row.taskId] : [])), ...assigned.map((row) => row.id)])],
	);
	const rowFor = (projectId: string, taskId: string | null): Omit<TimesheetRow, "minutes"> | null => {
		const project = context.project.get(projectId);
		if (!project) return null;
		const found = taskId ? context.task.get(taskId) : undefined;
		return {
			key: taskId ?? `project:${projectId}`,
			task: found
				? {
						id: found.task.id,
						ref: taskRef(project.key, found.task.number),
						title: found.task.title,
						closed: isClosedCategory(found.category),
					}
				: null,
			project: { id: project.id, key: project.key, name: project.name, color: project.color },
			editable: Boolean(found && !found.task.deletedAt && context.writable.get(project.id)),
		};
	};
	const rows = new Map<string, TimesheetRow>();
	for (const sum of sums) {
		const key = sum.taskId ?? `project:${sum.projectId}`;
		let row = rows.get(key);
		if (!row) {
			const made = rowFor(sum.projectId, sum.taskId);
			if (!made) continue;
			row = { ...made, minutes: days.map(() => 0) };
			rows.set(key, row);
		}
		const index = days.indexOf(sum.onDay);
		if (index >= 0) row.minutes[index] = (row.minutes[index] ?? 0) + sum.minutes;
	}
	const suggestions = assigned.flatMap((task) => {
		if (rows.has(task.id)) return [];
		const made = rowFor(task.projectId, task.id);
		return made?.editable ? [{ key: made.key, task: made.task, project: made.project }] : [];
	});
	return {
		...base,
		rows: [...rows.values()].sort(
			(a, b) =>
				a.project.key.localeCompare(b.project.key) ||
				(a.task ? Number(a.task.ref.split("-")[1]) : 0) - (b.task ? Number(b.task.ref.split("-")[1]) : 0),
		),
		suggestions,
		capacityMinutes: member.capacityMinutesWeek,
		canLog: true,
		lastWeekMinutes: lastWeek.reduce((sum, row) => sum + row.minutes, 0),
	};
}

/**
 * Copies last week's time into the week holding `week`: each task's day there becomes
 * the same day here, for tasks with no time yet this week, on days that are open (not
 * locked, not after today) and tasks the caller may still log on. Copied time isn't
 * billable unless it was.
 */
export async function copyLastWeek({ db, user }: TasklineServices, ws: string, week: string): Promise<CopyWeekResult> {
	return db.transaction(async (tx) => {
		const access = await resolveWorkspace(tx, user, ws);
		const member = memberOf(access);
		const first = startOfWeek(week, access.settings.weekStart);
		const [source, here] = await Promise.all([
			repo.sumsByCellAndBillable(tx, member.id, addDays(first, -7), addDays(first, -1)),
			repo.sumsByCell(tx, member.id, first, addDays(first, 6)),
		]);
		const busy = new Set(here.flatMap((row) => (row.taskId ? [row.taskId] : [])));
		const context = await rowContext(
			tx,
			access,
			[...new Set(source.map((row) => row.projectId))],
			source.flatMap((row) => (row.taskId ? [row.taskId] : [])),
		);
		const today = todayInZone(access.settings.timeZone);
		let skipped = 0;
		const values: Array<typeof tlTimeEntry.$inferInsert> = [];
		for (const cell of source) {
			const day = addDays(cell.onDay, 7);
			const task = cell.taskId ? context.task.get(cell.taskId) : undefined;
			const open =
				task && !task.task.deletedAt && context.writable.get(cell.projectId) && !busy.has(task.task.id) && day <= today;
			if (!open || isLocked(access.settings, day)) {
				skipped++;
				continue;
			}
			values.push({
				workspaceId: access.workspace.id,
				projectId: cell.projectId,
				taskId: cell.taskId,
				memberId: member.id,
				onDay: day,
				minutes: cell.minutes,
				billable: cell.billable,
			});
		}
		if (values.length === 0) return { copied: 0, skipped };
		await checkQuota(tx, access, values.length);
		const rows = await repo.insertEntries(tx, values);
		for (const row of rows) await repo.recordLogged(tx, row);
		for (const projectId of new Set(rows.map((row) => row.projectId))) await bumpRev(tx, projectId);
		return { copied: rows.length, skipped };
	});
}

/** A project's time: estimate against actual by task and by member, and its newest entries. */
export async function getProjectTime({ db, user }: TasklineServices, ws: string, key: string): Promise<ProjectTime> {
	const access = await resolveProject(db, user, ws, key);
	const projectId = access.project.id;
	const [byTask, byMember, tasks, latest] = await Promise.all([
		repo.sumsByTask(db, projectId),
		repo.sumsByMember(db, projectId),
		db
			.select({ task: tlTask, category: tlStatus.category })
			.from(tlTask)
			.innerJoin(tlStatus, eq(tlStatus.id, tlTask.statusId))
			.where(and(eq(tlTask.projectId, projectId), isNull(tlTask.deletedAt))),
		repo.latestEntries(db, eq(tlTimeEntry.projectId, projectId), TASK_TIME_ENTRIES),
	]);
	const logged = new Map(byTask.map((row) => [row.taskId, row]));
	const rows = tasks
		.filter(({ task }) => task.estimateMinutes !== null || logged.has(task.id))
		.map(({ task, category }) => ({
			taskId: task.id,
			ref: taskRef(access.project.key, task.number),
			title: task.title,
			assigneeId: task.assigneeId,
			estimateMinutes: task.estimateMinutes,
			loggedMinutes: logged.get(task.id)?.logged ?? 0,
			billableMinutes: logged.get(task.id)?.billable ?? 0,
			closed: isClosedCategory(category),
		}))
		.sort((a, b) => b.loggedMinutes - a.loggedMinutes || a.ref.localeCompare(b.ref, undefined, { numeric: true }));
	const estimateOf = new Map<string, number>();
	for (const { task } of tasks) {
		if (task.assigneeId && task.estimateMinutes) {
			estimateOf.set(task.assigneeId, (estimateOf.get(task.assigneeId) ?? 0) + task.estimateMinutes);
		}
	}
	const memberIds = [...new Set([...byMember.map((row) => row.memberId), ...estimateOf.keys()])];
	const described = await repo.describe(db, latest);
	const names = new Map(described.map((entry) => [entry.row.memberId, entry.memberName]));
	const missing = memberIds.filter((id) => !names.has(id));
	if (missing.length > 0) {
		for (const row of await db
			.select({ id: tlMember.id, name: tlMember.displayName })
			.from(tlMember)
			.where(inArray(tlMember.id, missing))) {
			names.set(row.id, row.name);
		}
	}
	const memberSums = new Map(byMember.map((row) => [row.memberId, row]));
	const members = memberIds
		.map((memberId) => ({
			memberId,
			name: names.get(memberId) ?? "",
			estimateMinutes: estimateOf.get(memberId) ?? 0,
			loggedMinutes: memberSums.get(memberId)?.logged ?? 0,
			billableMinutes: memberSums.get(memberId)?.billable ?? 0,
		}))
		.sort((a, b) => b.loggedMinutes - a.loggedMinutes || a.name.localeCompare(b.name));
	const sum = (pick: (row: { logged: number; billable: number }) => number) =>
		byTask.reduce((total, row) => total + pick(row), 0);
	return {
		tasks: rows,
		members,
		totals: {
			estimateMinutes: tasks.reduce((total, { task }) => total + (task.estimateMinutes ?? 0), 0),
			loggedMinutes: sum((row) => row.logged),
			billableMinutes: sum((row) => row.billable),
		},
		orphanMinutes: byTask.find((row) => row.taskId === null)?.logged ?? 0,
		entries: described.map((entry) => repo.entryDto(entry, entryRights(access, user, entry.row))),
		today: todayInZone(access.settings.timeZone),
	};
}
