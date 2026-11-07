import "@tanstack/react-start/server-only";
import { parseTaskRef } from "@/features/taskline/schema";
import { SEARCH_PAGE_SIZE } from "@/features/taskline/search";
import type { FoundTask, TaskSearchPage } from "@/features/taskline/types";
import type { TlProjectRow } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { resolveWorkspace, type TasklineServices } from "../access";
import { navProject, visibleProjectRows, visibleProjects } from "../home/service";
import { taskRef } from "../tasks/repository";
import { listWorkspaces } from "../workspace/service";
import * as repo from "./repository";

/**
 * Finding tasks (Task 51, docs/guides/taskline.md, "Finding things"): the search page
 * looks in one workspace, the palette in every workspace of the caller's. Both search
 * only projects the caller may see (archived ones too, outside the trash), through
 * the resolver: nothing else is ever matched, counted or named.
 */

/** The palette's results: the best few across the caller's workspaces. */
const PALETTE_RESULTS = 8;

type Where = { project: TlProjectRow; ws: string; workspaceKind: "team" | "sandbox" };

const found = (row: repo.FoundRow, where: Where, summary: Parameters<typeof navProject>[1]): FoundTask => ({
	id: row.id,
	ref: taskRef(where.project.key, row.number),
	title: row.title,
	type: row.type,
	priority: row.priority,
	status: { name: row.statusName, category: row.statusCategory, color: row.statusColor },
	project: navProject(where.project, summary),
	excerpt: row.excerpt,
	closed: row.closed,
});

/** The task `q` names exactly ("WEB-12", "web-12") in one of `projects`, with its project, or null. */
async function exactRef(db: Db, q: string, projects: ReadonlyArray<TlProjectRow>) {
	const ref = parseTaskRef(q.trim().toUpperCase());
	const project = ref ? projects.find((row) => row.key === ref.key) : undefined;
	const row = ref && project ? await repo.taskByNumber(db, project.id, ref.number) : null;
	return row && project ? { row, project } : null;
}

/** /$ws/search: a page of the workspace's matching tasks, and the task an exact reference names. */
export async function searchTasks(
	services: TasklineServices,
	input: { ws: string; q: string; page: number },
): Promise<TaskSearchPage> {
	const { db, user } = services;
	const access = await resolveWorkspace(db, user, input.ws);
	const projects = await visibleProjectRows(db, access, { archived: true });
	const summary = (await listWorkspaces(services)).find((each) => each.id === access.workspace.id);
	const exact = await exactRef(db, input.q, projects);
	const jump = exact ? taskRef(exact.project.key, exact.row.number) : null;
	const query = repo.prefixQuery(input.q);
	const empty = { items: [], total: 0, page: input.page, pageSize: SEARCH_PAGE_SIZE, jump };
	if (!query || !summary) return empty;
	const byId = new Map(projects.map((project) => [project.id, project]));
	const { rows, total } = await repo.searchTasks(db, [...byId.keys()], query, {
		limit: SEARCH_PAGE_SIZE,
		offset: (input.page - 1) * SEARCH_PAGE_SIZE,
	});
	const items = rows.flatMap((row) => {
		const project = byId.get(row.projectId);
		return project ? [found(row, { project, ws: summary.segment, workspaceKind: summary.kind }, summary)] : [];
	});
	return { items, total, page: input.page, pageSize: SEARCH_PAGE_SIZE, jump };
}

/** The palette: the best few matching tasks in every workspace of the caller's, an exact reference first. */
export async function findTasks(services: TasklineServices, input: { q: string }): Promise<FoundTask[]> {
	const { db } = services;
	const query = repo.prefixQuery(input.q);
	const exacts: FoundTask[] = [];
	const results: FoundTask[] = [];
	for (const { summary, projects } of await visibleProjects(db, services, { archived: true })) {
		const where = (project: TlProjectRow): Where => ({ project, ws: summary.segment, workspaceKind: summary.kind });
		const exact = await exactRef(db, input.q, projects);
		if (exact) exacts.push(found(exact.row, where(exact.project), summary));
		if (!query) continue;
		const byId = new Map(projects.map((project) => [project.id, project]));
		const { rows } = await repo.searchTasks(db, [...byId.keys()], query, { limit: PALETTE_RESULTS, offset: 0 });
		for (const row of rows) {
			const project = byId.get(row.projectId);
			if (project) results.push(found(row, where(project), summary));
		}
	}
	const seen = new Set(exacts.map((task) => task.id));
	return [...exacts, ...results.filter((task) => !seen.has(task.id))].slice(0, PALETTE_RESULTS);
}
