import "@tanstack/react-start/server-only";
import { and, asc, eq, gte, isNull, lte, type SQL, sql } from "drizzle-orm";
import type { ProjectExport } from "@/features/taskline/admin/schema";
import {
	type AdminTimeOptions,
	type AdminTimePage,
	type AdminUpdateTimeEntryInput,
	type AdminUtilization,
	TIME_EXPORT_MAX,
} from "@/features/taskline/admin/schema";
import type { AdminTimeListInput } from "@/features/taskline/admin/search";
import type { StoredWorkspaceSettings } from "@/features/taskline/settings";
import { capacityFor } from "@/features/taskline/time/sheet";
import type { TimeEntry } from "@/features/taskline/types";
import { toCsv } from "@/lib/csv";
import { ruleError } from "@/lib/errors";
import { addDays, todayInZone, weekdayOf } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import { listPage, notFound, withAudit } from "@/server/db/crud";
import { allOf, textSearch } from "@/server/db/list";
import { type TlTimeEntryRow, tlMember, tlProject, tlTimeEntry, tlWorkspace } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { Services } from "@/server/services";
import { fieldError } from "../rules";
import * as time from "../time/repository";
import { isLocked, lockedError } from "../time/rules";
import * as members from "../workspace/repository";
import { bumpRevs, type Team, team } from "./team";

/**
 * /admin/taskline/timesheets (PLAN 11.5; decision 0218), `taskline:time`: every
 * member's time in the team, filtered; any entry changed or deleted (audited); the
 * lock date, on or before which nobody changes time; utilization against capacity;
 * and the entries as CSV. Sandboxes are their owners' and never show here.
 */

const isId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function whereOf(workspaceId: string, input: AdminTimeListInput): SQL | undefined {
	return allOf(
		eq(tlTimeEntry.workspaceId, workspaceId),
		isId(input.member) ? eq(tlTimeEntry.memberId, input.member) : undefined,
		isId(input.project) ? eq(tlTimeEntry.projectId, input.project) : undefined,
		input.billable === "all" ? undefined : eq(tlTimeEntry.billable, input.billable === "billable"),
		input.from ? gte(tlTimeEntry.onDay, input.from) : undefined,
		input.to ? lte(tlTimeEntry.onDay, input.to) : undefined,
		textSearch(input.q, [tlTimeEntry.note]),
	);
}

/** An entry as the admin sees it: changeable unless locked or still running. */
const adminDto = (settings: Team["settings"], entry: time.DescribedEntry): TimeEntry => {
	const locked = isLocked(settings, entry.row.onDay);
	const running = entry.row.startedAt !== null && entry.row.endedAt === null;
	return time.entryDto(entry, { locked, canEdit: !locked && !running });
};

export async function list({ db }: Pick<Services, "db">, input: AdminTimeListInput): Promise<AdminTimePage> {
	const { workspace, settings } = await team(db);
	const where = whereOf(workspace.id, input);
	const [page, [sums]] = await Promise.all([
		listPage(db, tlTimeEntry, {
			input,
			where,
			sort: { columns: { day: tlTimeEntry.onDay, minutes: tlTimeEntry.minutes }, fallback: "day" },
			map: async (rows) => (await time.describe(db, rows)).map((entry) => adminDto(settings, entry)),
		}),
		db
			.select({
				total: sql<number>`coalesce(sum(${tlTimeEntry.minutes}), 0)`.mapWith(Number),
				billable: sql<number>`coalesce(sum(${tlTimeEntry.minutes}) filter (where ${tlTimeEntry.billable}), 0)`.mapWith(
					Number,
				),
			})
			.from(tlTimeEntry)
			.where(where),
	]);
	return { ...page, totalMinutes: sums?.total ?? 0, billableMinutes: sums?.billable ?? 0 };
}

export async function options({ db }: Pick<Services, "db">): Promise<AdminTimeOptions> {
	const { workspace, settings } = await team(db);
	const [projects, memberRows] = await Promise.all([
		db
			.select({ id: tlProject.id, key: tlProject.key, name: tlProject.name })
			.from(tlProject)
			.where(eq(tlProject.workspaceId, workspace.id))
			.orderBy(asc(tlProject.key)),
		members.listMembers(db, workspace.id, { deactivated: true }),
	]);
	return {
		projects,
		members: memberRows.map((member) => ({ id: member.id, name: member.displayName })),
		lockOn: settings.timesheetLockOn,
		today: todayInZone(settings.timeZone),
		weekStart: settings.weekStart,
	};
}

async function teamEntry(db: Db, workspaceId: string, id: string): Promise<TlTimeEntryRow> {
	const row = await time.getEntry(db, workspaceId, id);
	if (!row) throw notFound("Time entry");
	return row;
}

/** A refused change: a locked day (before or after), or a running timer. */
function assertChangeable(settings: Team["settings"], row: TlTimeEntryRow, onDay = row.onDay) {
	const lockOn = settings.timesheetLockOn;
	if (lockOn && (isLocked(settings, row.onDay) || isLocked(settings, onDay))) throw lockedError(lockOn);
	if (row.startedAt !== null && row.endedAt === null) {
		throw ruleError("CONFLICT", "Taskline: timer running", m.taskline_time_error_edit_running());
	}
}

const entryTarget = (row: TlTimeEntryRow, name: string) => ({
	type: "taskline-time-entry" as const,
	id: row.id,
	label: `${name} · ${row.onDay}`,
});

