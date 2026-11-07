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
import {
	createExperience,
	createProcessStep,
	createSkill,
	createTestimonial,
	deleteExperience,
	deleteProcessSteps,
	deleteSkills,
	deleteTestimonials,
	listExperience,
	listProcessSteps,
	listSkills,
	listTestimonials,
	reorderExperience,
	reorderProcessSteps,
	reorderSkills,
	reorderTestimonials,
	updateExperience,
	updateProcessStep,
	updateSkill,
	updateTestimonial,
} from "@/functions/portfolio-sections";
import type {
	ExperienceInput,
	MessageStateInput,
	PortfolioStatus,
	PostInput,
	ProcessStepInput,
	ProfileInput,
	ProjectInput,
	SkillInput,
	TestimonialInput,
} from "../schema";
import type { MessageListInput, PostListInput, ProjectListInput } from "../search";
import { messageKeys, postKeys, profileKeys, projectKeys, sectionKeys } from "./keys";

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

/** Writes, keyed (useMutationState can find them). useCrudMutation and useCrudForm add the rest. */

const keyed = (base: ReadonlyArray<string>, name: string) => [...base, name];

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

/**
 * One ordered section's reads and writes. Each section has its own server
 * functions (literal createServerFn per function); this puts them behind one
 * shape, so one page component serves all four (components/ordered-section.tsx).
 */
function section<TInput, TItem>(
	name: Parameters<typeof sectionKeys>[0],
	fns: {
		list: () => Promise<TItem[]>;
		create: (options: { data: TInput }) => Promise<TItem>;
		update: (options: { data: TInput & Versioned }) => Promise<TItem>;
		remove: (options: { data: { ids: string[] } }) => Promise<{ deleted: number }>;
		reorder: (options: { data: { ids: string[] } }) => Promise<{ moved: number }>;
	},
) {
	const keys = sectionKeys(name);
	return {
		keys,
		list: () => queryOptions({ queryKey: keys.all, queryFn: () => fns.list() }),
		create: () =>
			mutationOptions({
				mutationKey: keyed(keys.all, "create"),
				mutationFn: (input: TInput) => fns.create({ data: input }),
			}),
		update: () =>
			mutationOptions({
				mutationKey: keyed(keys.all, "update"),
				mutationFn: (input: TInput & Versioned) => fns.update({ data: input }),
			}),
		delete: () =>
			mutationOptions({
				mutationKey: keyed(keys.all, "delete"),
				mutationFn: (ids: string[]) => fns.remove({ data: { ids } }),
			}),
		reorder: () =>
			mutationOptions({
				mutationKey: keyed(keys.all, "reorder"),
				mutationFn: (ids: string[]) => fns.reorder({ data: { ids } }),
			}),
	};
}

export const experienceSection = section<ExperienceInput, Awaited<ReturnType<typeof listExperience>>[number]>(
	"experience",
	{
		list: () => listExperience(),
		create: createExperience,
		update: updateExperience,
		remove: deleteExperience,
		reorder: reorderExperience,
	},
);

export const skillSection = section<SkillInput, Awaited<ReturnType<typeof listSkills>>[number]>("skills", {
	list: () => listSkills(),
	create: createSkill,
	update: updateSkill,
	remove: deleteSkills,
	reorder: reorderSkills,
});

export const processSection = section<ProcessStepInput, Awaited<ReturnType<typeof listProcessSteps>>[number]>(
	"process",
	{
		list: () => listProcessSteps(),
		create: createProcessStep,
		update: updateProcessStep,
		remove: deleteProcessSteps,
		reorder: reorderProcessSteps,
	},
);

export const testimonialSection = section<TestimonialInput, Awaited<ReturnType<typeof listTestimonials>>[number]>(
	"testimonials",
	{
		list: () => listTestimonials(),
		create: createTestimonial,
		update: updateTestimonial,
		remove: deleteTestimonials,
		reorder: reorderTestimonials,
	},
);

export type SectionQueries<TInput, TItem> = ReturnType<typeof section<TInput, TItem>>;
