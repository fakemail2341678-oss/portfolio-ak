import "@tanstack/react-start/server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { AutomationEvent } from "@/features/taskline/automation-rules";
import { isClosedCategory } from "@/features/taskline/types";
import { type TlStatusRow, type TlTaskRow, tlTask } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import type { ProjectAccess } from "../access";
import * as tasks from "../tasks/repository";
import { repeatOnClose } from "./recurrence";

/** A sprint just started: `sprint_started` for each of its tasks outside the trash. */
export async function sprintStartEvents(tx: Tx, sprintId: string): Promise<AutomationEvent[]> {
	const rows = await tx
		.select({ id: tlTask.id })
		.from(tlTask)
		.where(and(eq(tlTask.sprintId, sprintId), isNull(tlTask.deletedAt)));
	return rows.map((row) => ({ trigger: "sprint_started", taskId: row.id }));
}

/**
 * What the services hand the automation engine after tasks change status (Task 56): a
 * `status_changed` event per task, and `subtasks_done` for each open parent whose
 * subtasks (outside the trash) are now all closed. A repeating task that just closed
 * gets its series' next task here too, before the automations run.
 */
export async function afterStatusChanges(
	tx: Tx,
	access: ProjectAccess,
	moved: ReadonlyArray<{ before: TlTaskRow; after: TlTaskRow; status: TlStatusRow }>,
): Promise<AutomationEvent[]> {
	const events: AutomationEvent[] = [];
	const parents = new Set<string>();
	for (const { before, after, status } of moved) {
		events.push({ trigger: "status_changed", taskId: after.id, statusId: status.id, category: status.category });
		const closing = isClosedCategory(status.category) && before.completedAt === null;
		if (!closing) continue;
		if (after.recurrence) await repeatOnClose(tx, access, after);
		if (after.parentId) parents.add(after.parentId);
	}
	for (const parentId of parents) {
		const parent = await tasks.getById(tx, access.project.id, parentId);
		if (!parent || parent.deletedAt || parent.completedAt) continue;
		const children = (await tasks.subtasksOf(tx, parentId)).filter((child) => !child.deletedAt);
		if (children.length > 0 && children.every((child) => child.completedAt !== null)) {
			events.push({ trigger: "subtasks_done", taskId: parentId });
		}
	}
	return events;
}
