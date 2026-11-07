import { fn } from "storybook/test";
import type { AdminTemplates, SavedProjectTemplate } from "../../../../src/features/taskline/admin/schema";
import type { TemplateChoice } from "../../../../src/features/taskline/types";
import { sampleTemplateChoices } from "../../taskline";

// Stand-ins for src/functions/taskline-admin/templates.ts.
const definition = {
	statuses: [
		{
			id: "00000000-0000-4000-8000-000000000001",
			name: "To do",
			category: "unstarted" as const,
			color: "blue" as const,
			wipLimit: null,
		},
		{
			id: "00000000-0000-4000-8000-000000000002",
			name: "Done",
			category: "completed" as const,
			color: "green" as const,
			wipLimit: null,
		},
	],
	labels: [],
	fields: [],
	automations: [],
	settings: {
		sprints: false,
		time: true,
		estimation: "points" as const,
		blockCompletionWhileBlocked: false,
		doneColumnDays: null,
	},
	milestones: [],
	tasks: [],
};

export const sampleAdminTemplates: AdminTemplates = {
	builtins: [
		{
			id: "scrum",
			name: "Scrum software",
			description: "Sprints and a backlog.",
			builtin: true,
			version: 0,
			updatedAt: null,
			definition,
		},
	],
	templates: [
		{
			id: "72000000-0000-4000-8000-000000000001",
			name: "Website launch",
			description: "Design, build and launch.",
			builtin: false,
			version: 1,
			updatedAt: "2026-10-30T10:00:00.000Z",
			definition,
		},
	],
};

export const listTasklineAdminTemplates = fn(async (): Promise<AdminTemplates> => sampleAdminTemplates).mockName(
	"listTasklineAdminTemplates",
);
export const createTasklineAdminTemplate = fn(async (): Promise<AdminTemplates> => sampleAdminTemplates).mockName(
	"createTasklineAdminTemplate",
);
export const updateTasklineAdminTemplate = fn(async (): Promise<AdminTemplates> => sampleAdminTemplates).mockName(
	"updateTasklineAdminTemplate",
);
export const deleteTasklineAdminTemplate = fn(async (): Promise<AdminTemplates> => sampleAdminTemplates).mockName(
	"deleteTasklineAdminTemplate",
);
export const saveTasklineProjectAsTemplate = fn(
	async (): Promise<SavedProjectTemplate> => ({ id: "t", name: "Website", leftOut: 0 }),
).mockName("saveTasklineProjectAsTemplate");
export const listTasklineAdminTemplateChoices = fn(
	async (): Promise<TemplateChoice[]> => sampleTemplateChoices,
).mockName("listTasklineAdminTemplateChoices");
