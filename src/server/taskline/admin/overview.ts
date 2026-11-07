import "@tanstack/react-start/server-only";
import { and, count, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { AdminOverview, AdminWeekCount } from "@/features/taskline/admin/schema";
import { addDays, startOfDayInZone, todayInZone, weekdayOf } from "@/lib/i18n/date-only";
import { tlInvitation, tlMember, tlProject, tlTask, tlTimeEntry, tlWorkspace, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { Services } from "@/server/services";
import { activeSprints } from "../home/service";
import { latestUpdates } from "../projects/updates";
import { team } from "./team";

/**
 * /admin/taskline (PLAN 11.5): the team's numbers. Weeks start on the workspace's
 * week start and days are its time zone's; sandboxes show as counts only.
 */

export const OVERVIEW_WEEKS = 12;

/** The first day of the week `day` is in. */
export const weekOf = (day: string, weekStart: number) => addDays(day, -((weekdayOf(day) - weekStart + 7) % 7));

/** Per local day, how many rows have `column` on it, from `since`. */
async function perDay(db: Db, workspaceId: string, column: AnyPgColumn, since: Date, timeZone: string) {
	const day = sql<string>`to_char(${column} at time zone ${timeZone}, 'YYYY-MM-DD')`;
	return (
		db
			.select({ day, total: count() })
			.from(tlTask)
			.where(and(eq(tlTask.workspaceId, workspaceId), isNull(tlTask.deletedAt), gte(column, since)))
			// By position: every value in a `sql` template is its own parameter, so the expression would not match (apps.md).
			.groupBy(sql`1`)
	);
}

/** The weeks from `first`, each with the tasks created and completed in it. */
export function bucketWeeks(
	first: string,
	weeks: number,
	weekStart: number,
	created: ReadonlyArray<{ day: string; total: number }>,
	completed: ReadonlyArray<{ day: string; total: number }>,
): AdminWeekCount[] {
	const buckets = Array.from({ length: weeks }, (_, index) => ({
		week: addDays(first, index * 7),
		created: 0,
		completed: 0,
	}));
	const add = (rows: ReadonlyArray<{ day: string; total: number }>, key: "created" | "completed") => {
		for (const row of rows) {
			const bucket = buckets.find((each) => each.week === weekOf(row.day, weekStart));
			if (bucket) bucket[key] += row.total;
		}
	};
	add(created, "created");
	add(completed, "completed");
	return buckets;
}

export async function getOverview({ db }: Pick<Services, "db">): Promise<AdminOverview> {
	const { workspace, settings } = await team(db);
	const today = todayInZone(settings.timeZone);
	const thisWeek = weekOf(today, settings.weekStart);
	const first = addDays(thisWeek, -7 * (OVERVIEW_WEEKS - 1));
	const since = startOfDayInZone(first, settings.timeZone) ?? new Date(0);
	const weekStarted = startOfDayInZone(thisWeek, settings.timeZone) ?? new Date(0);

	const live = and(eq(tlTask.workspaceId, workspace.id), isNull(tlTask.deletedAt));
	const projects = await db
		.select()
		.from(tlProject)
		.where(and(eq(tlProject.workspaceId, workspace.id), isNull(tlProject.archivedAt)))
		.orderBy(tlProject.name, tlProject.key);
	const ids = projects.map((project) => project.id);

	const [perProject, [done], created, completed, leads, sandboxRows, [sandboxProjects], [sandboxTasks], members] =
		await Promise.all([
			ids.length === 0
				? Promise.resolve([])
				: db
						.select({
							projectId: tlTask.projectId,
							open: sql<number>`count(*) filter (where ${tlTask.completedAt} is null)`.mapWith(Number),
							overdue:
								sql<number>`count(*) filter (where ${tlTask.completedAt} is null and ${tlTask.dueOn} < ${today})`.mapWith(
									Number,
								),
							done: sql<number>`count(*) filter (where ${tlTask.completedAt} is not null)`.mapWith(Number),
						})
						.from(tlTask)
						.where(and(live, inArray(tlTask.projectId, ids)))
						.groupBy(tlTask.projectId),
			db
				.select({ total: count() })
				.from(tlTask)
				.where(and(live, isNotNull(tlTask.completedAt), gte(tlTask.completedAt, weekStarted))),
			perDay(db, workspace.id, tlTask.createdAt, since, settings.timeZone),
			perDay(db, workspace.id, tlTask.completedAt, since, settings.timeZone),
			db
				.select({ id: tlMember.id, name: tlMember.displayName })
				.from(tlMember)
				.where(eq(tlMember.workspaceId, workspace.id)),
			db
				.select({ guest: user.isAnonymous, total: count() })
				.from(tlWorkspace)
				.innerJoin(user, eq(user.id, tlWorkspace.ownerId))
				.where(eq(tlWorkspace.kind, "sandbox"))
				.groupBy(user.isAnonymous),
			db
				.select({ total: count() })
				.from(tlProject)
				.innerJoin(tlWorkspace, eq(tlWorkspace.id, tlProject.workspaceId))
				.where(eq(tlWorkspace.kind, "sandbox")),
			db
				.select({ total: count() })
				.from(tlTask)
				.innerJoin(tlWorkspace, eq(tlWorkspace.id, tlTask.workspaceId))
				.where(eq(tlWorkspace.kind, "sandbox")),
			Promise.all([
				db
					.select({ total: count() })
					.from(tlMember)
					.where(and(eq(tlMember.workspaceId, workspace.id), isNull(tlMember.deactivatedAt))),
				db
					.select({ total: count() })
					.from(tlInvitation)
					.where(
						and(
							eq(tlInvitation.workspaceId, workspace.id),
							isNull(tlInvitation.acceptedAt),
							isNull(tlInvitation.revokedAt),
							gte(tlInvitation.expiresAt, new Date()),
						),
					),
			]),
		]);

	const counts = new Map(perProject.map((row) => [row.projectId, row]));
	const leadName = new Map(leads.map((row) => [row.id, row.name]));
	const active = projects.filter((project) => project.status === "active");
	const sum = (key: "open" | "overdue") => perProject.reduce((total, row) => total + row[key], 0);
	const sandboxTotal = sandboxRows.reduce((total, row) => total + row.total, 0);
	const [[activeMembers], [invited]] = members;
	// Task 53: the team's time this week (the timesheets page has the rest).
	const [logged] = await db
		.select({ total: sql<number>`coalesce(sum(${tlTimeEntry.minutes}), 0)`.mapWith(Number) })
		.from(tlTimeEntry)
		.where(and(eq(tlTimeEntry.workspaceId, workspace.id), gte(tlTimeEntry.onDay, thisWeek)));
	const updates = await latestUpdates(db, ids);
	return {
		stats: {
			activeProjects: active.length,
			openTasks: sum("open"),
			overdueTasks: sum("overdue"),
			doneThisWeek: done?.total ?? 0,
		},
		weeks: bucketWeeks(first, OVERVIEW_WEEKS, settings.weekStart, created, completed),
		projects: projects.map((project) => ({
			id: project.id,
			key: project.key,
			name: project.name,
			color: project.color,
			status: project.status,
			health: project.health,
			lead: project.leadId ? (leadName.get(project.leadId) ?? null) : null,
			open: counts.get(project.id)?.open ?? 0,
			overdue: counts.get(project.id)?.overdue ?? 0,
			done: counts.get(project.id)?.done ?? 0,
			targetOn: project.targetOn,
			updatedOn: updates.get(project.id)?.at ?? null,
		})),
		sandboxes: {
			total: sandboxTotal,
			guests: sandboxRows.find((row) => row.guest === true)?.total ?? 0,
			projects: sandboxProjects?.total ?? 0,
			tasks: sandboxTasks?.total ?? 0,
		},
		members: { active: activeMembers?.total ?? 0, invited: invited?.total ?? 0, loggedThisWeek: logged?.total ?? 0 },
		today,
		sprints: await activeSprints(db, [
			{
				summary: {
					id: workspace.id,
					kind: workspace.kind,
					slug: workspace.slug,
					name: workspace.name,
					segment: workspace.slug,
				},
				projects,
			},
		]),
	};
}
