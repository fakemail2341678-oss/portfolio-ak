import { fn } from "storybook/test";
import type { TasklineMember, WorkspaceSummary, WorkspaceView } from "../../../../src/features/taskline/types";
import { sampleProjectTasks } from "../../taskline";

// Stand-ins for src/functions/taskline/workspaces.ts.
const team: WorkspaceSummary = { id: "ws-team", kind: "team", slug: "team", name: "Himal Studio", segment: "team" };
export const getTasklineWorkspace = fn(
	async (): Promise<WorkspaceView> => ({
		workspace: team,
		me: sampleProjectTasks.members[0] ?? null,
		canCreateProject: true,
		calendar: { workingDays: [0, 1, 2, 3, 4, 5], weekStart: 0, timeZone: "Asia/Kathmandu" },
		today: sampleProjectTasks.today,
	}),
).mockName("getTasklineWorkspace");
export const startTasklineSandbox = fn(
	async (): Promise<WorkspaceSummary> => ({
		...team,
		id: "ws-sandbox",
		kind: "sandbox",
		slug: "sandbox",
		segment: "sandbox",
	}),
).mockName("startTasklineSandbox");
export const listTasklineMembers = fn(async (): Promise<TasklineMember[]> => sampleProjectTasks.members).mockName(
	"listTasklineMembers",
);
