import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import { TASK_TIME_ENTRIES } from "@/features/taskline/schema";
import { projectSettings } from "@/features/taskline/settings";
import type { RunningTimer, TaskTime } from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { isoDateInstant, todayInZone } from "@/lib/i18n/date-only";
import { formatDate } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { type TlTimeEntryRow, tlTimeEntry } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { ProjectAccess, TasklineUser, WorkspaceAccess } from "../access";
import { fieldError } from "../rules";
import { taskRef } from "../tasks/repository";
import * as repo from "./repository";

/**
 * Who may change time, and when (decision 0218), shared by the time service and the
 * task's page (which can't import the time service: it imports the tasks service).
 *
 * - An entry is its member's: they change it while they may edit the project. In the
 *   team, `taskline:time` changes anyone's (here in projects they may edit, or in the admin).
 * - Nobody changes an entry on or before the workspace's lock date, `taskline:time` included
 *   (they move the date instead).
 * - Time goes on today or a day before it, never after.
 * - A running timer isn't edited: it's stopped (or discarded).
 */

export const isLocked = (settings: WorkspaceAccess["settings"], day: string) =>
	settings.timesheetLockOn !== null && day <= settings.timesheetLockOn;

/** Holds `taskline:time` in the team: every member's time is theirs to change. */
export const isTimeAdmin = (access: Pick<WorkspaceAccess, "workspace">, user: TasklineUser) =>
	access.workspace.kind === "team" && user.permissions.includes("taskline:time");

export const lockedError = (lockOn: string) =>
	ruleError(
		"FORBIDDEN",
		"Taskline: time locked",
		m.taskline_time_error_locked({ date: formatDate(isoDateInstant(lockOn), { dateStyle: "medium" }) }),
	);

/** A day time can go on: not locked, not after today (a field error on `onDay`). */
export function assertOpenDay(access: WorkspaceAccess, day: string): void {
	if (isLocked(access.settings, day) && access.settings.timesheetLockOn) {
		throw lockedError(access.settings.timesheetLockOn);
	}
	if (day > todayInZone(access.settings.timeZone)) {
		throw fieldError("BAD_REQUEST", "onDay", m.taskline_time_error_future());
	}
}

/** What the caller may do with an entry, in a project whose access they resolved. */
export function entryRights(access: ProjectAccess, user: TasklineUser, row: TlTimeEntryRow) {
	const locked = isLocked(access.settings, row.onDay);
	const running = row.startedAt !== null && row.endedAt === null;
	const own = access.member !== null && access.member.id === row.memberId;
	return { locked, canEdit: !locked && !running && access.can.logTime && (own || isTimeAdmin(access, user)) };
}

/** The time on a task as its page shows it: totals, the newest entries, and whether the caller may log. */
export async function taskTime(db: Db, access: ProjectAccess, user: TasklineUser, taskId: string): Promise<TaskTime> {
	const [totals, rows] = await Promise.all([
		repo.taskTotals(db, taskId),
		repo.latestEntries(db, eq(tlTimeEntry.taskId, taskId), TASK_TIME_ENTRIES),
	]);
	const described = await repo.describe(db, rows);
	return {
		loggedMinutes: totals.logged,
		billableMinutes: totals.billable,
		entries: described.map((entry) => repo.entryDto(entry, entryRights(access, user, entry.row))),
		canLog: access.can.logTime && access.member !== null,
		lockOn: access.settings.timesheetLockOn,
		today: todayInZone(access.settings.timeZone),
		enabled: projectSettings.parse(access.project.settings).time,
	};
}

/** The caller's running timer as the topbar shows it, or null. */
export async function runningTimer(db: Db, userId: string): Promise<RunningTimer | null> {
	const [found] = await repo.runningOfUser(db, userId);
	if (!found?.entry.startedAt) return null;
	const [described] = await repo.describe(db, [found.entry]);
	if (!described) return null;
	return {
		id: found.entry.id,
		ws: found.workspace.kind === "sandbox" ? "sandbox" : found.workspace.slug,
		workspaceKind: found.workspace.kind,
		projectKey: described.project.key,
		ref: described.task ? taskRef(described.project.key, described.task.number) : null,
		title: described.task?.title ?? described.project.name,
		startedAt: found.entry.startedAt.toISOString(),
	};
}
