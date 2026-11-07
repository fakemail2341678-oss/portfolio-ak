import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import type {
	AdminAutomations,
	AdminCreateAutomationInput,
	AdminUpdateAutomationInput,
} from "@/features/taskline/admin/schema";
import type { AutomationCondition, AutomationPreview } from "@/features/taskline/types";
import { changes } from "@/server/audit/record";
import { notFound, withAudit } from "@/server/db/crud";
import { type TlAutomationRow, tlAutomation } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import type { Services } from "@/server/services";
import * as repo from "../automations/repository";
import { addAutomation, changeAutomation, previewCount } from "../automations/service";
import * as fieldRepo from "../fields/repository";
import * as workflow from "../workflow/repository";
import * as members from "../workspace/repository";
import { team } from "./team";

/**
 * /admin/taskline/automations (Task 56, decision 0221): the team workspace's rules, on
 * every team project's tasks (`taskline:configure`, each change audited), and the run
 * log of every team automation. The rules are the app's (`automations/service.ts`):
 * a workspace rule names categories, the workspace's labels and fields, and members.
 */

const target = (row: Pick<TlAutomationRow, "id" | "name">) => ({
	type: "taskline-automation" as const,
	id: row.id,
	label: row.name,
});

/** What the audit log keeps of a rule: its name, whether it's on, and what it does. */
const summary = (row: TlAutomationRow) => ({
	name: row.name,
	enabled: row.enabled,
	trigger: row.trigger.type,
	conditions: row.conditions.length,
	actions: row.actions.map((action) => action.type).join(", "),
});

const workspaceScope = (workspaceId: string) => ({ workspaceId, projectId: null });

async function view(db: Db, workspaceId: string, ws: string): Promise<AdminAutomations> {
	const rules = await repo.listScope(db, workspaceScope(workspaceId));
	const everyRule = await db
		.select({ id: tlAutomation.id })
		.from(tlAutomation)
		.where(eq(tlAutomation.workspaceId, workspaceId));
	// One after another: after a change this runs in its transaction, on one connection.
	const labels = await workflow.listWorkspaceLabels(db, workspaceId);
	const people = await members.listMembers(db, workspaceId);
	const fields = await fieldRepo.scopeFields(db, workspaceScope(workspaceId));
	return {
		ws,
		automations: await repo.dtos(db, rules),
		runs: await repo.listRuns(
			db,
			everyRule.map((row) => row.id),
			100,
		),
		labels: labels.map(workflow.labelDto),
		members: people.map(members.memberDto),
		fields: fields.map(fieldRepo.fieldDto),
		readAt: new Date().toISOString(),
	};
}

async function workspaceRule(tx: Tx, workspaceId: string, id: string): Promise<TlAutomationRow> {
	const row = await repo.getAutomation(tx, workspaceScope(workspaceId), id);
	if (!row) throw notFound("Automation");
	return row;
}

export async function listAutomations({ db }: Pick<Services, "db">): Promise<AdminAutomations> {
	const { workspace } = await team(db);
	return view(db, workspace.id, workspace.slug);
}

export async function createAutomation({ db, actor }: Services, { automation }: AdminCreateAutomationInput) {
	return withAudit(db, actor, async (tx, audit): Promise<AdminAutomations> => {
		const { workspace } = await team(tx);
		const row = await addAutomation(tx, workspaceScope(workspace.id), automation, null);
		audit({ action: "taskline.automation.create", target: target(row), after: summary(row) });
		return view(tx, workspace.id, workspace.slug);
	});
}

export async function updateAutomation(
	{ db, actor }: Services,
	{ id, version, automation }: AdminUpdateAutomationInput,
) {
	return withAudit(db, actor, async (tx, audit): Promise<AdminAutomations> => {
		const { workspace } = await team(tx);
		const before = await workspaceRule(tx, workspace.id, id);
		const after = await changeAutomation(tx, workspaceScope(workspace.id), before, version, automation);
		const changed = changes(summary(before), summary(after), [
			"name",
			"enabled",
			"trigger",
			"conditions",
			"actions",
		] as const);
		audit({ action: "taskline.automation.update", target: target(after), ...(changed ?? {}) });
		return view(tx, workspace.id, workspace.slug);
	});
}

/** On or off at once (no version: it changes nothing else). */
export async function toggleAutomation({ db, actor }: Services, { id, enabled }: { id: string; enabled: boolean }) {
	return withAudit(db, actor, async (tx, audit): Promise<AdminAutomations> => {
		const { workspace } = await team(tx);
		const before = await workspaceRule(tx, workspace.id, id);
		if (before.enabled !== enabled) {
			const after = await repo.setEnabled(tx, id, enabled);
			audit({
				action: "taskline.automation.update",
				target: target(after),
				before: { enabled: before.enabled },
				after: { enabled },
			});
		}
		return view(tx, workspace.id, workspace.slug);
	});
}

export async function deleteAutomation({ db, actor }: Services, { id }: { id: string }) {
	return withAudit(db, actor, async (tx, audit): Promise<AdminAutomations> => {
		const { workspace } = await team(tx);
		const row = await workspaceRule(tx, workspace.id, id);
		await repo.deleteAutomation(tx, id);
		audit({ action: "taskline.automation.delete", target: target(row), before: summary(row) });
		return view(tx, workspace.id, workspace.slug);
	});
}

/** The builder's preview over every active team project's open tasks. */
export async function previewAutomation(
	{ db }: Pick<Services, "db">,
	{ conditions }: { conditions: AutomationCondition[] },
): Promise<AutomationPreview> {
	const { workspace, settings } = await team(db);
	const fields = (await fieldRepo.scopeFields(db, workspaceScope(workspace.id))).map(fieldRepo.fieldDto);
	return previewCount(db, workspaceScope(workspace.id), conditions, { fields, timeZone: settings.timeZone });
}
