import { createServerFn } from "@tanstack/react-start";
import {
	type AdminProjectDetail,
	type AdminProjectPage,
	adminArchiveProjectInput,
	adminCreateProjectInput,
	adminDeleteProjectInput,
	adminExportProjectInput,
	adminProjectMemberInput,
	adminProjectStateInput,
	adminRemoveProjectMemberInput,
	adminTransferLeadInput,
	adminUpdateProjectInput,
	type ProjectExport,
	projectKeyInput,
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
	.validator(zodInput(projectKeyInput))
	.handler(({ data, context }): Promise<boolean> => projects.isKeyFree(context, data.key));

export const createTasklineAdminProject = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminCreateProjectInput))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.create(context, data));

export const updateTasklineAdminProject = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminUpdateProjectInput))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.update(context, data));

export const setTasklineAdminProjectState = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminProjectStateInput))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.setState(context, data));

export const setTasklineAdminProjectArchived = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminArchiveProjectInput))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.setArchived(context, data));

export const transferTasklineProjectLead = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminTransferLeadInput))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.transferLead(context, data));

/** Deletes a project for good, once its key is typed again; the key is retired. */
export const deleteTasklineAdminProject = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminDeleteProjectInput))
	.handler(({ data, context }): Promise<void> => projects.remove(context, data));

export const exportTasklineAdminProject = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:read"), withServices])
	.validator(zodInput(adminExportProjectInput))
	.handler(({ data, context }): Promise<ProjectExport> => projects.exportProject(context, data));

export const setTasklineAdminProjectMember = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminProjectMemberInput))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.setMember(context, data));

export const removeTasklineAdminProjectMember = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(adminRemoveProjectMemberInput))
	.handler(({ data, context }): Promise<AdminProjectDetail> => projects.removeMember(context, data));
