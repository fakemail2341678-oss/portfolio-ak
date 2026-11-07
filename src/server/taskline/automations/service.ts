import "@tanstack/react-start/server-only";
import { and, eq, isNull } from "drizzle-orm";
import { type AutomationDefinition, matchesConditions } from "@/features/taskline/automation-rules";
import { activeFields, fieldFilterChoices } from "@/features/taskline/fields";
import type {
	CreateAutomationInput,
	PreviewAutomationInput,
	ToggleAutomationInput,
	UpdateAutomationInput,
} from "@/features/taskline/schema";
import {
	AUTOMATIONS_MAX,
	type Automation,
	type AutomationCondition,
	type AutomationPreview,
	type ProjectAutomations,
	type TaskField,
	type TaskPriority,
} from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { todayInZone } from "@/lib/i18n/date-only";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { notFound } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import { type TlAutomationRow, tlAutomation, tlProject, tlStatus, tlTask } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { assertCan, resolveProject, type TasklineServices } from "../access";
import { recordActivity } from "../activity";
import * as fieldRepo from "../fields/repository";
import { saveVersioned } from "../rev";
import { fieldError } from "../rules";
import * as sprints from "../sprints/repository";
import * as tasks from "../tasks/repository";
import * as workflow from "../workflow/repository";
import * as members from "../workspace/repository";
import * as repo from "./repository";

/**
 * Automations' definitions (Task 56, decision 0221). The core works on a scope, the
 * workspace's or a project's: a project's rules are its lead's (below), the
 * workspace's the admin's (`admin/automations.ts`, audited). Saving checks that a rule
 * names only what its scope has: a project rule its statuses, labels (its own and the
 * workspace's), sprints, fields and the workspace's active members; a workspace rule,
 * which runs on every team project, only categories, workspace labels and fields, and
 * members. What it names may go later: the run then fails and says so.
 */

export type Scope = repo.AutomationScope;

const referenceError = (where: "trigger" | "conditions" | "actions") =>
	fieldError("BAD_REQUEST", where, m.taskline_automation_error_reference());

/** What a scope offers a rule (read one after another: it runs inside a transaction, on one connection). */
async function offered(db: Db, scope: Scope) {
	const { projectId } = scope;
	const statuses = projectId ? await workflow.listStatuses(db, projectId) : [];
	const labels = projectId
		? await workflow.listLabels(db, scope.workspaceId, projectId)
		: await workflow.listWorkspaceLabels(db, scope.workspaceId);
	const fields = projectId
		? await fieldRepo.listFields(db, scope.workspaceId, projectId)
		: await fieldRepo.scopeFields(db, { workspaceId: scope.workspaceId, projectId: null });
	return {
		statusIds: new Set(statuses.map((status) => status.id)),
		labelIds: new Set(labels.map((label) => label.id)),
		fields: activeFields(fields.map(fieldRepo.fieldDto)),
	};
}

const isMemberRef = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

