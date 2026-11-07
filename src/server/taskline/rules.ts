import "@tanstack/react-start/server-only";
import { SANDBOX_QUOTAS, type TasklineQuotas } from "@/features/taskline/types";
import { AppError, type AppErrorCode, ruleError } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { richTextToText, sanitizeRichText } from "@/server/rich-text/sanitize";
import type { WorkspaceAccess } from "./access";

/** Rules every Taskline service shares: quotas, the errors members read, rich text. */

/** A sandbox's fixed limits, or the team's from its settings. */
export const quotasOf = (access: WorkspaceAccess): TasklineQuotas =>
	access.workspace.kind === "sandbox" ? SANDBOX_QUOTAS : access.settings.quotas;

/** The advisory lock's scope for a workspace's counts (`lockQuota`). */
export const quotaScope = (workspaceId: string) => `taskline:${workspaceId}`;

export const quotaError = (what: "projects" | "tasks" | "statuses" | "timeEntries", max: number) =>
	ruleError(
		"CONFLICT",
		`Taskline quota reached: ${what}`,
		what === "projects"
			? m.taskline_quota_projects({ max: formatNumber(max) })
			: what === "tasks"
				? m.taskline_quota_tasks({ max: formatNumber(max) })
				: what === "timeEntries"
					? m.taskline_quota_time({ max: formatNumber(max) })
					: m.taskline_quota_statuses({ max: formatNumber(max) }),
	);

/** Something only a workspace's member can do (an admin reading as `taskline:read` isn't one). */
export const notMemberError = () => ruleError("FORBIDDEN", "Taskline: not a member", m.taskline_error_not_member());

/** A description from the editor: sanitized HTML and its plain text (what search indexes). */
export const richText = (html: string | undefined) => {
	const safe = sanitizeRichText(html ?? "");
	return { html: safe as string, text: richTextToText(safe) };
};

/** A refusal about one field of a form (`field` is its name), shown under it. */
export const fieldError = (code: AppErrorCode, field: string, message: string) =>
	new AppError(code, `Taskline: ${field} refused`, { fieldErrors: { [field]: [message] } });
