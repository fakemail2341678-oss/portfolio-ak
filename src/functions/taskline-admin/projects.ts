import { createServerFn } from "@tanstack/react-start";
import {
	type AdminProjectDetail,
	type AdminProjectPage,
	adminArchiveProjectInputSchema,
	adminCreateProjectInputSchema,
	adminDeleteProjectInputSchema,
	adminExportProjectInputSchema,
	adminProjectMemberInputSchema,
	adminProjectStateInputSchema,
	adminRemoveProjectMemberInputSchema,
	adminTransferLeadInputSchema,
	adminUpdateProjectInputSchema,
	type ProjectExport,
	projectKeyInputSchema,
} from "@/features/taskline/admin/schema";
import { adminProjectList } from "@/features/taskline/admin/search";
import { zodInput } from "@/functions/_lib/validator";
import { idSchema } from "@/lib/crud/schema";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as projects from "@/server/taskline/admin/projects";

/**
 * /admin/taskline/projects: every team project. Reads take `taskline:read`, changes
 * `taskline:manage`; each change runs the app's own rules and is audited.
 */

export const listTasklineAdminProjects = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:read"), withServices])
	.validator(zodInput(adminProjectList.input))
	.handler(({ data, context }): Promise<AdminProjectPage> => projects.list(context, data));

export const getTasklineAdminProject = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:read"), withServices])
	.validator(zodInput(idSchema))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.get(context, data.id));

/** Whether a key is free (not taken, never retired): the create form checks while typing. */
export const isTasklineProjectKeyFree = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(projectKeyInputSchema))
	.handler(({ data, context }): Promise<boolean> => projects.isKeyFree(context, data.key));

export const createTasklineAdminProject = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminCreateProjectInputSchema))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.create(context, data));

export const updateTasklineAdminProject = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminUpdateProjectInputSchema))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.update(context, data));

export const setTasklineAdminProjectState = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminProjectStateInputSchema))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.setState(context, data));

export const setTasklineAdminProjectArchived = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminArchiveProjectInputSchema))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.setArchived(context, data));

export const transferTasklineProjectLead = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminTransferLeadInputSchema))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.transferLead(context, data));

/** Deletes a project for good, once its key is typed again; the key is retired. */
export const deleteTasklineAdminProject = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminDeleteProjectInputSchema))
	.handler(({ data, context }): Promise<void> => projects.remove(context, data));

export const exportTasklineAdminProject = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:read"), withServices])
	.validator(zodInput(adminExportProjectInputSchema))
	.handler(({ data, context }): Promise<ProjectExport> => projects.exportProject(context, data));

export const setTasklineAdminProjectMember = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminProjectMemberInputSchema))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.setMember(context, data));

export const removeTasklineAdminProjectMember = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminRemoveProjectMemberInputSchema))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.removeMember(context, data));
