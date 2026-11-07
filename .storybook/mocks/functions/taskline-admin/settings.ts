import { fn } from "storybook/test";
import type { AdminWorkflows, AdminWorkspace } from "../../../../src/features/taskline/admin/schema";

// Stand-ins for src/functions/taskline-admin/settings.ts.
export const sampleTasklineWorkspace: AdminWorkspace = {
	id: "33333333-3333-4333-8333-333333333333",
	name: "Himal Studio",
	slug: "team",
	updatedAt: "3",
	settings: {
		projectCreation: "admins",
		defaultVisibility: "team",
		membersCanJoin: true,
		workingDays: [0, 1, 2, 3, 4, 5],
		weekStart: 0,
		timeZone: "Asia/Kathmandu",
		digestHour: 7,
		trashRetentionDays: 30,
		doneColumnDays: 14,
		quotas: { projects: 500, tasks: 200_000, statusesPerProject: 50, timeEntries: 1_000_000 },
	},
	usage: { projects: 3, tasks: 96, statusesPerProject: 6 },
};

export const sampleTasklineWorkflows: AdminWorkflows = {
	updatedAt: "3",
	custom: false,
	statuses: [
		{ name: "Backlog", category: "backlog", color: "gray" },
		{ name: "To do", category: "unstarted", color: "blue" },
		{ name: "In progress", category: "started", color: "amber" },
		{ name: "Done", category: "completed", color: "green" },
		{ name: "Canceled", category: "canceled", color: "red" },
	],
	taskTypes: ["task", "bug", "story", "epic"],
	labels: [
		{ id: "44444444-4444-4444-8444-444444444441", name: "Urgent", color: "red", projectId: null, tasks: 4 },
		{ id: "44444444-4444-4444-8444-444444444442", name: "Customer", color: "violet", projectId: null, tasks: 9 },
	],
};

export const getTasklineWorkspace = fn(async (): Promise<AdminWorkspace> => sampleTasklineWorkspace).mockName(
	"getTasklineWorkspace",
);
export const updateTasklineWorkspace = fn(
	async (_options: { data: unknown }): Promise<AdminWorkspace> => sampleTasklineWorkspace,
).mockName("updateTasklineWorkspace");
export const getTasklineWorkflows = fn(async (): Promise<AdminWorkflows> => sampleTasklineWorkflows).mockName(
	"getTasklineWorkflows",
);
export const updateTasklineWorkflows = fn(
	async (_options: { data: unknown }): Promise<AdminWorkflows> => sampleTasklineWorkflows,
).mockName("updateTasklineWorkflows");
export const createTasklineWorkspaceLabel = fn(
	async (_options: { data: unknown }): Promise<AdminWorkflows["labels"]> => sampleTasklineWorkflows.labels,
).mockName("createTasklineWorkspaceLabel");
export const updateTasklineWorkspaceLabel = fn(
	async (_options: { data: unknown }): Promise<AdminWorkflows["labels"]> => sampleTasklineWorkflows.labels,
).mockName("updateTasklineWorkspaceLabel");
export const deleteTasklineWorkspaceLabel = fn(
	async (_options: { data: unknown }): Promise<AdminWorkflows["labels"]> => sampleTasklineWorkflows.labels,
).mockName("deleteTasklineWorkspaceLabel");
