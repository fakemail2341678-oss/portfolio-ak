import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { Versioned } from "@/components/crud/use-crud-form";
import {
	createPost,
	createProject,
	deletePosts,
	deleteProjects,
	getPortfolioProfile,
	getPost,
	getProject,
	listPosts,
	listProjectOrder,
	listProjects,
	reorderProjects,
	setPostStatus,
	setProjectStatus,
	updatePortfolioProfile,
	updatePost,
	updateProject,
} from "@/functions/portfolio";
import { deleteContactMessages, listContactMessages, setContactMessageState } from "@/functions/portfolio-messages";
import type { MessageStateInput, PortfolioStatus, PostInput, ProfileInput, ProjectInput } from "../schema";
import type { MessageListInput, PostListInput, ProjectListInput } from "../search";
import { messageKeys, postKeys, profileKeys, projectKeys } from "./keys";
import { keyed } from "./lib/mutation-key";

/** Reads: loaders `ensureQuery` these; components read them with useSuspenseQuery or useListPage. */

/** Edit forms' defaults must not change under the user while editing. */
const EDITING = { staleTime: Number.POSITIVE_INFINITY } as const;

export const profileQueryOptions = () =>
	queryOptions({ ...EDITING, queryKey: profileKeys.all, queryFn: () => getPortfolioProfile() });

export const projectListQueryOptions = (input: ProjectListInput) =>
	queryOptions({ queryKey: projectKeys.list(input), queryFn: () => listProjects({ data: input }) });

export const projectOrderQueryOptions = () =>
	queryOptions({ queryKey: projectKeys.order(), queryFn: () => listProjectOrder() });

export const projectDetailQueryOptions = (id: string) =>
	queryOptions({ ...EDITING, queryKey: projectKeys.detail(id), queryFn: () => getProject({ data: { id } }) });

export const postListQueryOptions = (input: PostListInput) =>
	queryOptions({ queryKey: postKeys.list(input), queryFn: () => listPosts({ data: input }) });

export const postDetailQueryOptions = (id: string) =>
	queryOptions({ ...EDITING, queryKey: postKeys.detail(id), queryFn: () => getPost({ data: { id } }) });

export const messageListQueryOptions = (input: MessageListInput) =>
	queryOptions({ queryKey: messageKeys.list(input), queryFn: () => listContactMessages({ data: input }) });

export const profileMutations = {
	update: () =>
		mutationOptions({
			mutationKey: keyed(profileKeys.all, "update"),
			mutationFn: (input: ProfileInput & Versioned) => updatePortfolioProfile({ data: { ...input, id: "profile" } }),
		}),
};

export const projectMutations = {
	create: () =>
		mutationOptions({
			mutationKey: keyed(projectKeys.all, "create"),
			mutationFn: (input: ProjectInput) => createProject({ data: input }),
		}),
	update: () =>
		mutationOptions({
			mutationKey: keyed(projectKeys.all, "update"),
			mutationFn: (input: ProjectInput & Versioned) => updateProject({ data: input }),
		}),
	setStatus: () =>
		mutationOptions({
			mutationKey: keyed(projectKeys.all, "status"),
			mutationFn: (input: { id: string; status: PortfolioStatus }) => setProjectStatus({ data: input }),
		}),
	delete: () =>
		mutationOptions({
			mutationKey: keyed(projectKeys.all, "delete"),
			mutationFn: (ids: string[]) => deleteProjects({ data: { ids } }),
		}),
	reorder: () =>
		mutationOptions({
			mutationKey: keyed(projectKeys.all, "reorder"),
			mutationFn: (ids: string[]) => reorderProjects({ data: { ids } }),
		}),
};

export const postMutations = {
	create: () =>
		mutationOptions({
			mutationKey: keyed(postKeys.all, "create"),
			mutationFn: (input: PostInput) => createPost({ data: input }),
		}),
	update: () =>
		mutationOptions({
			mutationKey: keyed(postKeys.all, "update"),
			mutationFn: (input: PostInput & Versioned) => updatePost({ data: input }),
		}),
	setStatus: () =>
		mutationOptions({
			mutationKey: keyed(postKeys.all, "status"),
			mutationFn: (input: { id: string; status: PortfolioStatus }) => setPostStatus({ data: input }),
		}),
	delete: () =>
		mutationOptions({
			mutationKey: keyed(postKeys.all, "delete"),
			mutationFn: (ids: string[]) => deletePosts({ data: { ids } }),
		}),
};

export const messageMutations = {
	setState: () =>
		mutationOptions({
			mutationKey: keyed(messageKeys.all, "state"),
			mutationFn: (input: MessageStateInput) => setContactMessageState({ data: input }),
		}),
	delete: () =>
		mutationOptions({
			mutationKey: keyed(messageKeys.all, "delete"),
			mutationFn: (ids: string[]) => deleteContactMessages({ data: { ids } }),
		}),
};