/** Refuses a rule that names what its scope doesn't have (BAD_REQUEST on the part that does). */
export async function checkDefinition(db: Db, scope: Scope, definition: AutomationDefinition): Promise<void> {
	const has = await offered(db, scope);
	const memberIds = new Set<string>();
	const { trigger } = definition;
	if (trigger.type === "status_changed" && trigger.statusId && !has.statusIds.has(trigger.statusId)) {
		throw referenceError("trigger");
	}
	if (trigger.type === "label_added" && trigger.labelId && !has.labelIds.has(trigger.labelId)) {
		throw referenceError("trigger");
	}
	for (const condition of definition.conditions) {
		if (condition.type === "label" && !has.labelIds.has(condition.labelId)) throw referenceError("conditions");
		if (condition.type === "assignee" && isMemberRef(condition.is)) memberIds.add(condition.is);
		if (condition.type === "field") {
			const field = has.fields.find((each) => each.id === condition.fieldId);
			const choices = field ? fieldFilterChoices(field, [], { member: false }).map((choice) => choice.value) : [];
			const member = field?.type === "member" && isMemberRef(condition.value);
			if (!field || !(choices.includes(condition.value) || member)) throw referenceError("conditions");
			if (member) memberIds.add(condition.value);
		}
	}
	for (const action of definition.actions) {
		switch (action.type) {
			case "set_status":
				if (action.statusId && !has.statusIds.has(action.statusId)) throw referenceError("actions");
				break;
			case "add_label":
			case "remove_label":
				if (!has.labelIds.has(action.labelId)) throw referenceError("actions");
				break;
			case "set_sprint":
				if (action.to !== "active" && action.to !== "none") {
					if (!scope.projectId) throw referenceError("actions");
					await sprints.checkSprint(db, scope.projectId, action.to).catch(() => {
						throw referenceError("actions");
					});
				}
				break;
			case "assign":
			case "notify":
				if (isMemberRef(action.to)) memberIds.add(action.to);
				break;
		}
	}
	for (const memberId of memberIds) {
		const member = await members.memberById(db, scope.workspaceId, memberId);
		if (!member || member.deactivatedAt) throw referenceError("actions");
	}
}

/** A new rule in its scope, within AUTOMATIONS_MAX. */
export async function addAutomation(
	tx: Tx,
	scope: Scope,
	definition: AutomationDefinition,
	createdById: string | null,
): Promise<TlAutomationRow> {
	await lockQuota(tx, `taskline:automations:${scope.projectId ?? scope.workspaceId}`);
	if ((await repo.countScope(tx, scope)) >= AUTOMATIONS_MAX) {
		throw ruleError(
			"CONFLICT",
			"Taskline quota reached: automations",
			m.taskline_automation_error_quota({ max: formatNumber(AUTOMATIONS_MAX) }),
		);
	}
	await checkDefinition(tx, scope, definition);
	return repo.insertAutomation(tx, { ...scope, ...definition, createdById });
}

/** The builder's save, against the version it started from (a stale save is a CONFLICT). */
export async function changeAutomation(
	tx: Tx,
	scope: Scope,
	before: TlAutomationRow,
	version: number,
	definition: AutomationDefinition,
): Promise<TlAutomationRow> {
	await checkDefinition(tx, scope, definition);
	return saveVersioned(tx, tlAutomation, { id: before.id, version, what: "Automation", set: definition });
}

/** At most this many open tasks are read for a preview; past it, the count says "at least". */
export const PREVIEW_MAX = 5000;

/**
 * How many open tasks (outside the trash, not closed, in an active project) of the
 * scope match the conditions now: the builder's "would match N open tasks".
 */
export async function previewCount(
	db: Db,
	scope: Scope,
	conditions: ReadonlyArray<AutomationCondition>,
	{ fields, timeZone }: { fields: ReadonlyArray<TaskField>; timeZone: string },
): Promise<AutomationPreview> {
	const rows = await db
		.select({
			id: tlTask.id,
			type: tlTask.type,
			priority: tlTask.priority,
			assigneeId: tlTask.assigneeId,
			fields: tlTask.fields,
			category: tlStatus.category,
		})
		.from(tlTask)
		.innerJoin(tlStatus, eq(tlStatus.id, tlTask.statusId))
		.innerJoin(tlProject, eq(tlProject.id, tlTask.projectId))
		.where(
			and(
				eq(tlTask.workspaceId, scope.workspaceId),
				scope.projectId ? eq(tlTask.projectId, scope.projectId) : undefined,
				isNull(tlTask.deletedAt),
				isNull(tlTask.completedAt),
				isNull(tlProject.archivedAt),
			),
		)
		.limit(PREVIEW_MAX + 1);
	const capped = rows.length > PREVIEW_MAX;
	const read = rows.slice(0, PREVIEW_MAX);
	const labels = conditions.some((condition) => condition.type === "label")
		? await tasks.labelIdsOf(
				db,
				read.map((row) => row.id),
			)
		: new Map<string, string[]>();
	const today = todayInZone(timeZone);
	const count = read.filter((row) =>
		matchesConditions(
			{ ...row, priority: row.priority as TaskPriority, labelIds: labels.get(row.id) ?? [] },
			conditions,
			{ fields, today },
		),
	).length;
	return { count, capped };
}

