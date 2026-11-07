import "@tanstack/react-start/server-only";
import type { CreateMilestoneInput, DependencyInput, UpdateMilestoneInput } from "@/features/taskline/schema";
import { DEPENDENCIES_MAX, MILESTONES_MAX, type Milestone, type TaskDetail } from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { notFound } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import type { TlMilestoneRow } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { assertCan, type ProjectAccess, resolveProject, type TasklineServices } from "../access";
import { recordActivity } from "../activity";
import { bumpRev } from "../rev";
import { fieldError } from "../rules";
import * as tasks from "../tasks/repository";
import { resolveTask, taskDetail } from "../tasks/service";
import * as repo from "./repository";

/**
 * Milestones and dependencies (docs/guides/taskline.md, "Timeline, milestones and
 * dependencies"; decision 0219). Everyone who may edit a project plans its milestones.
 * A dependency joins two tasks of one workspace, possibly in two projects: the caller
 * must be able to edit both (a dependency changes what the other task may do), it is
 * never a task on itself, and never closes a loop. Each side's history says so, and
 * both projects' `rev` move.
 */

const conflict = (what: string, message: string) => ruleError("CONFLICT", `Taskline: ${what}`, message);

async function milestoneOf(db: Db, access: ProjectAccess, id: string): Promise<TlMilestoneRow> {
	const milestone = await repo.getMilestone(db, access.project.id, id);
	if (!milestone) throw notFound("Milestone");
	return milestone;
}

export async function createMilestone(
	{ db, user }: TasklineServices,
	{ ws, key, id, name, description, dueOn }: CreateMilestoneInput,
): Promise<Milestone> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "edit");
		await lockQuota(tx, `taskline-milestones:${access.project.id}`);
		if ((await repo.countMilestones(tx, access.project.id)) >= MILESTONES_MAX) {
			throw conflict("too many milestones", m.taskline_milestone_error_max({ max: formatNumber(MILESTONES_MAX) }));
		}
		const milestone = await repo.insertMilestone(tx, {
			...(id ? { id } : {}),
			projectId: access.project.id,
			name,
			description: description ?? "",
			dueOn: dueOn ?? null,
			position: await repo.endOfMilestones(tx, access.project.id),
		});
		await recordActivity(tx, access, { kind: "milestone.created", data: { milestoneId: milestone.id, name } });
		await bumpRev(tx, access.project.id);
		return repo.milestoneDto(milestone);
	});
}

/**
 * A milestone's name, description and day, its place in the order, or whether it's
 * complete. Reordering leaves no history; the rest does.
 */
export async function updateMilestone(
	{ db, user }: TasklineServices,
	{ ws, key, id, completed, ...fields }: UpdateMilestoneInput,
): Promise<Milestone> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "edit");
		const before = await milestoneOf(tx, access, id);
		const completedAt =
			completed === undefined ? before.completedAt : completed ? (before.completedAt ?? new Date()) : null;
		const milestone = await repo.patchMilestone(tx, id, {
			name: fields.name ?? before.name,
			description: fields.description ?? before.description,
			dueOn: fields.dueOn === undefined ? before.dueOn : fields.dueOn,
			position: fields.position ?? before.position,
			completedAt,
		});
		const data = { milestoneId: id, name: milestone.name };
		if ((before.completedAt === null) !== (milestone.completedAt === null)) {
			await recordActivity(tx, access, {
				kind: milestone.completedAt ? "milestone.completed" : "milestone.reopened",
				data,
			});
		}
		if (
			before.name !== milestone.name ||
			before.description !== milestone.description ||
			before.dueOn !== milestone.dueOn
		) {
			await recordActivity(tx, access, { kind: "milestone.updated", data });
		}
		await bumpRev(tx, access.project.id);
		return repo.milestoneDto(milestone);
	});
}

/** Deletes a milestone; its tasks stay, without one. */
export async function deleteMilestone({ db, user }: TasklineServices, ws: string, key: string, id: string) {
	await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "edit");
		const milestone = await milestoneOf(tx, access, id);
		await repo.deleteMilestone(tx, id);
		await recordActivity(tx, access, { kind: "milestone.deleted", data: { milestoneId: id, name: milestone.name } });
		await bumpRev(tx, access.project.id);
	});
}

