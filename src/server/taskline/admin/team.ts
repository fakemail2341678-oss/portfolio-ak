import "@tanstack/react-start/server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { type WorkspaceSettings, workspaceSettings } from "@/features/taskline/settings";
import type { ActivityData, ActivityKind } from "@/features/taskline/types";
import type { AuditEntry } from "@/server/audit/record";
import { notFound } from "@/server/db/crud";
import { type TlProjectRow, type TlWorkspaceRow, tlActivity, tlProject } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import type { Services } from "@/server/services";
import type { TasklineServices, TasklineUser } from "../access";
import * as members from "../workspace/repository";

/**
 * What every admin service shares (PLAN 11.5, "Functions"): the team workspace, the
 * admin as a Taskline caller, and the audit targets. The admin runs the team only;
 * sandboxes are their owners'.
 */

/** The admin as Taskline sees them: their RBAC permissions make them a reader or lead-equivalent (0204). */
export const tasklineUserOf = (actor: Services["actor"]): TasklineUser => ({
	id: actor.id,
	isGuest: false,
	permissions: actor.permissions,
});

/** An app service called from an admin one, inside its transaction (a nested one is a savepoint). */
export const appServices = (tx: Tx, actor: Services["actor"]): TasklineServices => ({
	db: tx,
	user: tasklineUserOf(actor),
});

export type Team = { workspace: TlWorkspaceRow; settings: WorkspaceSettings };

/** The team workspace and its settings (Task 46's migration creates it). */
export async function team(db: Db): Promise<Team> {
	const workspace = await members.teamWorkspace(db);
	if (!workspace) throw notFound("Workspace");
	return { workspace, settings: workspaceSettings.parse(workspace.settings) };
}

/** A team project by id; another workspace's (a sandbox's) is not found. */
export async function teamProject(db: Db, workspaceId: string, id: string): Promise<TlProjectRow> {
	const [row] = await db
		.select()
		.from(tlProject)
		.where(and(eq(tlProject.workspaceId, workspaceId), eq(tlProject.id, id)));
	if (!row) throw notFound("Project");
	return row;
}

/** Activity the admin caused outside a project service (reassigning a deactivated member's tasks, an invitation accepted). */
export async function recordTeamActivity(
	tx: Tx,
	entries: ReadonlyArray<{
		workspaceId: string;
		projectId: string;
		taskId?: string | null;
		actorId: string | null;
		kind: ActivityKind;
		data: ActivityData;
	}>,
): Promise<void> {
	if (entries.length === 0) return;
	await tx.insert(tlActivity).values(
		entries.map((entry) => ({
			...entry,
			taskId: entry.taskId ?? null,
			data: entry.actorId ? entry.data : { ...entry.data, via: "admin" },
		})),
	);
}

/** Bumps `rev` of the given projects, so their open pages refetch (decision 0209). */
export async function bumpRevs(tx: Tx, projectIds: ReadonlyArray<string>): Promise<void> {
	if (projectIds.length === 0) return;
	await tx
		.update(tlProject)
		// Bookkeeping: `updated_at` stays (as bumpRev's, src/server/taskline/rev.ts).
		.set({ rev: sql`${tlProject.rev} + 1`, updatedAt: sql`${tlProject.updatedAt}` })
		.where(inArray(tlProject.id, [...projectIds]));
}

export const projectTarget = (project: Pick<TlProjectRow, "id" | "key" | "name">): AuditEntry["target"] => ({
	type: "taskline-project",
	id: project.id,
	label: `${project.key} · ${project.name}`,
});

export const memberTarget = (member: { id: string; displayName: string }): AuditEntry["target"] => ({
	type: "taskline-member",
	id: member.id,
	label: member.displayName,
});
