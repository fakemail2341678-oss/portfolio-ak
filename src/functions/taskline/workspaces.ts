import { createServerFn } from "@tanstack/react-start";
import { wsInput } from "@/features/taskline/schema";
import type { TasklineMember, WorkspaceSummary, WorkspaceView } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as workspaces from "@/server/taskline/workspace/service";

/**
 * Taskline's workspaces (docs/guides/taskline.md): anyone signed in, guests included
 * (`requireTasklineUser`); the service resolves what the caller may see.
 */

export const getTasklineWorkspace = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(wsInput))
	.handler(({ data, context }): Promise<WorkspaceView> => workspaces.getWorkspace(context, data.ws));

export const startTasklineSandbox = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.handler(({ context }): Promise<WorkspaceSummary> => workspaces.startSandbox(context));

export const listTasklineMembers = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(wsInput))
	.handler(({ data, context }): Promise<TasklineMember[]> => workspaces.listMembers(context, data.ws));
