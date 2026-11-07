import { fn } from "storybook/test";
import type { AdminAutomations } from "../../../../src/features/taskline/admin/schema";
import type { AutomationPreview } from "../../../../src/features/taskline/types";
import { sampleAutomationRuns, sampleProjectTasks, sampleWorkspaceAutomation } from "../../taskline";

// Stand-ins for src/functions/taskline-admin/automations.ts.
export const sampleTasklineAutomations: AdminAutomations = {
	ws: "team",
	automations: [sampleWorkspaceAutomation],
	runs: sampleAutomationRuns,
	labels: [],
	members: sampleProjectTasks.members,
	fields: sampleProjectTasks.fields.filter((field) => field.projectId === null),
	readAt: "2026-10-31T10:00:00.000Z",
};

export const listTasklineWorkspaceAutomations = fn(
	async (): Promise<AdminAutomations> => sampleTasklineAutomations,
).mockName("listTasklineWorkspaceAutomations");
export const createTasklineWorkspaceAutomation = fn(
	async (): Promise<AdminAutomations> => sampleTasklineAutomations,
).mockName("createTasklineWorkspaceAutomation");
export const updateTasklineWorkspaceAutomation = fn(
	async (): Promise<AdminAutomations> => sampleTasklineAutomations,
).mockName("updateTasklineWorkspaceAutomation");
export const toggleTasklineWorkspaceAutomation = fn(
	async (): Promise<AdminAutomations> => sampleTasklineAutomations,
).mockName("toggleTasklineWorkspaceAutomation");
export const deleteTasklineWorkspaceAutomation = fn(
	async (): Promise<AdminAutomations> => sampleTasklineAutomations,
).mockName("deleteTasklineWorkspaceAutomation");
export const previewTasklineWorkspaceAutomation = fn(
	async (): Promise<AutomationPreview> => ({ count: 37, capped: false }),
).mockName("previewTasklineWorkspaceAutomation");
