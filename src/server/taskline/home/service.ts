import "@tanstack/react-start/server-only";
import { endOfWeek } from "@/features/taskline/calendar/grid";
import { projectSettings } from "@/features/taskline/settings";
import type {
	ActiveSprint,
	MyTasks,
	NavProject,
	ProjectRole,
	TasklineNav,
	WorkspaceSummary,
} from "@/features/taskline/types";
import { todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import type { TlProjectRow } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { projectLevel, resolveWorkspace, type TasklineServices, type WorkspaceAccess } from "../access";
import * as projects from "../projects/repository";
import * as sprints from "../sprints/repository";
import { runningTimer } from "../time/rules";
import { listWorkspaces } from "../workspace/service";
import * as repo from "./repository";

/**
 * What spans the caller's workspaces (the team and their sandbox): the shell's
 * navigation and Home's open tasks. Each workspace goes through the resolver, and
 * only projects the caller may see (and that aren't archived) count.
 */

const RECENT_MAX = 5;
/** My work's tasks, across workspaces (assigned and watched together). */
const MY_TASKS_MAX = 200;

export type Visible = { access: WorkspaceAccess; summary: WorkspaceSummary; projects: TlProjectRow[] };

/** The projects of a resolved workspace the caller may see: the active ones, or (search, Task 51) the archived ones too. */
export async function visibleProjectRows(
	db: Db,
	access: WorkspaceAccess,
	{ archived }: { archived: boolean },
): Promise<TlProjectRow[]> {
	const rows = await projects.listProjectRows(db, access.workspace.id, { archived: false });
	if (archived) rows.push(...(await projects.listProjectRows(db, access.workspace.id, { archived: true })));
	const roles = access.member
		? await projects.rolesOf(
				db,
				access.member.id,
				rows.map((row) => row.id),
			)
		: new Map<string, ProjectRole>();
	return rows.filter((row) => projectLevel(access, row, roles.get(row.id) ?? null) !== "none");
}

/** Each of the caller's workspaces, with the projects they may see in it (the active ones unless `archived`). */
export async function visibleProjects(
	db: Db,
	services: TasklineServices,
	{ archived = false }: { archived?: boolean } = {},
): Promise<Visible[]> {
	const found: Visible[] = [];
	for (const summary of await listWorkspaces(services)) {
		const access = await resolveWorkspace(db, services.user, summary.segment);
		found.push({ access, summary, projects: await visibleProjectRows(db, access, { archived }) });
	}
	return found;
}

export const navProject = (row: TlProjectRow, summary: WorkspaceSummary): NavProject => ({
	id: row.id,
	key: row.key,
	name: row.name,
	color: row.color,
	ws: summary.segment,
	workspaceKind: summary.kind,
});

/**
 * The shell's navigation: the workspaces, their projects (by name), the starred ones, and the
 * projects the caller last worked on (their activity), topped up with the most
 * recently changed ones so a new member still sees where to start.
 */
export async function getNav(services: TasklineServices): Promise<TasklineNav> {
	const { db } = services;
	const visible = await visibleProjects(db, services);
	const starred: NavProject[] = [];
	const worked: Array<{ project: NavProject; at: Date }> = [];
	const others: Array<{ project: NavProject; at: Date }> = [];
	for (const { access, summary, projects: rows } of visible) {
		const ids = rows.map((row) => row.id);
		const byId = new Map(rows.map((row) => [row.id, row]));
		const memberId = access.member?.id ?? null;
		const stars = await projects.starsOf(db, memberId, ids);
		starred.push(...rows.filter((row) => stars.has(row.id)).map((row) => navProject(row, summary)));
		const recent = memberId ? await repo.recentProjectIds(db, memberId, ids, RECENT_MAX) : [];
		for (const { projectId, at } of recent) {
			const row = byId.get(projectId);
			if (row) worked.push({ project: navProject(row, summary), at });
		}
		const seen = new Set(recent.map((entry) => entry.projectId));
		others.push(
			...rows
				.filter((row) => !seen.has(row.id))
				.map((row) => ({ project: navProject(row, summary), at: row.updatedAt })),
		);
	}
	const byTime = (a: { at: Date }, b: { at: Date }) => b.at.getTime() - a.at.getTime();
	const recent = [...worked.sort(byTime), ...others.sort(byTime)].slice(0, RECENT_MAX).map((entry) => entry.project);
	return {
		workspaces: visible.map(({ summary, access }) => ({ ...summary, canCreateProject: access.canCreateProject })),
		projects: visible.flatMap(({ summary, projects: rows }) => rows.map((row) => navProject(row, summary))),
		starred,
		recent,
		timer: await runningTimer(db, services.user.id),
		readAt: new Date().toISOString(),
	};
}

/**
 * My work (Task 51): open tasks assigned to the caller or watched by them, in every
 * workspace, soonest due first. Today and the week's last day come from the first
 * workspace's calendar (the team's, when they're on it), so the page groups them the
 * way the team counts weeks.
 */
export async function listMyTasks(services: TasklineServices): Promise<MyTasks> {
	const { db } = services;
	const visible = await visibleProjects(db, services);
	const tasks: MyTasks["tasks"] = [];
	let calendar: { timeZone: string; weekStart: number } | undefined;
	for (const { access, summary, projects: rows } of visible) {
		calendar ??= access.settings;
		if (!access.member) continue;
		const byId = new Map(rows.map((row) => [row.id, row]));
		const found = await repo.openTasksOf(
			db,
			access.member.id,
			rows.map((row) => row.id),
			MY_TASKS_MAX,
		);
		for (const row of found) {
			const project = byId.get(row.projectId);
			if (!project) continue;
			tasks.push({
				id: row.id,
				ref: `${project.key}-${row.number}`,
				title: row.title,
				type: row.type,
				priority: row.priority,
				dueOn: row.dueOn,
				status: { name: row.statusName, category: row.statusCategory, color: row.statusColor },
				project: navProject(project, summary),
				assigned: row.assigned,
				watching: row.watching,
			});
		}
	}
	// Across workspaces: by due date (undated last), then priority.
	tasks.sort(
		(a, b) =>
			(a.dueOn ?? "9999-99-99").localeCompare(b.dueOn ?? "9999-99-99") ||
			b.priority - a.priority ||
			a.ref.localeCompare(b.ref),
	);
	const today = todayInZone(calendar?.timeZone ?? APP_TIME_ZONE);
	return {
		tasks: tasks.slice(0, MY_TASKS_MAX),
		today,
		weekEnd: endOfWeek(today, calendar?.weekStart ?? 0),
		sprints: await activeSprints(db, visible),
	};
}

/** The active sprints of projects the caller may see (Task 52), soonest ending first, with their totals. */
export async function activeSprints(
	db: Db,
	visible: ReadonlyArray<Pick<Visible, "summary" | "projects">>,
): Promise<ActiveSprint[]> {
	const byId = new Map(
		visible.flatMap(({ summary, projects: rows }) => rows.map((row) => [row.id, { row, summary }] as const)),
	);
	const rows = await sprints.activeSprintsOf(db, [...byId.keys()]);
	const totals = await sprints.totalsOf(
		db,
		rows.map((row) => row.id),
	);
	return rows.flatMap((sprint) => {
		const project = byId.get(sprint.projectId);
		const sum = totals.get(sprint.id);
		if (!project || !sum) return [];
		return [
			{
				id: sprint.id,
				name: sprint.name,
				project: navProject(project.row, project.summary),
				startOn: sprint.startOn,
				endOn: sprint.endOn,
				totals: sum,
				estimation: projectSettings.parse(project.row.settings).estimation,
			},
		];
	});
}
