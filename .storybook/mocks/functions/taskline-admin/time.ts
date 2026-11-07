import { fn } from "storybook/test";
import type {
	AdminTimeOptions,
	AdminTimePage,
	AdminUtilization,
	ProjectExport,
} from "../../../../src/features/taskline/admin/schema";
import type { TimeEntry } from "../../../../src/features/taskline/types";
import { sampleTaskDetail } from "../../taskline";

// Stand-ins for src/functions/taskline-admin/time.ts.
const entries = sampleTaskDetail.time.entries;
export const listTasklineTimeEntries = fn(
	async (_options: { data: unknown }): Promise<AdminTimePage> => ({
		items: entries.map((entry) => ({ ...entry, canEdit: true })),
		total: entries.length,
		page: 1,
		pageCount: 1,
		totalMinutes: 270,
		billableMinutes: 90,
	}),
).mockName("listTasklineTimeEntries");
export const getTasklineTimeOptions = fn(
	async (): Promise<AdminTimeOptions> => ({
		members: [
			{ id: "m-asha", name: "Asha Gurung" },
			{ id: "m-bikash", name: "Bikash Thapa" },
		],
		projects: [{ id: "p-web", key: "WEB", name: "Website relaunch" }],
		lockOn: "2026-10-25",
		today: "2026-10-31",
		weekStart: 0,
	}),
).mockName("getTasklineTimeOptions");
export const updateTasklineAdminTimeEntry = fn(async (): Promise<TimeEntry> => entries[0] as TimeEntry).mockName(
	"updateTasklineAdminTimeEntry",
);
export const deleteTasklineAdminTimeEntry = fn(async (): Promise<void> => undefined).mockName(
	"deleteTasklineAdminTimeEntry",
);
export const setTasklineTimesheetLock = fn(
	async (): Promise<{ lockOn: string | null }> => ({ lockOn: "2026-10-25" }),
).mockName("setTasklineTimesheetLock");
export const getTasklineUtilization = fn(
	async (): Promise<AdminUtilization> => ({
		from: "2026-10-26",
		to: "2026-11-01",
		rows: [
			{ memberId: "m-asha", name: "Asha Gurung", capacityMinutes: 2400, loggedMinutes: 1950, billableMinutes: 90 },
			{ memberId: "m-bikash", name: "Bikash Thapa", capacityMinutes: 2400, loggedMinutes: 2580, billableMinutes: 0 },
		],
	}),
).mockName("getTasklineUtilization");
export const exportTasklineTimeEntries = fn(
	async (): Promise<ProjectExport> => ({ filename: "taskline-time.csv", type: "text/csv", content: "day\n" }),
).mockName("exportTasklineTimeEntries");