/** Any member's entry: its day, length, note, billable (audited). */
export async function update(
	{ db, actor }: Services,
	{ id, ...fields }: AdminUpdateTimeEntryInput,
): Promise<TimeEntry> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace, settings } = await team(tx);
		const before = await teamEntry(tx, workspace.id, id);
		assertChangeable(settings, before, fields.onDay);
		const after = await time.patchEntry(tx, id, fields);
		const [described] = await time.describe(tx, [after]);
		if (!described) throw notFound("Time entry");
		const changed = (["onDay", "minutes", "note", "billable"] as const).filter((key) => before[key] !== after[key]);
		if (changed.length > 0) {
			audit({
				action: "taskline.time.update",
				target: entryTarget(after, described.memberName),
				before: Object.fromEntries(changed.map((key) => [key, before[key]])),
				after: Object.fromEntries(changed.map((key) => [key, after[key]])),
			});
			await bumpRevs(tx, [after.projectId]);
		}
		return adminDto(settings, described);
	});
}

export async function remove({ db, actor }: Services, id: string): Promise<void> {
	await withAudit(db, actor, async (tx, audit) => {
		const { workspace, settings } = await team(tx);
		const row = await teamEntry(tx, workspace.id, id);
		const lockOn = settings.timesheetLockOn;
		if (lockOn && isLocked(settings, row.onDay)) throw lockedError(lockOn);
		const [described] = await time.describe(tx, [row]);
		await time.deleteEntries(tx, [row.id]);
		audit({
			action: "taskline.time.delete",
			target: entryTarget(row, described?.memberName ?? ""),
			before: { onDay: row.onDay, minutes: row.minutes },
		});
		await bumpRevs(tx, [row.projectId]);
	});
}

/**
 * Sets the lock date (null: nothing locked). Only that setting changes: the settings
 * form's version stays, so a settings page open meanwhile still saves.
 */
export async function setLock({ db, actor }: Services, lockOn: string | null): Promise<{ lockOn: string | null }> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace, settings } = await team(tx);
		if (lockOn && lockOn > todayInZone(settings.timeZone)) {
			throw fieldError("BAD_REQUEST", "lockOn", m.taskline_admin_time_error_lock_future());
		}
		if (settings.timesheetLockOn === lockOn) return { lockOn };
		const stored: StoredWorkspaceSettings = { ...workspace.settings, timesheetLockOn: lockOn };
		await tx
			.update(tlWorkspace)
			.set({ settings: stored, updatedAt: sql`${tlWorkspace.updatedAt}` })
			.where(eq(tlWorkspace.id, workspace.id));
		audit({
			action: "taskline.time.lock",
			target: { type: "taskline-workspace", id: workspace.id, label: workspace.name },
			before: { lockOn: settings.timesheetLockOn },
			after: { lockOn },
		});
		return { lockOn };
	});
}

/** Each active member's time from `from` to `to`, against their weekly capacity spread over the working days in it. */
export async function utilization(
	{ db }: Pick<Services, "db">,
	{ from, to }: { from: string; to: string },
): Promise<AdminUtilization> {
	const { workspace, settings } = await team(db);
	const [memberRows, sums] = await Promise.all([
		db
			.select()
			.from(tlMember)
			.where(and(eq(tlMember.workspaceId, workspace.id), isNull(tlMember.deactivatedAt)))
			.orderBy(asc(tlMember.displayName)),
		db
			.select({
				memberId: tlTimeEntry.memberId,
				logged: sql<number>`sum(${tlTimeEntry.minutes})`.mapWith(Number),
				billable: sql<number>`coalesce(sum(${tlTimeEntry.minutes}) filter (where ${tlTimeEntry.billable}), 0)`.mapWith(
					Number,
				),
			})
			.from(tlTimeEntry)
			.where(and(eq(tlTimeEntry.workspaceId, workspace.id), gte(tlTimeEntry.onDay, from), lte(tlTimeEntry.onDay, to)))
			.groupBy(tlTimeEntry.memberId),
	]);
	const weekdays: number[] = [];
	for (let day = from; day <= to && weekdays.length < 400; day = addDays(day, 1)) weekdays.push(weekdayOf(day));
	const sumOf = new Map(sums.map((row) => [row.memberId, row]));
	return {
		from,
		to,
		rows: memberRows.map((member) => ({
			memberId: member.id,
			name: member.displayName,
			capacityMinutes: capacityFor(member.capacityMinutesWeek, weekdays, settings.workingDays),
			loggedMinutes: sumOf.get(member.id)?.logged ?? 0,
			billableMinutes: sumOf.get(member.id)?.billable ?? 0,
		})),
	};
}

/** The filtered entries as CSV (at most TIME_EXPORT_MAX, newest day first). */
export async function exportCsv({ db }: Pick<Services, "db">, input: AdminTimeListInput): Promise<ProjectExport> {
	const { workspace } = await team(db);
	const rows = await time.latestEntries(db, whereOf(workspace.id, input), TIME_EXPORT_MAX);
	const described = await time.describe(db, rows);
	const stamp = new Date().toISOString().slice(0, 10);
	return {
		filename: `taskline-time-${stamp}.csv`,
		type: "text/csv",
		content: toCsv(described, [
			{ header: "day", value: (entry) => entry.row.onDay },
			{ header: "member", value: (entry) => entry.memberName },
			{ header: "project", value: (entry) => entry.project.key },
			{
				header: "task",
				value: (entry) => (entry.task ? `${entry.project.key}-${entry.task.number}` : ""),
			},
			{ header: "title", value: (entry) => entry.task?.title ?? "" },
			{ header: "minutes", value: (entry) => entry.row.minutes },
			{ header: "hours", value: (entry) => Math.round((entry.row.minutes / 60) * 100) / 100 },
			{ header: "billable", value: (entry) => entry.row.billable },
			{ header: "note", value: (entry) => entry.row.note },
		]),
	};
}
