import "@tanstack/react-start/server-only";
import { projectSettings } from "@/features/taskline/settings";
import type { LinkedTask, StatusCategory, TaskDependencies } from "@/features/taskline/types";
import { isAppError, ruleError } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { TlProjectRow, TlTaskRow } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { type ProjectAccess, projectAccess, type WorkspaceAccess } from "../access";
import * as repo from "./repository";

/**
 * Dependencies as the tasks service needs them (Task 54, decision 0219): a task's
 * links for its page, and the project's rule that a blocked task can't be completed.
 * A blocker counts while it's open (not completed or canceled) and outside the trash,
 * wherever it is in the workspace; the caller sees only the ones in projects they may see.
 */

/** Which of these projects of the caller's workspace they may see (the resolver's table). */
export async function visibleProjectIds(
	db: Db,
	access: WorkspaceAccess & { project?: TlProjectRow },
	projects: ReadonlyArray<TlProjectRow>,
): Promise<Set<string>> {
	const visible = new Set<string>(access.project ? [access.project.id] : []);
	for (const project of projects) {
		if (visible.has(project.id) || project.workspaceId !== access.workspace.id) continue;
		try {
			await projectAccess(db, access, project);
			visible.add(project.id);
		} catch (error) {
			if (!isAppError(error) || error.code !== "NOT_FOUND") throw error;
		}
	}
	return visible;
}

const ref = (project: TlProjectRow, task: TlTaskRow) => `${project.key}-${task.number}`;

const linked = (access: ProjectAccess, project: TlProjectRow, task: TlTaskRow): LinkedTask => ({
	id: task.id,
	ref: ref(project, task),
	title: task.title,
	projectKey: project.key,
	projectName: project.name,
	elsewhere: project.id !== access.project.id,
	closed: task.completedAt !== null,
	startOn: task.startOn,
	dueOn: task.dueOn,
});

/** A task's dependencies for its page: the visible ones on each side, and how many are out of sight. */
export async function taskDependencies(db: Db, access: ProjectAccess, taskId: string): Promise<TaskDependencies> {
	const links = await repo.linksOf(db, taskId);
	const visible = await visibleProjectIds(
		db,
		access,
		links.map((link) => link.project),
	);
	const shown = links.filter((link) => visible.has(link.project.id));
	return {
		blockedBy: shown
			.filter((link) => link.relation === "blocked_by")
			.map((link) => linked(access, link.project, link.task)),
		blocks: shown.filter((link) => link.relation === "blocks").map((link) => linked(access, link.project, link.task)),
		hidden: links.length - shown.length,
		blockCompletion: projectSettings.parse(access.project.settings).blockCompletionWhileBlocked,
	};
}

/**
 * The project's rule (its "A blocked task can't be completed" setting): moving tasks
 * into a `completed` status is refused while an open task blocks one of them. Canceling
 * isn't completing, and the rule is off by default. The refusal names the blockers the
 * caller may see and counts the others.
 */
export async function assertCompletable(
	db: Db,
	access: ProjectAccess,
	tasks: ReadonlyArray<TlTaskRow>,
	category: StatusCategory,
): Promise<void> {
	if (category !== "completed" || tasks.length === 0) return;
	if (!projectSettings.parse(access.project.settings).blockCompletionWhileBlocked) return;
	const blockers = await repo.openBlockersOf(
		db,
		tasks.map((task) => task.id),
	);
	const first = tasks.find((task) => blockers.some((row) => row.blockedId === task.id));
	if (!first) return;
	const mine = blockers.filter((row) => row.blockedId === first.id);
	const visible = await visibleProjectIds(
		db,
		access,
		mine.map((row) => row.project),
	);
	const named = mine.filter((row) => visible.has(row.project.id)).map((row) => ref(row.project, row.task));
	const others = mine.length - named.length;
	const blockerText = [
		...named,
		...(others > 0 ? [m.taskline_dependency_more({ count: formatNumber(others) })] : []),
	].join(", ");
	throw ruleError(
		"CONFLICT",
		"Taskline: blocked task",
		m.taskline_error_blocked({ task: ref(access.project, first), blockers: blockerText }),
	);
}
