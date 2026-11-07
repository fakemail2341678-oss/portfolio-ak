import "@tanstack/react-start/server-only";
import { and, eq, isNull } from "drizzle-orm";
import { type WorkspaceSettings, workspaceSettings } from "@/features/taskline/settings";
import { type ProjectCan, type ProjectRole, SANDBOX_SEGMENT } from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { notFound } from "@/server/db/crud";
import {
	type TlMemberRow,
	type TlProjectRow,
	type TlWorkspaceRow,
	tlMember,
	tlProject,
	tlProjectMember,
	tlWorkspace,
} from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/**
 * Who may do what in Taskline (decision 0204): one resolver that every service calls
 * before anything else. A workspace or project the caller may not see is "not found"
 * (as the apps, 0187); one they may see but not change is FORBIDDEN, with a reason.
 * The table it implements is in docs/guides/taskline.md, "Access".
 */

/** The caller, as `requireTasklineUser` puts them in the context. */
export type TasklineUser = { id: string; isGuest: boolean; permissions: ReadonlyArray<string> };

/** What a Taskline service works with. Tests pass their own. */
export type TasklineServices = {
	db: Db;
	user: TasklineUser;
	imageStore?: ImageStore | null;
	/**
	 * Sends the instant emails of notifications a write produced, after its commit
	 * (Task 50). The middleware passes the real one (`waitUntil`); tests pass their
	 * own or none, and without one nothing is emailed at once (the digest still is).
	 */
	deliver?: (notificationIds: string[]) => void;
};

export type WorkspaceAccess = {
	workspace: TlWorkspaceRow;
	settings: WorkspaceSettings;
	/** The caller's active member row; null for an admin who isn't on the team. */
	member: TlMemberRow | null;
	/** The caller's own sandbox: they lead everything in it. */
	sandboxOwner: boolean;
	/** What the caller's RBAC permissions give them in the team: `taskline:manage`, `taskline:read`, or nothing. */
	admin: "manage" | "read" | null;
	canCreateProject: boolean;
};

export type ProjectAccess = WorkspaceAccess & {
	project: TlProjectRow;
	projectRole: ProjectRole | null;
	can: ProjectCan;
};

/** How much a caller may do in a project, from least to most. */
const LEVELS = ["none", "read", "comment", "edit", "manage"] as const;
type Level = (typeof LEVELS)[number];
const rank = (level: Level) => LEVELS.indexOf(level);
const highest = (levels: Level[]): Level =>
	levels.reduce<Level>((best, level) => (rank(level) > rank(best) ? level : best), "none");

const PROJECT_ROLE_LEVEL: Record<ProjectRole, Level> = { lead: "manage", member: "edit", viewer: "comment" };

const adminLevel = (permissions: ReadonlyArray<string>): WorkspaceAccess["admin"] =>
	permissions.includes("taskline:manage") ? "manage" : permissions.includes("taskline:read") ? "read" : null;

/**
 * The workspace `ws` names (the team's slug, or `sandbox` for the caller's own), with
 * the caller's place in it. NOT_FOUND when it doesn't exist or isn't theirs to see:
 * a guest or an account not on the team (nor holding a `taskline:` permission), a
 * deactivated member, someone without a sandbox.
 */
export async function resolveWorkspace(db: Db, user: TasklineUser, ws: string): Promise<WorkspaceAccess> {
	if (ws === SANDBOX_SEGMENT) {
		const [workspace] = await db
			.select()
			.from(tlWorkspace)
			.where(and(eq(tlWorkspace.kind, "sandbox"), eq(tlWorkspace.ownerId, user.id)));
		if (!workspace) throw notFound("Workspace");
		const [member] = await db
			.select()
			.from(tlMember)
			.where(and(eq(tlMember.workspaceId, workspace.id), eq(tlMember.userId, user.id)));
		return {
			workspace,
			settings: workspaceSettings.parse(workspace.settings),
			member: member ?? null,
			sandboxOwner: true,
			admin: null,
			canCreateProject: true,
		};
	}
	if (user.isGuest) throw notFound("Workspace");
	const [workspace] = await db
		.select()
		.from(tlWorkspace)
		.where(and(eq(tlWorkspace.kind, "team"), eq(tlWorkspace.slug, ws)));
	if (!workspace) throw notFound("Workspace");
	const [member] = await db
		.select()
		.from(tlMember)
		.where(and(eq(tlMember.workspaceId, workspace.id), eq(tlMember.userId, user.id), isNull(tlMember.deactivatedAt)));
	const admin = adminLevel(user.permissions);
	if (!member && !admin) throw notFound("Workspace");
	const settings = workspaceSettings.parse(workspace.settings);
	return {
		workspace,
		settings,
		member: member ?? null,
		sandboxOwner: false,
		admin,
		canCreateProject: admin === "manage" || (settings.projectCreation === "members" && member?.role === "member"),
	};
}

