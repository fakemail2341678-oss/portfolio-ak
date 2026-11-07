import "@tanstack/react-start/server-only";
import { and, eq, isNull } from "drizzle-orm";
import type {
	AdminCreateFieldInput,
	AdminField,
	AdminFields,
	AdminUpdateFieldInput,
} from "@/features/taskline/admin/schema";
import { changes } from "@/server/audit/record";
import { notFound, withAudit } from "@/server/db/crud";
import { type TlFieldRow, tlProject } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { Services } from "@/server/services";
import * as repo from "../fields/repository";
import { addField, changeField, dropField } from "../fields/service";
import { bumpRevs, team } from "./team";

/**
 * /admin/taskline/fields (Task 55, decision 0220): the team workspace's custom fields,
 * on every team project's tasks (`taskline:configure`, each change audited). The rules
 * are the app's (`fields/service.ts`); every open project's `rev` moves, so its pages
 * read the fields again.
 */

const target = (field: Pick<TlFieldRow, "id" | "name">) => ({
	type: "taskline-field" as const,
	id: field.id,
	label: field.name,
});

/** What the audit log keeps of a field: its name, whether it's required, archived, its options' names. */
const summary = (field: TlFieldRow) => ({
	name: field.name,
	type: field.type,
	required: field.required,
	archived: field.archivedAt !== null,
	options: field.options.map((option) => option.name),
});

async function view(db: Db, workspaceId: string): Promise<AdminFields> {
	const rows = await repo.scopeFields(db, { workspaceId, projectId: null });
	const counts = await repo.valueCounts(db, rows);
	return {
		fields: rows.map((row): AdminField => ({ ...repo.fieldDto(row), tasks: counts.get(row.id) ?? 0 })),
	};
}

async function openProjects(db: Db, workspaceId: string) {
	const rows = await db
		.select({ id: tlProject.id })
		.from(tlProject)
		.where(and(eq(tlProject.workspaceId, workspaceId), isNull(tlProject.archivedAt)));
	return rows.map((row) => row.id);
}

export async function listFields({ db }: Pick<Services, "db">): Promise<AdminFields> {
	const { workspace } = await team(db);
	return view(db, workspace.id);
}

export async function createField({ db, actor }: Services, { field: definition }: AdminCreateFieldInput) {
	return withAudit(db, actor, async (tx, audit): Promise<AdminFields> => {
		const { workspace } = await team(tx);
		const field = await addField(tx, { workspaceId: workspace.id, projectId: null }, definition);
		audit({ action: "taskline.field.create", target: target(field), after: summary(field) });
		await bumpRevs(tx, await openProjects(tx, workspace.id));
		return view(tx, workspace.id);
	});
}

export async function updateField({ db, actor }: Services, { id, ...input }: AdminUpdateFieldInput) {
	return withAudit(db, actor, async (tx, audit): Promise<AdminFields> => {
		const { workspace } = await team(tx);
		const before = await repo.getField(tx, { workspaceId: workspace.id, projectId: null }, id);
		if (!before) throw notFound("Field");
		const after = await changeField(tx, before, input);
		const changed = changes(summary(before), summary(after), ["name", "required", "archived", "options"] as const);
		if (changed) audit({ action: "taskline.field.update", target: target(after), ...changed });
		await bumpRevs(tx, await openProjects(tx, workspace.id));
		return view(tx, workspace.id);
	});
}

/** Deletes a workspace field for good: its values come off every task. */
export async function deleteField({ db, actor }: Services, { id }: { id: string }) {
	return withAudit(db, actor, async (tx, audit): Promise<AdminFields> => {
		const { workspace } = await team(tx);
		const field = await repo.getField(tx, { workspaceId: workspace.id, projectId: null }, id);
		if (!field) throw notFound("Field");
		await dropField(tx, field);
		audit({ action: "taskline.field.delete", target: target(field), before: summary(field) });
		await bumpRevs(tx, await openProjects(tx, workspace.id));
		return view(tx, workspace.id);
	});
}
