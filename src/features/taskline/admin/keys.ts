import { createCrudKeys } from "@/lib/crud/keys";
import type { AdminActivityListInput, AdminMemberListInput, AdminProjectListInput, AdminTimeListInput } from "./search";

/** /admin/taskline's Query keys (the shared shape, src/lib/crud/keys.ts). */

const ROOT = ["taskline-admin"] as const;

/** The section's single reads: the overview, pickers, invitations, settings and workflows. */
export const tasklineAdminKeys = {
	all: ROOT,
	overview: () => [...ROOT, "overview"] as const,
	memberOptions: () => [...ROOT, "member-options"] as const,
	invitations: () => [...ROOT, "invitations"] as const,
	workspace: () => [...ROOT, "workspace"] as const,
	workflows: () => [...ROOT, "workflows"] as const,
	/** Task 55: the workspace's custom fields. */
	fields: () => [...ROOT, "fields"] as const,
	/** Task 56: the workspace's automations and the team's runs, and the builder's preview. */
	automations: () => [...ROOT, "automations"] as const,
	automationPreview: () => [...ROOT, "automation-preview"] as const,
	/** Task 57: the team's templates, what its "New project" offers, and the reports. */
	templates: () => [...ROOT, "templates"] as const,
	templateChoices: () => [...ROOT, "template-choices"] as const,
	reports: (range: string) => [...ROOT, "reports", { range }] as const,
	activityOptions: () => [...ROOT, "activity-options"] as const,
	accounts: () => [...ROOT, "accounts"] as const,
	/** Task 53: the timesheets' choices and lock, and utilization over some days. */
	timeOptions: () => [...ROOT, "time-options"] as const,
	utilization: (from: string, to: string) => [...ROOT, "utilization", { from, to }] as const,
};

export const adminProjectKeys = createCrudKeys<AdminProjectListInput>("taskline-admin-projects");
export const adminMemberKeys = createCrudKeys<AdminMemberListInput>("taskline-admin-members");
export const adminActivityKeys = createCrudKeys<AdminActivityListInput>("taskline-admin-activity");
export const adminTimeKeys = createCrudKeys<AdminTimeListInput>("taskline-admin-time");

/** What a change to the team can move: every list and read of the section. */
export const ALL_TASKLINE_ADMIN = [
	tasklineAdminKeys.all,
	adminProjectKeys.all,
	adminMemberKeys.all,
	adminActivityKeys.all,
	adminTimeKeys.all,
] as const;
