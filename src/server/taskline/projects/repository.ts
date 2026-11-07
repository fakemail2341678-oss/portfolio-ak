import "@tanstack/react-start/server-only";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { projectSettings } from "@/features/taskline/settings";
import type {
	ProjectCan,
	ProjectDetail,
	ProjectMemberView,
	ProjectRole,
	ProjectSettings,
	ProjectSummary,
	StatusCategory,
	TasklineColor,
} from "@/features/taskline/types";
import { generateKeysBetween } from "@/lib/fractional-index";
import {
	type TlProjectRow,
	type TlWorkspaceRow,
	tlMember,
	tlProject,
	tlProjectMember,
	tlRetiredKey,
	tlStar,
	tlStatus,
	tlTask,
	tlWorkspace,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/** Projects, their members and stars: plain reads and writes (rules are in ./service.ts). */

export function projectSummary(row: TlProjectRow, extra: { starred: boolean; openTasks: number }): ProjectSummary {
	return {
		id: row.id,
		key: row.key,
		name: row.name,
		color: row.color,
		icon: row.icon,
		visibility: row.visibility,
		status: row.status,
		health: row.health,
		leadId: row.leadId,
		starred: extra.starred,
		openTasks: extra.openTasks,
		archived: row.archivedAt !== null,
		updatedAt: row.updatedAt.toISOString(),
	};
}

export function projectDetail(
	row: TlProjectRow,
	extra: { starred: boolean; openTasks: number; role: ProjectRole | null; can: ProjectCan },
): ProjectDetail {
	return {
		...projectSummary(row, extra),
		description: row.descriptionHtml,
		startOn: row.startOn,
		targetOn: row.targetOn,
		settings: projectSettings.parse(row.settings),
		role: extra.role,
		can: extra.can,
		rev: row.rev,
		version: row.version,
	};
}

export async function listProjectRows(db: Db, workspaceId: string, { archived }: { archived: boolean }) {
	return db
		.select()
		.from(tlProject)
		.where(
			and(
				eq(tlProject.workspaceId, workspaceId),
				archived ? sql`${tlProject.archivedAt} is not null` : isNull(tlProject.archivedAt),
			),
		)
		.orderBy(asc(tlProject.name), asc(tlProject.key));
}

/** The member's role in each of `projectIds` they are on. */
export async function rolesOf(db: Db, memberId: string, projectIds: string[]): Promise<Map<string, ProjectRole>> {
	if (projectIds.length === 0) return new Map();
	const rows = await db
		.select({ projectId: tlProjectMember.projectId, role: tlProjectMember.role })
		.from(tlProjectMember)
		.where(and(eq(tlProjectMember.memberId, memberId), inArray(tlProjectMember.projectId, projectIds)));
	return new Map(rows.map((row) => [row.projectId, row.role]));
}

export async function starsOf(db: Db, memberId: string | null, projectIds: string[]): Promise<Set<string>> {
	if (!memberId || projectIds.length === 0) return new Set();
	const rows = await db
		.select({ projectId: tlStar.projectId })
		.from(tlStar)
		.where(and(eq(tlStar.memberId, memberId), inArray(tlStar.projectId, projectIds)));
	return new Set(rows.map((row) => row.projectId));
}

/** Open tasks (not closed, not in the trash) per project. */
export async function openTaskCounts(db: Db, projectIds: string[]): Promise<Map<string, number>> {
	if (projectIds.length === 0) return new Map();
	const rows = await db
		.select({ projectId: tlTask.projectId, total: count() })
		.from(tlTask)
		.where(and(inArray(tlTask.projectId, projectIds), isNull(tlTask.completedAt), isNull(tlTask.deletedAt)))
		.groupBy(tlTask.projectId);
	return new Map(rows.map((row) => [row.projectId, row.total]));
}

export async function countProjects(db: Db, workspaceId: string): Promise<number> {
	const [row] = await db.select({ total: count() }).from(tlProject).where(eq(tlProject.workspaceId, workspaceId));
	return row?.total ?? 0;
}

export async function projectKeys(db: Db, workspaceId: string): Promise<Set<string>> {
	const rows = await db.select({ key: tlProject.key }).from(tlProject).where(eq(tlProject.workspaceId, workspaceId));
	return new Set(rows.map((row) => row.key));
}

export type NewProject = {
	workspaceId: string;
	key: string;
	name: string;
	descriptionHtml?: string;
	descriptionText?: string;
	color?: TasklineColor;
	icon?: string;
	visibility?: TlProjectRow["visibility"];
	leadId?: string | null;
	startOn?: string | null;
	targetOn?: string | null;
	settings?: ProjectSettings;
};

export async function insertProject(tx: Tx, values: NewProject): Promise<TlProjectRow> {
	const [row] = await tx.insert(tlProject).values(values).returning();
	if (!row) throw new Error("Project insert returned no row");
	return row;
}

/** A single-field change (not the versioned form); keeps the version. */
export async function patchProject(
	tx: Tx,
	projectId: string,
	set: Partial<Pick<TlProjectRow, "status" | "health" | "archivedAt" | "leadId">>,
): Promise<TlProjectRow> {
	const [row] = await tx.update(tlProject).set(set).where(eq(tlProject.id, projectId)).returning();
	if (!row) throw new Error("Project update returned no row");
	return row;
}

/** The statuses a new project starts with: names in the caller's language, then what they mean. */
export const DEFAULT_STATUSES: ReadonlyArray<{ category: StatusCategory; color: TasklineColor }> = [
	{ category: "backlog", color: "gray" },
	{ category: "unstarted", color: "blue" },
	{ category: "started", color: "amber" },
	{ category: "completed", color: "green" },
	{ category: "canceled", color: "red" },
];

/** A new project's statuses, in order: the workspace's defaults, or DEFAULT_STATUSES named in a language. */
export async function insertStatuses(
	tx: Tx,
	projectId: string,
	statuses: ReadonlyArray<{
		id?: string;
		name: string;
		category: StatusCategory;
		color: TasklineColor;
		wipLimit?: number | null;
	}>,
) {
	const positions = generateKeysBetween(null, null, statuses.length);
	return tx
		.insert(tlStatus)
		.values(
			statuses.map((status, index) => ({
				projectId,
				...(status.id ? { id: status.id } : {}),
				name: status.name,
				category: status.category,
				color: status.color,
				wipLimit: status.wipLimit ?? null,
				position: positions[index] ?? `a${index}`,
			})),
		)
		.returning();
}

/** Whether a key was a deleted project's: keys are never handed out again (Task 49). */
export async function isKeyRetired(db: Db, workspaceId: string, key: string): Promise<boolean> {
	const [row] = await db
		.select({ key: tlRetiredKey.key })
		.from(tlRetiredKey)
		.where(and(eq(tlRetiredKey.workspaceId, workspaceId), eq(tlRetiredKey.key, key)));
	return row !== undefined;
}

export async function projectMembers(db: Db, projectId: string): Promise<ProjectMemberView[]> {
	const rows = await db
		.select({
			memberId: tlProjectMember.memberId,
			role: tlProjectMember.role,
			name: tlMember.displayName,
			userId: tlMember.userId,
		})
		.from(tlProjectMember)
		.innerJoin(tlMember, eq(tlMember.id, tlProjectMember.memberId))
		.where(and(eq(tlProjectMember.projectId, projectId), isNull(tlMember.deactivatedAt)))
		.orderBy(asc(tlMember.displayName), asc(tlMember.id));
	return rows.map((row) => ({
		memberId: row.memberId,
		name: row.name,
		role: row.role,
		placeholder: row.userId === null,
	}));
}

/** Adds the member to the project, or changes their role. */
export async function upsertProjectMember(tx: Tx, projectId: string, memberId: string, role: ProjectRole) {
	await tx
		.insert(tlProjectMember)
		.values({ projectId, memberId, role })
		.onConflictDoUpdate({ target: [tlProjectMember.projectId, tlProjectMember.memberId], set: { role } });
}

export async function deleteProjectMember(tx: Tx, projectId: string, memberId: string): Promise<boolean> {
	const rows = await tx
		.delete(tlProjectMember)
		.where(and(eq(tlProjectMember.projectId, projectId), eq(tlProjectMember.memberId, memberId)))
		.returning({ memberId: tlProjectMember.memberId });
	return rows.length > 0;
}

export async function setStar(tx: Tx, memberId: string, projectId: string, starred: boolean): Promise<void> {
	if (starred) {
		await tx.insert(tlStar).values({ memberId, projectId }).onConflictDoNothing();
	} else {
		await tx.delete(tlStar).where(and(eq(tlStar.memberId, memberId), eq(tlStar.projectId, projectId)));
	}
}

/** A project by id with its workspace, whoever's it is (the caller resolves access next). */
export async function projectWithWorkspace(
	db: Db,
	projectId: string,
): Promise<{ project: TlProjectRow; workspace: TlWorkspaceRow } | null> {
	const [row] = await db
		.select({ project: tlProject, workspace: tlWorkspace })
		.from(tlProject)
		.innerJoin(tlWorkspace, eq(tlWorkspace.id, tlProject.workspaceId))
		.where(eq(tlProject.id, projectId));
	return row ?? null;
}
