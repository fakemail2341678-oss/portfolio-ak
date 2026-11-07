import "@tanstack/react-start/server-only";
import type {
	CreateLabelInput,
	CreateStatusInput,
	UpdateLabelInput,
	UpdateStatusInput,
} from "@/features/taskline/schema";
import { isClosedCategory, type TasklineLabel, type TasklineStatus } from "@/features/taskline/types";
import { AppError, ruleError } from "@/lib/errors";
import { generateKeyBetween } from "@/lib/fractional-index";
import { m } from "@/paraglide/messages";
import { notFound, uniqueViolation } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import { assertCan, resolveProject, type TasklineServices } from "../access";
import { recordActivity } from "../activity";
import { bumpRev } from "../rev";
import { quotaError, quotasOf } from "../rules";
import * as tasks from "../tasks/repository";
import * as repo from "./repository";

/**
 * A project's workflow (its lead's): statuses with what they mean (a category, which
 * decides `completed_at`), their order and WIP limits, and the project's labels.
 * Workspace-wide statuses and labels are the admin's (Task 49).
 */

const labelTaken = () =>
	({ tl_label_project_name_unique: { field: "name", message: m.taskline_error_label_taken } }) as const;

export async function createStatus(
	{ db, user }: TasklineServices,
	{ ws, key, id, position, ...fields }: CreateStatusInput,
): Promise<TasklineStatus> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		await lockQuota(tx, `taskline:statuses:${access.project.id}`);
		const max = quotasOf(access).statusesPerProject;
		if ((await repo.countStatuses(tx, access.project.id)) >= max) throw quotaError("statuses", max);
		const status = await repo.insertStatus(tx, {
			...(id ? { id } : {}),
			projectId: access.project.id,
			...fields,
			position: position ?? generateKeyBetween(await repo.lastStatusPosition(tx, access.project.id), null),
		});
		await recordActivity(tx, access, { kind: "status.created", data: { id: status.id, name: status.name } });
		await bumpRev(tx, access.project.id);
		return repo.statusDto(status);
	});
}

/** Renames, recolours, reorders or recategorizes a status; a new category closes or reopens its tasks. */
export async function updateStatus(
	{ db, user }: TasklineServices,
	{ ws, key, id, ...changes }: UpdateStatusInput,
): Promise<TasklineStatus> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const before = await repo.getStatus(tx, access.project.id, id);
		if (!before) throw notFound("Status");
		const status = await repo.updateStatus(tx, id, changes);
		if (isClosedCategory(before.category) !== isClosedCategory(status.category)) {
			await tasks.syncCompletedAt(tx, status.id, isClosedCategory(status.category));
		}
		await recordActivity(tx, access, {
			kind: "status.updated",
			data: { id, from: repo.statusDto(before), to: repo.statusDto(status) },
		});
		await bumpRev(tx, access.project.id);
		return repo.statusDto(status);
	});
}

/**
 * Deletes a status. Its tasks (trashed ones too) first move to `moveTo`, at the end
 * of it; a project keeps at least one status.
 */
export async function deleteStatus(
	{ db, user }: TasklineServices,
	{ ws, key, id, moveTo }: { ws: string; key: string; id: string; moveTo?: string },
): Promise<void> {
	await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const status = await repo.getStatus(tx, access.project.id, id);
		if (!status) throw notFound("Status");
		if ((await repo.countStatuses(tx, access.project.id)) <= 1) {
			throw ruleError("CONFLICT", "Taskline: last status", m.taskline_error_status_last());
		}
		let moved = 0;
		if ((await tasks.countInStatus(tx, id)) > 0) {
			if (!moveTo || moveTo === id) {
				throw new AppError("CONFLICT", "Taskline: status in use", {
					fieldErrors: { moveTo: [m.taskline_error_status_move()] },
				});
			}
			const target = await repo.getStatus(tx, access.project.id, moveTo);
			if (!target) throw notFound("Status");
			moved = await tasks.moveAllToStatus(tx, id, target, isClosedCategory(target.category));
		}
		await repo.deleteStatus(tx, id);
		await recordActivity(tx, access, {
			kind: "status.deleted",
			data: { id, name: status.name, moveTo: moveTo ?? null, moved },
		});
		await bumpRev(tx, access.project.id);
	});
}

export async function createLabel(
	{ db, user }: TasklineServices,
	{ ws, key, id, ...fields }: CreateLabelInput,
): Promise<TasklineLabel> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		try {
			const [label] = await repo.insertLabels(tx, [
				{ ...(id ? { id } : {}), workspaceId: access.workspace.id, projectId: access.project.id, ...fields },
			]);
			if (!label) throw new Error("Label insert returned no row");
			await recordActivity(tx, access, { kind: "label.created", data: { id: label.id, name: label.name } });
			await bumpRev(tx, access.project.id);
			return repo.labelDto(label);
		} catch (error) {
			throw uniqueViolation(error, labelTaken());
		}
	});
}

export async function updateLabel(
	{ db, user }: TasklineServices,
	{ ws, key, id, ...changes }: UpdateLabelInput,
): Promise<TasklineLabel> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const before = await repo.getProjectLabel(tx, access.project.id, id);
		if (!before) throw notFound("Label");
		try {
			const label = await repo.updateLabel(tx, id, changes);
			await recordActivity(tx, access, { kind: "label.updated", data: { id, from: before.name, to: label.name } });
			await bumpRev(tx, access.project.id);
			return repo.labelDto(label);
		} catch (error) {
			throw uniqueViolation(error, labelTaken());
		}
	});
}

/** Deletes a project label; it comes off every task that had it. */
export async function deleteLabel(
	{ db, user }: TasklineServices,
	{ ws, key, id }: { ws: string; key: string; id: string },
): Promise<void> {
	await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const label = await repo.getProjectLabel(tx, access.project.id, id);
		if (!label) throw notFound("Label");
		await repo.deleteLabel(tx, id);
		await recordActivity(tx, access, { kind: "label.deleted", data: { id, name: label.name } });
		await bumpRev(tx, access.project.id);
	});
}
