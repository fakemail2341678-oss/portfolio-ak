import "@tanstack/react-start/server-only";
import { activeFields, isEmptyFieldValue, missingRequired, toTaskFieldsSchema } from "@/features/taskline/fields";
import type { ActivityValue, FieldValue, StatusCategory, TaskField, TaskFieldValues } from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { notFound } from "@/server/db/crud";
import type { TlTaskRow } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { ProjectAccess } from "../access";
import type { ActivityEntry } from "../activity";
import * as members from "../workspace/repository";
import * as repo from "./repository";

/**
 * Custom fields as the tasks service needs them (Task 55, decision 0220): the fields a
 * project's tasks can have, a change's values checked against them (the type's schema,
 * and a member value an active member of the workspace), and the rule that a task
 * isn't completed while a required field is empty.
 */

/** The fields of the project's tasks: the workspace's and its own, archived ones too. */
export async function projectFields(db: Db, access: ProjectAccess): Promise<TaskField[]> {
	return (await repo.listFields(db, access.workspace.id, access.project.id)).map(repo.fieldDto);
}

/** A change's values: what to set and what to remove (null or empty clears). */
export type CheckedValues = { set: Record<string, FieldValue>; remove: string[] };

/**
 * Checks values against the project's fields: only fields offered on its tasks (an
 * archived or another project's field is NOT_FOUND), each of its type, a member an
 * active member of the workspace. `activeMemberIds` saves a query per row (the import).
 */
export async function checkValues(
	db: Db,
	access: ProjectAccess,
	fields: ReadonlyArray<TaskField>,
	values: Readonly<Record<string, FieldValue | null>>,
	activeMemberIds?: ReadonlySet<string>,
): Promise<CheckedValues> {
	const offered = activeFields(fields);
	for (const id of Object.keys(values)) if (!offered.some((field) => field.id === id)) throw notFound("Field");
	const parsed = toTaskFieldsSchema(offered).safeParse(values);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const field = offered.find((each) => each.id === issue?.path[0]);
		throw ruleError(
			"BAD_REQUEST",
			"Taskline: field value refused",
			m.taskline_field_error_value({ field: field?.name ?? "", problem: issue?.message ?? "" }),
		);
	}
	const checked: CheckedValues = { set: {}, remove: [] };
	for (const [id, value] of Object.entries(parsed.data as Record<string, FieldValue | null | undefined>)) {
		if (value === undefined) continue;
		if (isEmptyFieldValue(value)) {
			checked.remove.push(id);
			continue;
		}
		if (offered.find((field) => field.id === id)?.type === "member") {
			const memberId = String(value);
			const active = activeMemberIds
				? activeMemberIds.has(memberId)
				: await members.memberById(db, access.workspace.id, memberId).then((row) => row !== null && !row.deactivatedAt);
			if (!active) throw notFound("Member");
		}
		checked.set[id] = value;
	}
	return checked;
}

/** One history entry per field whose value changed: `{ field: "custom", fieldId, name, from, to }`. */
export function valueChanges(
	taskId: string,
	fields: ReadonlyArray<TaskField>,
	before: TaskFieldValues,
	{ set, remove }: CheckedValues,
): ActivityEntry[] {
	const entries: ActivityEntry[] = [];
	const ids = [...Object.keys(set), ...remove];
	for (const id of ids) {
		const from = before[id] ?? null;
		const to = set[id] ?? null;
		if (JSON.stringify(from) === JSON.stringify(to)) continue;
		const field = fields.find((each) => each.id === id);
		entries.push({
			kind: "task.updated",
			taskId,
			data: {
				field: "custom",
				fieldId: id,
				name: field?.name ?? "",
				from: from as ActivityValue,
				to: to as ActivityValue,
			},
		});
	}
	return entries;
}

/**
 * A required field must have a value before its task is completed: moving tasks into a
 * `completed` status is refused while one of them misses one, naming the task and the
 * fields. Canceling isn't completing.
 */
export async function assertFieldsComplete(
	db: Db,
	access: ProjectAccess,
	tasks: ReadonlyArray<Pick<TlTaskRow, "number" | "fields">>,
	category: StatusCategory,
): Promise<void> {
	if (category !== "completed" || tasks.length === 0) return;
	const fields = await projectFields(db, access);
	if (!fields.some((field) => field.required && !field.archived)) return;
	for (const task of tasks) {
		const missing = missingRequired(fields, task.fields);
		if (missing.length === 0) continue;
		throw ruleError(
			"CONFLICT",
			"Taskline: required fields missing",
			m.taskline_field_error_required({
				task: `${access.project.key}-${task.number}`,
				fields: missing.map((field) => field.name).join(", "),
			}),
		);
	}
}
