import "@tanstack/react-start/server-only";
import { and, asc, count, eq, isNull, max, sql } from "drizzle-orm";
import type {
	AdminWorkflows,
	AdminWorkspace,
	UpdateWorkflowsInput,
	UpdateWorkspaceInput,
} from "@/features/taskline/admin/schema";
import { RESERVED_SLUGS, type StoredWorkspaceSettings, workspaceSettings } from "@/features/taskline/settings";
import type { TasklineColor } from "@/features/taskline/types";
import { AppError, type FieldErrors } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { changes } from "@/server/audit/record";
import { notFound, uniqueViolation, withAudit } from "@/server/db/crud";
import { tlLabel, tlProject, tlStatus, tlTask, tlTaskLabel, tlTimeEntry, tlWorkspace } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { Services } from "@/server/services";
import * as projectRepo from "../projects/repository";
import { defaultStatusNames } from "../projects/service";
import { saveVersioned } from "../rev";
import { fieldError } from "../rules";
import * as workflowRepo from "../workflow/repository";
import { bumpRevs, type Team, team } from "./team";

/**
 * /admin/taskline/settings and /workflows (PLAN 11.5): the team workspace's name, URL
 * segment and `workspaceSettings`, saved from the version the form started at (a stale
 * save is a CONFLICT); the statuses new projects start with, the task types offered,
 * and the workspace-wide labels every project shares.
 */

const isTimeZone = (zone: string) => {
	try {
		new Intl.DateTimeFormat("en", { timeZone: zone });
		return true;
	} catch {
		return false;
	}
};

/** What exists now: the quotas can't be set below it. */
async function usage(db: Db, workspaceId: string) {
	const [[projects], [tasks], [statuses], [entries]] = await Promise.all([
		db.select({ total: count() }).from(tlProject).where(eq(tlProject.workspaceId, workspaceId)),
		db.select({ total: count() }).from(tlTask).where(eq(tlTask.workspaceId, workspaceId)),
		db.select({ most: max(sql<number>`per_project.total`) }).from(
			db
				.select({ total: count().as("total") })
				.from(tlStatus)
				.innerJoin(tlProject, eq(tlProject.id, tlStatus.projectId))
				.where(eq(tlProject.workspaceId, workspaceId))
				.groupBy(tlStatus.projectId)
				.as("per_project"),
		),
		db.select({ total: count() }).from(tlTimeEntry).where(eq(tlTimeEntry.workspaceId, workspaceId)),
	]);
	return {
		projects: projects?.total ?? 0,
		tasks: tasks?.total ?? 0,
		statusesPerProject: Number(statuses?.most ?? 0),
		timeEntries: entries?.total ?? 0,
	};
}

function view({ workspace, settings }: Team, used: AdminWorkspace["usage"]): AdminWorkspace {
	return {
		id: workspace.id,
		name: workspace.name,
		slug: workspace.slug,
		updatedAt: String(workspace.version),
		settings: {
			projectCreation: settings.projectCreation,
			defaultVisibility: settings.defaultVisibility,
			membersCanJoin: settings.membersCanJoin,
			workingDays: settings.workingDays,
			weekStart: settings.weekStart,
			timeZone: settings.timeZone,
			digestHour: settings.digestHour,
			notify: settings.notify,
			trashRetentionDays: settings.trashRetentionDays,
			doneColumnDays: settings.doneColumnDays,
			quotas: settings.quotas,
		},
		usage: used,
	};
}

export async function getWorkspace({ db }: Pick<Services, "db">): Promise<AdminWorkspace> {
	const found = await team(db);
	return view(found, await usage(db, found.workspace.id));
}

const SETTINGS_AUDITED = ["name", "slug", "settings"] as const;

