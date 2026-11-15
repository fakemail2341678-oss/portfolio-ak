import { createServerFn } from "@tanstack/react-start";
import {
	createProjectInputSchema,
	deleteProjectUpdateInputSchema,
	listProjectsInputSchema,
	postProjectUpdateInputSchema,
	projectByIdInputSchema,
	projectInputSchema,
	removeProjectMemberInputSchema,
	setProjectArchivedInputSchema,
	setProjectMemberInputSchema,
	setProjectStarInputSchema,
	setProjectStateInputSchema,
	updateProjectInputSchema,
} from "@/features/taskline/schema";
import type {
	ProjectDetail,
	ProjectLocation,
	ProjectMemberView,
	ProjectSummary,
	ProjectUpdate,
} from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as projects from "@/server/taskline/projects/service";
import * as updates from "@/server/taskline/projects/updates";

/** Taskline's projects: the directory, the project form, state, archive, stars and project members. */

export const listTasklineProjects = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(listProjectsInputSchema))
	.handler(({ data, context }): Promise<ProjectSummary[]> => projects.listProjects(context, data));

export const createTasklineProject = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(createProjectInputSchema))
	.handler(({ data, context }): Promise<ProjectDetail> => projects.createProject(context, data));

export const updateTasklineProject = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(updateProjectInputSchema))
	.handler(({ data, context }): Promise<ProjectDetail> => projects.updateProject(context, data));

export const setTasklineProjectState = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(setProjectStateInputSchema))
	.handler(({ data, context }): Promise<ProjectDetail> => projects.setProjectState(context, data));

export const setTasklineProjectArchived = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(setProjectArchivedInputSchema))
	.handler(({ data, context }): Promise<ProjectDetail> => projects.setProjectArchived(context, data));

export const setTasklineProjectStar = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(setProjectStarInputSchema))
	.handler(({ data, context }): Promise<void> => projects.setProjectStar(context, data));

export const joinTasklineProject = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(projectInputSchema))
	.handler(({ data, context }): Promise<ProjectDetail> => projects.joinProject(context, data));

export const listTasklineProjectMembers = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(projectInputSchema))
	.handler(
		({ data, context }): Promise<ProjectMemberView[]> => projects.listProjectMembers(context, data.ws, data.key),
	);

export const setTasklineProjectMember = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(setProjectMemberInputSchema))
	.handler(({ data, context }): Promise<ProjectMemberView[]> => projects.setProjectMember(context, data));

export const removeTasklineProjectMember = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(removeProjectMemberInputSchema))
	.handler(({ data, context }): Promise<ProjectMemberView[]> => projects.removeProjectMember(context, data));

/** Task 57: how the project is doing, posted by whoever may run it. */
export const listTasklineProjectUpdates = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(projectInputSchema))
	.handler(({ data, context }): Promise<ProjectUpdate[]> => updates.listProjectUpdates(context, data));

export const createTasklineProjectUpdate = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(postProjectUpdateInputSchema))
	.handler(({ data, context }): Promise<ProjectUpdate> => updates.postProjectUpdate(context, data));

export const deleteTasklineProjectUpdate = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(deleteProjectUpdateInputSchema))
	.handler(({ data, context }): Promise<void> => updates.deleteProjectUpdate(context, data));

/** Where a project is, by id: the redirect of an old Kanban board's URL (decision 0210). */
export const getTasklineProjectLocation = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(projectByIdInputSchema))
	.handler(({ data, context }): Promise<ProjectLocation> => projects.locateProject(context, data.id));