// ---- A project's automations (its lead's) ------------------------------------------------------

/** The project's rules (with their latest runs), the workspace's that apply too, and its rules' latest runs. */
export async function listAutomations(
	{ db, user }: TasklineServices,
	ws: string,
	key: string,
): Promise<ProjectAutomations> {
	const access = await resolveProject(db, user, ws, key);
	assertCan(access, "manage");
	const own = await repo.listScope(db, { workspaceId: access.workspace.id, projectId: access.project.id });
	const shared =
		access.workspace.kind === "team"
			? await repo.listScope(db, { workspaceId: access.workspace.id, projectId: null })
			: [];
	return {
		automations: await repo.dtos(db, own),
		workspace: await repo.dtos(db, shared),
		runs: await repo.listRuns(
			db,
			own.map((row) => row.id),
		),
	};
}

async function ownRule(tx: Tx, scope: Scope, id: string) {
	const row = await repo.getAutomation(tx, scope, id);
	if (!row) throw notFound("Automation");
	return row;
}

export async function createAutomation(
	{ db, user }: TasklineServices,
	{ ws, key, automation }: CreateAutomationInput,
): Promise<Automation> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const scope = { workspaceId: access.workspace.id, projectId: access.project.id };
		const row = await addAutomation(tx, scope, automation, access.member?.id ?? null);
		await recordActivity(tx, access, { kind: "automation.created", data: { id: row.id, name: row.name } });
		return repo.automationDto(row);
	});
}

export async function updateAutomation(
	{ db, user }: TasklineServices,
	{ ws, key, id, version, automation }: UpdateAutomationInput,
): Promise<Automation> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const scope = { workspaceId: access.workspace.id, projectId: access.project.id };
		const row = await changeAutomation(tx, scope, await ownRule(tx, scope, id), version, automation);
		await recordActivity(tx, access, { kind: "automation.updated", data: { id, name: row.name } });
		return repo.automationDto(row);
	});
}

/** On or off at once, without the form's version. */
export async function toggleAutomation(
	{ db, user }: TasklineServices,
	{ ws, key, id, enabled }: ToggleAutomationInput,
): Promise<Automation> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const before = await ownRule(tx, { workspaceId: access.workspace.id, projectId: access.project.id }, id);
		const row = before.enabled === enabled ? before : await repo.setEnabled(tx, id, enabled);
		if (before.enabled !== enabled) {
			await recordActivity(tx, access, { kind: "automation.updated", data: { id, name: row.name, enabled } });
		}
		return repo.automationDto(row);
	});
}

/** Deletes a rule for good, with its run log. */
export async function deleteAutomation(
	{ db, user }: TasklineServices,
	{ ws, key, id }: { ws: string; key: string; id: string },
): Promise<void> {
	await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const row = await ownRule(tx, { workspaceId: access.workspace.id, projectId: access.project.id }, id);
		await repo.deleteAutomation(tx, id);
		await recordActivity(tx, access, { kind: "automation.deleted", data: { id, name: row.name } });
	});
}

/** The builder's preview over the project's open tasks. */
export async function previewAutomation(
	{ db, user }: TasklineServices,
	{ ws, key, conditions }: PreviewAutomationInput,
): Promise<AutomationPreview> {
	const access = await resolveProject(db, user, ws, key);
	assertCan(access, "manage");
	const fields = (await fieldRepo.listFields(db, access.workspace.id, access.project.id)).map(fieldRepo.fieldDto);
	return previewCount(db, { workspaceId: access.workspace.id, projectId: access.project.id }, conditions, {
		fields,
		timeZone: access.settings.timeZone,
	});
}
