import "@tanstack/react-start/server-only";
import type { FieldDefinition } from "@/features/taskline/fields";
import type { CreateFieldInput, FieldChanges, UpdateFieldInput } from "@/features/taskline/schema";
import { FIELDS_MAX, isChoiceType, type TaskField } from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { generateKeyBetween } from "@/lib/fractional-index";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { notFound, uniqueViolation } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import type { TlFieldRow } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import { assertCan, resolveProject, type TasklineServices } from "../access";
import { recordActivity } from "../activity";
import { bumpRev } from "../rev";
import { fieldError } from "../rules";
import * as repo from "./repository";

/**
 * Custom fields' definitions (Task 55, decision 0220). The core (`addField`,
 * `changeField`, `dropField`) works on a scope, the workspace's or a project's; the
 * project's fields are its lead's (below), the workspace's the admin's
 * (`admin/fields.ts`, audited). A field's type never changes; an option taken out of a
 * select comes off every task; archiving keeps the values, deleting removes them.
 */

const nameTaken = () =>
	({
		tl_field_project_name_unique: { field: "name", message: m.taskline_field_error_taken },
		tl_field_workspace_name_unique: { field: "name", message: m.taskline_field_error_taken },
	}) as const;

/** A new field at the end of its scope, within the scope's FIELDS_MAX. */
export async function addField(tx: Tx, scope: repo.FieldScope, definition: FieldDefinition): Promise<TlFieldRow> {
	await lockQuota(tx, `taskline:fields:${scope.projectId ?? scope.workspaceId}`);
	if ((await repo.countFields(tx, scope)) >= FIELDS_MAX) {
		throw ruleError(
			"CONFLICT",
			"Taskline quota reached: fields",
			m.taskline_field_error_quota({ max: formatNumber(FIELDS_MAX) }),
		);
	}
	try {
		return await repo.insertField(tx, {
			...scope,
			name: definition.name,
			type: definition.type,
			options: "options" in definition ? definition.options : [],
			required: definition.required,
			position: generateKeyBetween(await repo.lastPosition(tx, scope), null),
		});
	} catch (error) {
		throw uniqueViolation(error, nameTaken());
	}
}

/** A field's changes; options a select no longer has come off its tasks. */
export async function changeField(
	tx: Tx,
	before: TlFieldRow,
	{ archived, options, ...changes }: Omit<FieldChanges, "id">,
): Promise<TlFieldRow> {
	if (options && !isChoiceType(before.type))
		throw fieldError("BAD_REQUEST", "options", m.taskline_field_error_no_options());
	let after: TlFieldRow;
	try {
		after = await repo.updateField(tx, before.id, {
			...changes,
			...(options ? { options } : {}),
			...(archived === undefined ? {} : { archivedAt: archived ? (before.archivedAt ?? new Date()) : null }),
		});
	} catch (error) {
		throw uniqueViolation(error, nameTaken());
	}
	if (options) {
		const kept = new Set(options.map((option) => option.id));
		await repo.removeOptions(
			tx,
			before,
			before.options.filter((option) => !kept.has(option.id)).map((option) => option.id),
		);
	}
	return after;
}

/** Deletes a field for good, with every value of it. */
export async function dropField(tx: Tx, field: TlFieldRow): Promise<void> {
	await repo.removeValues(tx, field);
	await repo.deleteField(tx, field.id);
}

// ---- A project's fields (its lead's) -----------------------------------------------------------

export async function createField(
	{ db, user }: TasklineServices,
	{ ws, key, field: definition }: CreateFieldInput,
): Promise<TaskField> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const field = await addField(tx, { workspaceId: access.workspace.id, projectId: access.project.id }, definition);
		await recordActivity(tx, access, { kind: "field.created", data: { id: field.id, name: field.name } });
		await bumpRev(tx, access.project.id);
		return repo.fieldDto(field);
	});
}

export async function updateField(
	{ db, user }: TasklineServices,
	{ ws, key, id, ...changes }: UpdateFieldInput,
): Promise<TaskField> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const before = await repo.getField(tx, { workspaceId: access.workspace.id, projectId: access.project.id }, id);
		if (!before) throw notFound("Field");
		const field = await changeField(tx, before, changes);
		// Reordering isn't news; everything else is in the project's history.
		const { position: _position, ...rest } = changes;
		if (Object.keys(rest).length > 0) {
			await recordActivity(tx, access, {
				kind: "field.updated",
				data: {
					id,
					name: field.name,
					...(changes.archived === undefined ? {} : { archived: changes.archived }),
				},
			});
		}
		await bumpRev(tx, access.project.id);
		return repo.fieldDto(field);
	});
}

export async function deleteField(
	{ db, user }: TasklineServices,
	{ ws, key, id }: { ws: string; key: string; id: string },
): Promise<void> {
	await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const field = await repo.getField(tx, { workspaceId: access.workspace.id, projectId: access.project.id }, id);
		if (!field) throw notFound("Field");
		await dropField(tx, field);
		await recordActivity(tx, access, { kind: "field.deleted", data: { id, name: field.name } });
		await bumpRev(tx, access.project.id);
	});
}
