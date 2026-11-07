import "@tanstack/react-start/server-only";
import type { TasklineMember, WorkspaceSummary, WorkspaceView } from "@/features/taskline/types";
import { todayInZone } from "@/lib/i18n/date-only";
import { getLocale } from "@/paraglide/runtime";
import { resolveWorkspace, type TasklineServices } from "../access";
import { seedSandbox } from "../sandbox";
import * as repo from "./repository";

/**
 * Workspaces and members from the app's side (decision 0203): which workspaces the
 * caller has, one of them with the caller's place in it, a sandbox on request, and
 * the members a picker offers. Adding, changing and deactivating team members is the
 * admin's (Task 49).
 */

/** The caller's workspaces: the team (when they are on it, or hold a `taskline:` permission) and their sandbox. */
export async function listWorkspaces({ db, user }: TasklineServices): Promise<WorkspaceSummary[]> {
	const found: WorkspaceSummary[] = [];
	const team = user.isGuest ? null : await repo.teamWorkspace(db);
	if (team) {
		const member = await repo.memberOf(db, team.id, user.id);
		const active = member !== null && member.deactivatedAt === null;
		if (active || user.permissions.some((permission) => permission.startsWith("taskline:"))) {
			found.push(repo.workspaceSummary(team));
		}
	}
	const sandbox = await repo.sandboxOf(db, user.id);
	if (sandbox) found.push(repo.workspaceSummary(sandbox));
	return found;
}

export async function getWorkspace({ db, user }: TasklineServices, ws: string): Promise<WorkspaceView> {
	const access = await resolveWorkspace(db, user, ws);
	return {
		workspace: repo.workspaceSummary(access.workspace),
		me: access.member ? repo.memberDto(access.member) : null,
		canCreateProject: access.canCreateProject,
		calendar: {
			workingDays: access.settings.workingDays,
			weekStart: access.settings.weekStart,
			timeZone: access.settings.timeZone,
		},
		today: todayInZone(access.settings.timeZone),
	};
}

/**
 * The caller's sandbox, seeded with sample work in their language (as a guest's):
 * for an account that wants to try things away from the team. Returns the existing
 * one when they already have it.
 */
export async function startSandbox({ db, user }: TasklineServices): Promise<WorkspaceSummary> {
	const workspace = await db.transaction((tx) => seedSandbox(tx, user.id, getLocale()));
	return repo.workspaceSummary(workspace);
}

/** The workspace's active members, for pickers (placeholders included). */
export async function listMembers({ db, user }: TasklineServices, ws: string): Promise<TasklineMember[]> {
	const access = await resolveWorkspace(db, user, ws);
	return (await repo.listMembers(db, access.workspace.id)).map(repo.memberDto);
}