/** The two tasks of a dependency, both the caller's to edit and outside the trash. */
async function resolvePair(tx: Db, services: TasklineServices, { ws, ref, other }: DependencyInput) {
	if (ref === other) throw fieldError("BAD_REQUEST", "other", m.taskline_dependency_error_self());
	const mine = await resolveTask(tx, services.user, ws, ref);
	assertCan(mine.access, "edit");
	const theirs = await resolveTask(tx, services.user, ws, other);
	assertCan(theirs.access, "edit");
	for (const { task } of [mine, theirs]) {
		if (task.deletedAt) throw conflict("task in trash", m.taskline_error_in_trash());
	}
	return { mine, theirs };
}

/** Each side's history entry, and each project's rev (once when they're the same project). */
async function recordBoth(
	tx: Tx,
	kind: "dependency.added" | "dependency.removed",
	{ mine, theirs }: Awaited<ReturnType<typeof resolvePair>>,
	relation: DependencyInput["relation"],
) {
	const refOf = (side: typeof mine) => tasks.taskRef(side.access.project.key, side.task.number);
	await recordActivity(tx, mine.access, {
		kind,
		taskId: mine.task.id,
		data: { relation, ref: refOf(theirs), title: theirs.task.title },
	});
	await recordActivity(tx, theirs.access, {
		kind,
		taskId: theirs.task.id,
		data: { relation: relation === "blocks" ? "blocked_by" : "blocks", ref: refOf(mine), title: mine.task.title },
	});
	await bumpRev(tx, mine.access.project.id);
	if (theirs.access.project.id !== mine.access.project.id) await bumpRev(tx, theirs.access.project.id);
}

/**
 * Adds a dependency from the task `ref`: `other` blocks it, or it blocks `other`.
 * Adding one that exists changes nothing. Refused: a task on itself, a loop (the
 * workspace's lock keeps two opposite adds from both passing), more than
 * DEPENDENCIES_MAX on a side.
 */
export async function addDependency(services: TasklineServices, input: DependencyInput): Promise<TaskDetail> {
	const { db, user, imageStore } = services;
	return db.transaction(async (tx) => {
		const pair = await resolvePair(tx, services, input);
		const { mine, theirs } = pair;
		const [blocker, blocked] = input.relation === "blocked_by" ? [theirs.task, mine.task] : [mine.task, theirs.task];
		await lockQuota(tx, `taskline-dependencies:${mine.access.workspace.id}`);
		const exists = (await repo.linksOf(tx, blocked.id)).some(
			(link) => link.relation === "blocked_by" && link.task.id === blocker.id,
		);
		if (!exists) {
			if (
				(await repo.countSide(tx, blocked.id, "blocked_by")) >= DEPENDENCIES_MAX ||
				(await repo.countSide(tx, blocker.id, "blocks")) >= DEPENDENCIES_MAX
			) {
				throw conflict(
					"too many dependencies",
					m.taskline_dependency_error_max({ max: formatNumber(DEPENDENCIES_MAX) }),
				);
			}
			if (await repo.wouldCycle(tx, blocker.id, blocked.id)) {
				throw fieldError("CONFLICT", "other", m.taskline_dependency_error_cycle());
			}
			if (await repo.insertDependency(tx, blocker.id, blocked.id)) {
				await recordBoth(tx, "dependency.added", pair, input.relation);
			}
		}
		return taskDetail(tx, mine.access, mine.task, { imageStore, user });
	});
}

/** Removes a dependency (seen from `ref`); one that isn't there changes nothing. */
export async function removeDependency(services: TasklineServices, input: DependencyInput): Promise<TaskDetail> {
	const { db, user, imageStore } = services;
	return db.transaction(async (tx) => {
		const pair = await resolvePair(tx, services, input);
		const { mine, theirs } = pair;
		const [blocker, blocked] = input.relation === "blocked_by" ? [theirs.task, mine.task] : [mine.task, theirs.task];
		if (await repo.deleteDependency(tx, blocker.id, blocked.id)) {
			await recordBoth(tx, "dependency.removed", pair, input.relation);
		}
		return taskDetail(tx, mine.access, mine.task, { imageStore, user });
	});
}
