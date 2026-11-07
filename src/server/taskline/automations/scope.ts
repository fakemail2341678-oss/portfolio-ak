import "@tanstack/react-start/server-only";
import { workspaceSettings } from "@/features/taskline/settings";
import type { TlProjectRow, TlWorkspaceRow } from "@/server/db/schema";
import type { ProjectAccess } from "../access";

/**
 * A project as the daily job acts in it (Task 56): nobody's access, so no member and no
 * admin, with every right the job's own work needs. It's never handed to a member's
 * request; only the cron's steps build it.
 */
export function systemAccess(workspace: TlWorkspaceRow, project: TlProjectRow): ProjectAccess {
	return {
		workspace,
		settings: workspaceSettings.parse(workspace.settings),
		member: null,
		sandboxOwner: false,
		admin: null,
		canCreateProject: false,
		project,
		projectRole: null,
		can: { view: true, comment: true, edit: true, manage: false, logTime: false },
	};
}
