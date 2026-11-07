import "@tanstack/react-start/server-only";
import { asc, eq, inArray } from "drizzle-orm";
import type { AdminActivityOptions, AdminActivityPage } from "@/features/taskline/admin/schema";
import type { AdminActivityListInput } from "@/features/taskline/admin/search";
import { listPage } from "@/server/db/crud";
import { allOf, dateRange } from "@/server/db/list";
import { tlActivity, tlProject, tlStatus, tlTask } from "@/server/db/schema";
import type { Services } from "@/server/services";
import * as workflowRepo from "../workflow/repository";
import * as members from "../workspace/repository";
import { team } from "./team";

/**
 * /admin/taskline/activity (PLAN 11.5): the team's whole history (`tl_activity`), newest
 * first, by project, actor, kind and days. The page names what the sentences need:
 * every member (deactivated ones too) and the statuses of the projects on it.
 */

const isId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function list({ db }: Pick<Services, "db">, input: AdminActivityListInput): Promise<AdminActivityPage> {
	const { workspace, settings } = await team(db);
	const memberRows = await members.listMembers(db, workspace.id, { deactivated: true });
	const page = await listPage(db, tlActivity, {
		input,
		where: allOf(
			eq(tlActivity.workspaceId, workspace.id),
			isId(input.project) ? eq(tlActivity.projectId, input.project) : undefined,
			isId(input.actor) ? eq(tlActivity.actorId, input.actor) : undefined,
			input.kind === "all" ? undefined : eq(tlActivity.kind, input.kind),
			dateRange(tlActivity.at, input.from, input.to, settings.timeZone),
		),
		sort: { columns: { at: tlActivity.at }, fallback: "at" },
		map: async (rows) => {
			const projectIds = [...new Set(rows.map((row) => row.projectId))];
			const taskIds = [...new Set(rows.flatMap((row) => (row.taskId ? [row.taskId] : [])))];
			const [projects, tasks] = await Promise.all([
				projectIds.length === 0
					? Promise.resolve([])
					: db
							.select({ id: tlProject.id, key: tlProject.key, name: tlProject.name })
							.from(tlProject)
							.where(inArray(tlProject.id, projectIds)),
				taskIds.length === 0
					? Promise.resolve([])
					: db
							.select({ id: tlTask.id, number: tlTask.number, title: tlTask.title, projectId: tlTask.projectId })
							.from(tlTask)
							.where(inArray(tlTask.id, taskIds)),
			]);
			const projectOf = new Map(projects.map((project) => [project.id, project]));
			const taskOf = new Map(tasks.map((task) => [task.id, task]));
			return rows.map((row) => {
				const project = projectOf.get(row.projectId) ?? { id: row.projectId, key: "", name: "" };
				const task = row.taskId ? taskOf.get(row.taskId) : undefined;
				return {
					id: row.id,
					kind: row.kind,
					actorId: row.actorId,
					data: row.data,
					at: row.at.toISOString(),
					project,
					task: task ? { ref: `${project.key}-${task.number}`, title: task.title } : null,
				};
			});
		},
	});
	const projectIds = [...new Set(page.items.map((item) => item.project.id))];
	const statuses =
		projectIds.length === 0
			? []
			: await db.select().from(tlStatus).where(inArray(tlStatus.projectId, projectIds)).orderBy(asc(tlStatus.position));
	return { ...page, members: memberRows.map(members.memberDto), statuses: statuses.map(workflowRepo.statusDto) };
}

/** The filters' choices: every team project (archived too) and every member. */
export async function options({ db }: Pick<Services, "db">): Promise<AdminActivityOptions> {
	const { workspace } = await team(db);
	const [projects, memberRows] = await Promise.all([
		db
			.select({ id: tlProject.id, key: tlProject.key, name: tlProject.name })
			.from(tlProject)
			.where(eq(tlProject.workspaceId, workspace.id))
			.orderBy(asc(tlProject.key)),
		members.listMembers(db, workspace.id, { deactivated: true }),
	]);
	return { projects, members: memberRows.map((member) => ({ id: member.id, name: member.displayName })) };
}
