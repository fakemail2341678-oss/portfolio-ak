import { fn } from "storybook/test";
import type { MyTasks, TasklineNav } from "../../../../src/features/taskline/types";
import { sampleProjectTasks, sampleTasklineNav } from "../../taskline";

// Stand-ins for src/functions/taskline/home.ts.
export const getTasklineNav = fn(async (): Promise<TasklineNav> => sampleTasklineNav).mockName("getTasklineNav");
export const listMyTasklineTasks = fn(
	async (): Promise<MyTasks> => ({
		tasks: [],
		today: sampleProjectTasks.today,
		weekEnd: sampleProjectTasks.today,
		sprints: [],
	}),
).mockName("listMyTasklineTasks");
