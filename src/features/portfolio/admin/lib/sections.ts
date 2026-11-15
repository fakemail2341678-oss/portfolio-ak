import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { Versioned } from "@/components/crud/use-crud-form";
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
import type { ExperienceInput, ProcessStepInput, SkillInput, TestimonialInput } from "../../schema";
import { sectionKeys } from "../keys";
import { keyed } from "./mutation-key";

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
