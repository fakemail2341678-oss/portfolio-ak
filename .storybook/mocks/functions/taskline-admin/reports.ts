import { fn } from "storybook/test";
import type { AdminReports } from "../../../../src/features/taskline/admin/schema";

// Stand-ins for src/functions/taskline-admin/reports.ts.
export const sampleAdminReports: AdminReports = {
	today: "2026-10-31",
	readAt: "2026-10-31T10:00:00.000Z",
	from: "2026-08-09",
	health: [
		{
			id: "p1",
			key: "WEB",
			name: "Website",
			color: "teal",
			status: "active",
			health: "at_risk",
			lead: "Asha Gurung",
			progress: 0.5,
			open: 6,
			overdue: 2,
			milestonesAtRisk: 1,
			lastActivityAt: "2026-10-30T10:00:00.000Z",
			update: { health: "at_risk", at: "2026-10-29T10:00:00.000Z", author: "Asha Gurung" },
			targetOn: "2026-12-01",
		},
		{
			id: "p2",
			key: "OPS",
			name: "Operations",
			color: "gray",
			status: "active",
			health: null,
			lead: null,
			progress: null,
			open: 0,
			overdue: 0,
			milestonesAtRisk: 0,
			lastActivityAt: null,
			update: null,
			targetOn: null,
		},
	],
	workload: [
		{
			memberId: "m1",
			name: "Asha Gurung",
			capacityMinutes: 2400,
			open: 5,
			overdue: 1,
			estimateMinutes: 3600,
			dueSoonMinutes: 2880,
		},
		{
			memberId: "m2",
			name: "Bikash Rai",
			capacityMinutes: 2400,
			open: 2,
			overdue: 0,
			estimateMinutes: 600,
			dueSoonMinutes: 240,
		},
	],
	timeByProject: [{ id: "p1", label: "WEB Website", minutes: 1200, billableMinutes: 300 }],
	timeByMember: [{ id: "m1", label: "Asha Gurung", minutes: 1200, billableMinutes: 300 }],
};

export const getTasklineAdminReports = fn(async (): Promise<AdminReports> => sampleAdminReports).mockName(
	"getTasklineAdminReports",
);
