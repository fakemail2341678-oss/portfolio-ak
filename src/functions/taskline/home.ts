import { createServerFn } from "@tanstack/react-start";
import type { MyTasks, TasklineNav } from "@/features/taskline/types";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as home from "@/server/taskline/home/service";

/** What spans the caller's workspaces: the shell's navigation and Home's open tasks. */

export const getTasklineNav = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.handler(({ context }): Promise<TasklineNav> => home.getNav(context));

export const listMyTasklineTasks = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.handler(({ context }): Promise<MyTasks> => home.listMyTasks(context));
