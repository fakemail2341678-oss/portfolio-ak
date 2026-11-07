import "@tanstack/react-start/server-only";
import { and, asc, eq, gte, inArray, isNull, lte, max, sql } from "drizzle-orm";
import type { AdminReports } from "@/features/taskline/admin/schema";
import { firstWeekOf, milestoneAtRisk, RANGE_WEEKS } from "@/features/taskline/reports/metrics";
import type { ReportRange } from "@/features/taskline/types";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { tlActivity, tlMember, tlMilestone, tlProject, tlStatus, tlTask, tlTimeEntry } from "@/server/db/schema";
import type { Services } from "@/server/services";
import { latestUpdates } from "../projects/updates";
import { team } from "./team";

/**
 * /admin/taskline/reports (Task 57, decision 0225; `taskline:read`): health across the
 * team's projects (progress, overdue, milestones at risk, last activity, the lead's
 * latest update), each member's workload against their capacity, and the time logged
 * over the weeks asked for, by project and by member. Totals only: the entries behind
 * them are `taskline:time`'s.
 */

/** Work counted against a week's capacity: open tasks due within this many days, or overdue. */
const WORKLOAD_DAYS = 7;

export async function getReports(
	{ db }: Pick<Services, "db">,
	{ range }: { range: ReportRange },
): Promise<AdminReports> {
	const { workspace, settings } = await team(db);
	const today = todayInZone(settings.timeZone);
	const from = firstWeekOf(today, RANGE_WEEKS[range], settings.weekStart);

	const projects = await db
		.select()
		.from(tlProject)
		.where(and(eq(tlProject.workspaceId, workspace.id), isNull(tlProject.archivedAt)))
		.orderBy(asc(tlProject.name), asc(tlProject.key));
	const ids = projects.map((project) => project.id);
	const people = await db
		.select()
		.from(tlMember)
		.where(eq(tlMember.workspaceId, workspace.id))
		.orderBy(asc(tlMember.displayName), asc(tlMember.id));
	const nameOf = new Map(people.map((person) => [person.id, person.displayName]));
	const open = sql`${tlTask.completedAt} is null`;

	const [perProject, milestones, milestoneOpen, activity, updates, workload, timeByProject, timeByMember] =
		await Promise.all([
			ids.length === 0
				? Promise.resolve([])
				: db
						.select({
							projectId: tlTask.projectId,
							total: sql<number>`count(*)`.mapWith(Number),
							done: sql<number>`count(*) filter (where ${tlStatus.category} = 'completed')`.mapWith(Number),
							canceled: sql<number>`count(*) filter (where ${tlStatus.category} = 'canceled')`.mapWith(Number),
							open: sql<number>`count(*) filter (where ${open})`.mapWith(Number),
							overdue: sql<number>`count(*) filter (where ${open} and ${tlTask.dueOn} < ${today})`.mapWith(Number),
						})
						.from(tlTask)
						.innerJoin(tlStatus, eq(tlStatus.id, tlTask.statusId))
						.where(and(inArray(tlTask.projectId, ids), isNull(tlTask.deletedAt)))
						.groupBy(tlTask.projectId),
			ids.length === 0
				? Promise.resolve([])
				: db
						.select({ id: tlMilestone.id, projectId: tlMilestone.projectId, dueOn: tlMilestone.dueOn })
						.from(tlMilestone)
						.where(and(inArray(tlMilestone.projectId, ids), isNull(tlMilestone.completedAt))),
			ids.length === 0
				? Promise.resolve([])
				: db
						.select({ milestoneId: tlTask.milestoneId, total: sql<number>`count(*)`.mapWith(Number) })
						.from(tlTask)
						.where(and(inArray(tlTask.projectId, ids), isNull(tlTask.deletedAt), open))
						.groupBy(tlTask.milestoneId),
			ids.length === 0
				? Promise.resolve([])
				: db
						.select({ projectId: tlActivity.projectId, at: max(tlActivity.at) })
						.from(tlActivity)
						.where(inArray(tlActivity.projectId, ids))
						.groupBy(tlActivity.projectId),
			latestUpdates(db, ids),
			ids.length === 0
				? Promise.resolve([])
				: db
						.select({
							assigneeId: tlTask.assigneeId,
							open: sql<number>`count(*)`.mapWith(Number),
							overdue: sql<number>`count(*) filter (where ${tlTask.dueOn} < ${today})`.mapWith(Number),
							estimateMinutes: sql<number>`coalesce(sum(${tlTask.estimateMinutes}), 0)`.mapWith(Number),
							dueSoonMinutes:
								sql<number>`coalesce(sum(${tlTask.estimateMinutes}) filter (where ${tlTask.dueOn} <= ${addDays(today, WORKLOAD_DAYS)}), 0)`.mapWith(
									Number,
								),
						})
						.from(tlTask)
						.where(and(inArray(tlTask.projectId, ids), isNull(tlTask.deletedAt), open))
						.groupBy(tlTask.assigneeId),
			db
				.select({
					id: tlTimeEntry.projectId,
					minutes: sql<number>`coalesce(sum(${tlTimeEntry.minutes}), 0)`.mapWith(Number),
					billableMinutes:
						sql<number>`coalesce(sum(${tlTimeEntry.minutes}) filter (where ${tlTimeEntry.billable}), 0)`.mapWith(
							Number,
						),
				})
				.from(tlTimeEntry)
				.where(
					and(eq(tlTimeEntry.workspaceId, workspace.id), gte(tlTimeEntry.onDay, from), lte(tlTimeEntry.onDay, today)),
				)
				.groupBy(tlTimeEntry.projectId),
			db
				.select({
					id: tlTimeEntry.memberId,
					minutes: sql<number>`coalesce(sum(${tlTimeEntry.minutes}), 0)`.mapWith(Number),
					billableMinutes:
						sql<number>`coalesce(sum(${tlTimeEntry.minutes}) filter (where ${tlTimeEntry.billable}), 0)`.mapWith(
							Number,
						),
				})
				.from(tlTimeEntry)
				.where(
					and(eq(tlTimeEntry.workspaceId, workspace.id), gte(tlTimeEntry.onDay, from), lte(tlTimeEntry.onDay, today)),
				)
				.groupBy(tlTimeEntry.memberId),
		]);

	const counts = new Map(perProject.map((row) => [row.projectId, row]));
	const openIn = new Map(milestoneOpen.map((row) => [row.milestoneId, row.total]));
	const lastActivity = new Map(activity.map((row) => [row.projectId, row.at]));
	const atRisk = new Map<string, number>();
	for (const milestone of milestones) {
		if (milestoneAtRisk({ dueOn: milestone.dueOn, open: openIn.get(milestone.id) ?? 0 }, today)) {
			atRisk.set(milestone.projectId, (atRisk.get(milestone.projectId) ?? 0) + 1);
		}
	}
	const byAssignee = new Map(workload.map((row) => [row.assigneeId, row]));
	// Time may be on an archived project, which the health table leaves out: read their names too.
	const timeProjectIds = timeByProject.map((row) => row.id).filter((id) => !ids.includes(id));
	const otherProjects = timeProjectIds.length
		? await db
				.select({ id: tlProject.id, key: tlProject.key, name: tlProject.name })
				.from(tlProject)
				.where(inArray(tlProject.id, timeProjectIds))
		: [];
	const projectOf = new Map([...projects, ...otherProjects].map((project) => [project.id, project]));
	const byMinutes = (a: { minutes: number }, b: { minutes: number }) => b.minutes - a.minutes;

	return {
		today,
		readAt: new Date().toISOString(),
		from,
		health: projects.map((project) => {
			const row = counts.get(project.id);
			const counted = (row?.total ?? 0) - (row?.canceled ?? 0);
			return {
				id: project.id,
				key: project.key,
				name: project.name,
				color: project.color,
				status: project.status,
				health: project.health,
				lead: project.leadId ? (nameOf.get(project.leadId) ?? null) : null,
				progress: counted > 0 ? (row?.done ?? 0) / counted : null,
				open: row?.open ?? 0,
				overdue: row?.overdue ?? 0,
				milestonesAtRisk: atRisk.get(project.id) ?? 0,
				lastActivityAt: lastActivity.get(project.id)?.toISOString() ?? null,
				update: updates.get(project.id) ?? null,
				targetOn: project.targetOn,
			};
		}),
		workload: people
			.filter((person) => person.deactivatedAt === null)
			.map((person) => ({
				memberId: person.id,
				name: person.displayName,
				capacityMinutes: person.capacityMinutesWeek,
				open: byAssignee.get(person.id)?.open ?? 0,
				overdue: byAssignee.get(person.id)?.overdue ?? 0,
				estimateMinutes: byAssignee.get(person.id)?.estimateMinutes ?? 0,
				dueSoonMinutes: byAssignee.get(person.id)?.dueSoonMinutes ?? 0,
			})),
		timeByProject: timeByProject
			.map((row) => ({
				...row,
				label: `${projectOf.get(row.id)?.key ?? ""} ${projectOf.get(row.id)?.name ?? ""}`.trim(),
			}))
			.sort(byMinutes),
		timeByMember: timeByMember.map((row) => ({ ...row, label: nameOf.get(row.id) ?? "" })).sort(byMinutes),
	};
}
