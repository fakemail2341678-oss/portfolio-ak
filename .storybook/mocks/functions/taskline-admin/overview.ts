import { fn } from "storybook/test";
import type { AdminOverview } from "../../../../src/features/taskline/admin/schema";
import { addDays } from "../../../../src/lib/i18n/date-only";

// Stand-ins for src/functions/taskline-admin/overview.ts.
export const sampleTasklineOverview: AdminOverview = {
	stats: { activeProjects: 3, openTasks: 42, overdueTasks: 5, doneThisWeek: 9 },
	weeks: Array.from({ length: 12 }, (_, index) => ({
		week: addDays("2026-08-09", index * 7),
		created: [6, 9, 4, 11, 8, 7, 12, 5, 9, 10, 6, 8][index] ?? 0,
		completed: [4, 7, 6, 8, 9, 5, 10, 7, 8, 9, 7, 9][index] ?? 0,
	})),
	projects: [
		{
			id: "11111111-1111-4111-8111-111111111111",
			key: "WEB",
			name: "Website relaunch",
			color: "teal",
			status: "active",
			health: "on_track",
			lead: "Sita Sharma",
			open: 18,
			overdue: 2,
			done: 31,
			targetOn: "2026-12-15",
		},
		{
			id: "22222222-2222-4222-8222-222222222222",
			key: "OPS",
			name: "Operations",
			color: "amber",
			status: "paused",
			health: "at_risk",
			lead: null,
			open: 24,
			overdue: 3,
			done: 12,
			targetOn: null,
		},
	],
	sandboxes: { total: 14, guests: 11, projects: 30, tasks: 410 },
	members: { active: 5, invited: 2, loggedThisWeek: 1950 },
	today: "2026-10-31",
	sprints: [
		{
			id: "s-2",
			name: "Sprint 2",
			project: { id: "p-web", key: "WEB", name: "Website relaunch", color: "teal", ws: "team", workspaceKind: "team" },
			startOn: "2026-10-24",
			endOn: "2026-11-06",
			totals: { scopePoints: 15, donePoints: 5, scopeTasks: 5, doneTasks: 2 },
			estimation: "points",
		},
	],
};

export const getTasklineOverview = fn(async (): Promise<AdminOverview> => sampleTasklineOverview).mockName(
	"getTasklineOverview",
);
