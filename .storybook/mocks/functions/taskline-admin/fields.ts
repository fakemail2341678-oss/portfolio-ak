import { fn } from "storybook/test";
import type { AdminFields } from "../../../../src/features/taskline/admin/schema";
import { sampleFields } from "../../taskline";

// Stand-ins for src/functions/taskline-admin/fields.ts.
export const sampleTasklineFields: AdminFields = {
	fields: [
		{ ...(sampleFields[0] as AdminFields["fields"][number]), tasks: 12 },
		{
			id: "0f1e5e00-0000-4000-8000-000000000009",
			projectId: null,
			name: "Customer",
			type: "text",
			options: [],
			required: false,
			position: "a1",
			archived: true,
			tasks: 3,
		},
	],
};

export const listTasklineWorkspaceFields = fn(async (): Promise<AdminFields> => sampleTasklineFields).mockName(
	"listTasklineWorkspaceFields",
);
export const createTasklineWorkspaceField = fn(async (): Promise<AdminFields> => sampleTasklineFields).mockName(
	"createTasklineWorkspaceField",
);
export const updateTasklineWorkspaceField = fn(async (): Promise<AdminFields> => sampleTasklineFields).mockName(
	"updateTasklineWorkspaceField",
);
export const deleteTasklineWorkspaceField = fn(async (): Promise<AdminFields> => sampleTasklineFields).mockName(
	"deleteTasklineWorkspaceField",
);