export async function updateWorkspace(
	{ db, actor }: Services,
	{ updatedAt, name, slug, settings }: UpdateWorkspaceInput,
): Promise<AdminWorkspace> {
	return withAudit(db, actor, async (tx, audit) => {
		const before = await team(tx);
		// Keyed by the settings form's field names, so each refusal shows under its field.
		const fields: Record<string, string[]> = {};
		if (RESERVED_SLUGS.includes(slug)) fields.slug = [m.taskline_admin_error_slug_reserved({ slug })];
		if (!isTimeZone(settings.timeZone)) fields.timeZone = [m.taskline_admin_error_time_zone()];
		const used = await usage(tx, before.workspace.id);
		for (const key of ["projects", "tasks", "statusesPerProject", "timeEntries"] as const) {
			if (settings.quotas[key] < used[key]) {
				fields[key] = [m.taskline_admin_error_quota({ used: formatNumber(used[key]) })];
			}
		}
		if (Object.keys(fields).length > 0) {
			throw new AppError("BAD_REQUEST", "Taskline settings refused", { fieldErrors: fields as FieldErrors });
		}
		const stored: StoredWorkspaceSettings = { ...before.workspace.settings, ...settings };
		// Parsing proves the stored object is whole; the row keeps only what it was given.
		workspaceSettings.parse(stored);
		const saved = await saveVersioned(tx, tlWorkspace, {
			id: before.workspace.id,
			version: Number(updatedAt),
			what: "Workspace",
			set: { name, slug, settings: stored },
		});
		const after = { workspace: saved, settings: workspaceSettings.parse(saved.settings) };
		const changed = changes(
			{ name: before.workspace.name, slug: before.workspace.slug, settings: JSON.stringify(before.settings) },
			{ name: saved.name, slug: saved.slug, settings: JSON.stringify(after.settings) },
			SETTINGS_AUDITED,
			["name", "slug"],
		);
		if (changed) {
			audit({
				action: "taskline.settings.update",
				target: { type: "taskline-workspace", id: saved.id, label: saved.name },
				...changed,
			});
		}
		return view(after, used);
	});
}

async function workspaceLabels(db: Db, workspaceId: string) {
	const [labels, counts] = await Promise.all([
		db
			.select()
			.from(tlLabel)
			.where(and(eq(tlLabel.workspaceId, workspaceId), isNull(tlLabel.projectId)))
			.orderBy(asc(sql`lower(${tlLabel.name})`)),
		db
			.select({ labelId: tlTaskLabel.labelId, total: count() })
			.from(tlTaskLabel)
			.innerJoin(tlLabel, eq(tlLabel.id, tlTaskLabel.labelId))
			.innerJoin(tlTask, eq(tlTask.id, tlTaskLabel.taskId))
			.where(and(eq(tlLabel.workspaceId, workspaceId), isNull(tlLabel.projectId), isNull(tlTask.deletedAt)))
			.groupBy(tlTaskLabel.labelId),
	]);
	const perLabel = new Map(counts.map((row) => [row.labelId, row.total]));
	return labels.map((label) => ({ ...workflowRepo.labelDto(label), tasks: perLabel.get(label.id) ?? 0 }));
}

function workflowsView({ workspace, settings }: Team, labels: AdminWorkflows["labels"]): AdminWorkflows {
	const builtIn = (() => {
		const names = defaultStatusNames();
		return projectRepo.DEFAULT_STATUSES.map((status, index) => ({ ...status, name: names[index] ?? status.category }));
	})();
	return {
		updatedAt: String(workspace.version),
		statuses: settings.defaultStatuses ?? builtIn,
		custom: settings.defaultStatuses !== null,
		taskTypes: settings.taskTypes,
		labels,
	};
}

export async function getWorkflows({ db }: Pick<Services, "db">): Promise<AdminWorkflows> {
	const found = await team(db);
	return workflowsView(found, await workspaceLabels(db, found.workspace.id));
}