/**
 * What a level allows; an archived project only reads. `manage` stays true there so its
 * lead reaches the settings and can restore it; `assertCan` refuses everything else.
 */
const canAt = (level: Level, archived: boolean): ProjectCan => ({
	view: rank(level) >= rank("read"),
	comment: !archived && rank(level) >= rank("comment"),
	edit: !archived && rank(level) >= rank("edit"),
	manage: rank(level) >= rank("manage"),
	logTime: !archived && rank(level) >= rank("edit"),
});

/** The caller's level in a project of a workspace they resolved (the table in the guide). */
export function projectLevel(
	access: Pick<WorkspaceAccess, "sandboxOwner" | "admin"> & { member: Pick<TlMemberRow, "role"> | null },
	project: Pick<TlProjectRow, "visibility">,
	projectRole: ProjectRole | null,
): Level {
	const levels: Level[] = [];
	if (access.sandboxOwner || access.admin === "manage") levels.push("manage");
	if (access.admin === "read") levels.push("read");
	if (projectRole) levels.push(PROJECT_ROLE_LEVEL[projectRole]);
	if (project.visibility === "team" && access.member) levels.push(access.member.role === "member" ? "edit" : "comment");
	return highest(levels);
}

/** The project `key` of workspace `ws`, with what the caller may do in it; NOT_FOUND unless they may see it. */
export async function resolveProject(db: Db, user: TasklineUser, ws: string, key: string): Promise<ProjectAccess> {
	const access = await resolveWorkspace(db, user, ws);
	const [project] = await db
		.select()
		.from(tlProject)
		.where(and(eq(tlProject.workspaceId, access.workspace.id), eq(tlProject.key, key)));
	if (!project) throw notFound("Project");
	return projectAccess(db, access, project);
}

/** `resolveProject` for a project row already read in the caller's workspace. */
export async function projectAccess(db: Db, access: WorkspaceAccess, project: TlProjectRow): Promise<ProjectAccess> {
	let projectRole: ProjectRole | null = null;
	if (access.member) {
		const [row] = await db
			.select({ role: tlProjectMember.role })
			.from(tlProjectMember)
			.where(and(eq(tlProjectMember.projectId, project.id), eq(tlProjectMember.memberId, access.member.id)));
		projectRole = row?.role ?? null;
	}
	const level = projectLevel(access, project, projectRole);
	if (level === "none") throw notFound("Project");
	return { ...access, project, projectRole, can: canAt(level, project.archivedAt !== null) };
}

/**
 * Refuses what the caller may see but not do: FORBIDDEN, with why (an archived
 * project, or a read-only role).
 */
export function assertCan(access: ProjectAccess, action: Exclude<keyof ProjectCan, "view">): void {
	if (access.project.archivedAt) {
		throw ruleError("FORBIDDEN", `Project archived: ${action}`, m.taskline_error_archived());
	}
	if (!access.can[action]) throw ruleError("FORBIDDEN", `Taskline: cannot ${action}`, m.taskline_error_read_only());
}

/** Archiving or restoring: the one change `manage` still allows on an archived project. */
export function assertCanArchive(access: ProjectAccess): void {
	if (!access.can.manage) throw ruleError("FORBIDDEN", "Taskline: cannot manage", m.taskline_error_read_only());
}
