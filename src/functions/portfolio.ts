import { createServerFn } from "@tanstack/react-start";
import {
	type PostDetail,
	type PostListItem,
	type PostPage,
	type ProfileDetail,
	type ProjectDetail,
	type ProjectListItem,
	type ProjectOrderItem,
	type ProjectPage,
	postInputSchema,
	postUpdateSchema,
	profileUpdateSchema,
	projectInputSchema,
	projectUpdateSchema,
	reorderSchema,
	slugCheckSchema,
	statusUpdateSchema,
} from "@/features/portfolio/schema";
import { postList, projectList } from "@/features/portfolio/search";
import { zodInput } from "@/functions/_lib/validator";
import { idSchema } from "@/lib/crud/schema";
import { bulkIdsSchema } from "@/lib/list/paging";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as posts from "@/server/portfolio/posts-service";
import * as profile from "@/server/portfolio/profile-service";
import * as projects from "@/server/portfolio/projects-service";

/**
 * The portfolio admin's server functions (/admin/portfolio, decision 0176): the
 * permission check first, the input validated with the shared schema, then one
 * service call. Changing a status (in a save or from the list) needs
 * portfolio:publish on top; the services check it.
 */

// Profile ---------------------------------------------------------------------

export const getPortfolioProfile = createServerFn({ method: "GET" })
	.middleware([requirePermission("portfolio:read"), withServices])
	.handler(({ context }): Promise<ProfileDetail> => profile.get(context));

export const updatePortfolioProfile = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(profileUpdateSchema))
	.handler(({ data, context }): Promise<ProfileDetail> => profile.update(context, data));

// Projects --------------------------------------------------------------------

export const listProjects = createServerFn({ method: "GET" })
	.middleware([requirePermission("portfolio:read"), withServices])
	.validator(zodInput(projectList.input))
	.handler(({ data, context }): Promise<ProjectPage> => projects.list(context, data));

/** Every project in display order, for the reorder dialog. */
export const listProjectOrder = createServerFn({ method: "GET" })
	.middleware([requirePermission("portfolio:read"), withServices])
	.handler(({ context }): Promise<ProjectOrderItem[]> => projects.listOrder(context));

export const getProject = createServerFn({ method: "GET" })
	.middleware([requirePermission("portfolio:read"), withServices])
	.validator(zodInput(idSchema))
	.handler(({ data, context }): Promise<ProjectDetail> => projects.get(context, data.id));

export const isProjectSlugFree = createServerFn({ method: "GET" })
	.middleware([requirePermission("portfolio:read"), withServices])
	.validator(zodInput(slugCheckSchema))
	.handler(({ data, context }): Promise<boolean> => projects.isSlugFree(context, data));

export const createProject = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(projectInputSchema))
	.handler(({ data, context }): Promise<ProjectDetail> => projects.create(context, data));

export const updateProject = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(projectUpdateSchema))
	.handler(({ data, context }): Promise<ProjectDetail> => projects.update(context, data));

export const setProjectStatus = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:publish"), withServices])
	.validator(zodInput(statusUpdateSchema))
	.handler(({ data, context }): Promise<ProjectListItem> => projects.setStatus(context, data));

export const deleteProjects = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => projects.remove(context, data.ids));

export const reorderProjects = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(reorderSchema))
	.handler(({ data, context }): Promise<{ moved: number }> => projects.reorder(context, data.ids));

// Journal ---------------------------------------------------------------------

export const listPosts = createServerFn({ method: "GET" })
	.middleware([requirePermission("portfolio:read"), withServices])
	.validator(zodInput(postList.input))
	.handler(({ data, context }): Promise<PostPage> => posts.list(context, data));

export const getPost = createServerFn({ method: "GET" })
	.middleware([requirePermission("portfolio:read"), withServices])
	.validator(zodInput(idSchema))
	.handler(({ data, context }): Promise<PostDetail> => posts.get(context, data.id));

export const isPostSlugFree = createServerFn({ method: "GET" })
	.middleware([requirePermission("portfolio:read"), withServices])
	.validator(zodInput(slugCheckSchema))
	.handler(({ data, context }): Promise<boolean> => posts.isSlugFree(context, data));

export const createPost = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(postInputSchema))
	.handler(({ data, context }): Promise<PostDetail> => posts.create(context, data));

export const updatePost = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(postUpdateSchema))
	.handler(({ data, context }): Promise<PostDetail> => posts.update(context, data));

export const setPostStatus = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:publish"), withServices])
	.validator(zodInput(statusUpdateSchema))
	.handler(({ data, context }): Promise<PostListItem> => posts.setStatus(context, data));

export const deletePosts = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => posts.remove(context, data.ids));