/** New projects' statuses (at least one open and one completed) and the task types offered. */
export async function updateWorkflows(
	{ db, actor }: Services,
	{ updatedAt, statuses, taskTypes }: UpdateWorkflowsInput,
): Promise<AdminWorkflows> {
	return withAudit(db, actor, async (tx, audit) => {
		const before = await team(tx);
		if (statuses) {
			const open = statuses.some((status) => !["completed", "canceled"].includes(status.category));
			const done = statuses.some((status) => status.category === "completed");
			if (!open || !done) throw fieldError("BAD_REQUEST", "statuses", m.taskline_admin_error_statuses());
		}
		const stored: StoredWorkspaceSettings = { ...before.workspace.settings, defaultStatuses: statuses, taskTypes };
		const saved = await saveVersioned(tx, tlWorkspace, {
			id: before.workspace.id,
			version: Number(updatedAt),
			what: "Workspace",
			set: { settings: stored },
		});
		const after = { workspace: saved, settings: workspaceSettings.parse(saved.settings) };
		const changed = changes(
			{
				statuses: JSON.stringify(before.settings.defaultStatuses),
				taskTypes: before.settings.taskTypes.join(", "),
			},
			{ statuses: JSON.stringify(after.settings.defaultStatuses), taskTypes: after.settings.taskTypes.join(", ") },
			["statuses", "taskTypes"] as const,
			["taskTypes"],
		);
		if (changed) {
			audit({
				action: "taskline.workflows.update",
				target: { type: "taskline-workspace", id: saved.id, label: saved.name },
				...changed,
			});
		}
		return workflowsView(after, await workspaceLabels(tx, saved.id));
	});
}

const labelTaken = {
	tl_label_workspace_name_unique: { field: "name", message: m.taskline_admin_error_label_taken },
} as const;

/** Every open project's board shows workspace labels: their pages refetch (rev). */
async function touchProjects(db: Db, workspaceId: string) {
	const rows = await db
		.select({ id: tlProject.id })
		.from(tlProject)
		.where(and(eq(tlProject.workspaceId, workspaceId), isNull(tlProject.archivedAt)));
	return rows.map((row) => row.id);
}

export async function createLabel(
	{ db, actor }: Services,
	input: { name: string; color: TasklineColor },
): Promise<AdminWorkflows["labels"]> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		let created: typeof tlLabel.$inferSelect | undefined;
		try {
			[created] = await workflowRepo.insertLabels(tx, [{ workspaceId: workspace.id, projectId: null, ...input }]);
		} catch (error) {
			throw uniqueViolation(error, labelTaken);
		}
		if (!created) throw new Error("Label insert returned no row");
		audit({
			action: "taskline.label.create",
			target: { type: "taskline-label", id: created.id, label: created.name },
			after: { name: created.name, color: created.color },
		});
		await bumpRevs(tx, await touchProjects(tx, workspace.id));
		return workspaceLabels(tx, workspace.id);
	});
}

async function workspaceLabel(db: Db, workspaceId: string, id: string) {
	const [row] = await db
		.select()
		.from(tlLabel)
		.where(and(eq(tlLabel.workspaceId, workspaceId), isNull(tlLabel.projectId), eq(tlLabel.id, id)));
	if (!row) throw notFound("Label");
	return row;
}

export async function updateLabel(
	{ db, actor }: Services,
	{ id, ...input }: { id: string; name: string; color: TasklineColor },
): Promise<AdminWorkflows["labels"]> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const before = await workspaceLabel(tx, workspace.id, id);
		let after: typeof before;
		try {
			after = await workflowRepo.updateLabel(tx, id, input);
		} catch (error) {
			throw uniqueViolation(error, labelTaken);
		}
		const changed = changes(before, after, ["name", "color"] as const);
		if (changed) {
			audit({ action: "taskline.label.update", target: { type: "taskline-label", id, label: after.name }, ...changed });
			await bumpRevs(tx, await touchProjects(tx, workspace.id));
		}
		return workspaceLabels(tx, workspace.id);
	});
}

/** Deletes a workspace label; tasks lose it. */
export async function deleteLabel({ db, actor }: Services, { id }: { id: string }): Promise<AdminWorkflows["labels"]> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const label = await workspaceLabel(tx, workspace.id, id);
		await workflowRepo.deleteLabel(tx, id);
		audit({
			action: "taskline.label.delete",
			target: { type: "taskline-label", id, label: label.name },
			before: { name: label.name, color: label.color },
		});
		await bumpRevs(tx, await touchProjects(tx, workspace.id));
		return workspaceLabels(tx, workspace.id);
	});
}
