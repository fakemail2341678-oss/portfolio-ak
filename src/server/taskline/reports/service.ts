import "@tanstack/react-start/server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
	firstWeekOf,
	percentile,
	RANGE_WEEKS,
	type StatusMove,
	taskDurations,
	weeklySeries,
	workloadRows,
} from "@/features/taskline/reports/metrics";
import { projectSettings } from "@/features/taskline/settings";
import {
	isClosedCategory,
	type ProjectReports,
	type ReportCycleTask,
	type ReportRange,
	TASK_PRIORITIES,
} from "@/features/taskline/types";
import { startOfDayInZone, todayInZone } from "@/lib/i18n/date-only";
import { tlActivity, tlTask } from "@/server/db/schema";
import { resolveProject, type TasklineServices } from "../access";
import { getProjectTime } from "../time/service";
import * as workflow from "../workflow/repository";
import * as members from "../workspace/repository";

/**
 * A project's reports (Task 57, decision 0225): read for anyone who can see the project.
 * Cycle and lead times come from the activity's status changes; everything is computed
 * here from the project's live tasks, as the board reads them. The numbers are the
 * workspace's weeks and days.
 */

/** The newest completed tasks the cycle report lists and reads the history of. */
const CYCLE_TASKS_MAX = 1000;

export async function getProjectReports(
	services: TasklineServices,
	{ ws, key, range }: { ws: string; key: string; range: ReportRange },
): Promise<ProjectReports> {
	const { db, user } = services;
	const access = await resolveProject(db, user, ws, key);
	const { project, settings, workspace } = access;
	const { timeZone, weekStart } = settings;
	const today = todayInZone(timeZone);
	const weeks = RANGE_WEEKS[range];
	const first = firstWeekOf(today, weeks, weekStart);
	const dayOf = (date: Date | null) => (date ? todayInZone(timeZone, date) : null);

	const [statuses, people, rows] = await Promise.all([
		workflow.listStatuses(db, project.id),
		members.listMembers(db, workspace.id, { deactivated: true }),
		db
			.select({
				id: tlTask.id,
				number: tlTask.number,
				title: tlTask.title,
				statusId: tlTask.statusId,
				priority: tlTask.priority,
				assigneeId: tlTask.assigneeId,
				dueOn: tlTask.dueOn,
				estimateMinutes: tlTask.estimateMinutes,
				points: tlTask.points,
				createdAt: tlTask.createdAt,
				completedAt: tlTask.completedAt,
			})
			.from(tlTask)
			.where(and(eq(tlTask.projectId, project.id), isNull(tlTask.deletedAt)))
			.orderBy(asc(tlTask.number)),
	]);

	const categoryOf = new Map(statuses.map((status) => [status.id, status.category]));
	const isCompleted = (statusId: string) => categoryOf.get(statusId) === "completed";
	const nameOf = new Map(people.map((person) => [person.id, person.displayName]));

	const since = startOfDayInZone(first, timeZone) ?? new Date(0);
	const completed = rows
		.filter((row) => row.completedAt && row.completedAt >= since && isCompleted(row.statusId))
		.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
		.slice(0, CYCLE_TASKS_MAX);
	const moves = completed.length
		? await db
				.select({ taskId: tlActivity.taskId, at: tlActivity.at, data: tlActivity.data })
				.from(tlActivity)
				.where(
					and(
						eq(tlActivity.projectId, project.id),
						eq(tlActivity.kind, "task.moved"),
						inArray(
							tlActivity.taskId,
							completed.map((row) => row.id),
						),
					),
				)
				.orderBy(asc(tlActivity.at))
		: [];
	const movesOf = new Map<string, StatusMove[]>();
	for (const move of moves) {
		if (!move.taskId) continue;
		const list = movesOf.get(move.taskId) ?? [];
		list.push({ at: move.at, from: String(move.data.from ?? ""), to: String(move.data.to ?? "") });
		movesOf.set(move.taskId, list);
	}
	const cycleTasks = completed.flatMap((row): ReportCycleTask[] => {
		const completedOn = dayOf(row.completedAt);
		if (!row.completedAt || !completedOn) return [];
		return [
			{
				ref: `${project.key}-${row.number}`,
				title: row.title,
				completedOn,
				...taskDurations(
					{ createdAt: row.createdAt, completedAt: row.completedAt },
					movesOf.get(row.id) ?? [],
					(statusId) => categoryOf.get(statusId),
				),
			},
		];
	});
	const cycleDays = cycleTasks.flatMap((task) => (task.cycleDays === null ? [] : [task.cycleDays]));

	// When the project tracks time: the time page's numbers.
	const time = projectSettings.parse(project.settings).time ? await getProjectTime(services, ws, key) : null;
	const open = rows.filter((row) => row.completedAt === null);
	return {
		today,
		statuses: statuses.map((status) => ({
			statusId: status.id,
			name: status.name,
			color: status.color,
			category: status.category,
			count: rows.filter((row) => row.statusId === status.id).length,
		})),
		priorities: TASK_PRIORITIES.map((priority) => ({
			priority,
			count: open.filter((row) => row.priority === priority).length,
		})),
		weeks: weeklySeries(
			rows.map((row) => {
				const category = categoryOf.get(row.statusId);
				const closed = category !== undefined && isClosedCategory(category);
				return {
					createdOn: dayOf(row.createdAt) ?? today,
					completedOn: isCompleted(row.statusId) ? dayOf(row.completedAt) : null,
					closedOn: closed ? dayOf(row.completedAt) : null,
					dueOn: row.dueOn,
				};
			}),
			{ first, weeks, today },
		),
		cycle: {
			medianLeadDays: percentile(
				cycleTasks.map((task) => task.leadDays),
				0.5,
			),
			medianCycleDays: percentile(cycleDays, 0.5),
			p85CycleDays: percentile(cycleDays, 0.85),
			tasks: cycleTasks,
		},
		workload: workloadRows(open, (memberId) => nameOf.get(memberId) ?? null, today),
		time: time ? { totals: time.totals, members: time.members, tasks: time.tasks } : null,
	};
}
