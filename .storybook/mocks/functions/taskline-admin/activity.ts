import { fn } from "storybook/test";
import type { AdminActivityOptions, AdminActivityPage } from "../../../../src/features/taskline/admin/schema";

// Stand-ins for src/functions/taskline-admin/activity.ts.
export const listTasklineActivity = fn(
	async (_options: { data: unknown }): Promise<AdminActivityPage> => ({
		items: [],
		total: 0,
		page: 1,
		pageCount: 1,
		members: [],
		statuses: [],
	}),
).mockName("listTasklineActivity");
export const getTasklineActivityOptions = fn(
	async (): Promise<AdminActivityOptions> => ({
		projects: [{ id: "11111111-1111-4111-8111-111111111111", key: "WEB", name: "Website relaunch" }],
		members: [{ id: "55555555-5555-4555-8555-555555555551", name: "Sita Sharma" }],
	}),
).mockName("getTasklineActivityOptions");
