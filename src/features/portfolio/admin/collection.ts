import { crudCollection } from "@/lib/crud/collection";
import type {
	ContactMessageItem,
	ExperienceItem,
	PostListItem,
	ProcessStepItem,
	ProjectListItem,
	SkillItem,
	TestimonialItem,
} from "../schema";
import { messageKeys, postKeys, projectKeys, sectionKeys } from "./keys";

/**
 * The admin lists' rows as TanStack DB collections (docs/guides/crud.md, "Writes").
 * Imported by components only, never by a route file or `queries.ts` (0189).
 */
export const projectRows = crudCollection<ProjectListItem>("portfolio-projects", projectKeys.lists());
export const postRows = crudCollection<PostListItem>("portfolio-posts", postKeys.lists());
export const messageRows = crudCollection<ContactMessageItem>("portfolio-messages", messageKeys.lists());

/** What every ordered section's entry has (components/ordered-section.tsx). */
export type SectionRow = { id: string; sortOrder: number; updatedAt: string };

const section = <TItem extends SectionRow>(name: Parameters<typeof sectionKeys>[0]) =>
	crudCollection<TItem>(`portfolio-section:${name}`, sectionKeys(name).all);

/** One collection per ordered section: reordering and deleting change it at once. */
export const sectionRows = {
	experience: section<ExperienceItem>("experience"),
	skills: section<SkillItem>("skills"),
	process: section<ProcessStepItem>("process"),
	testimonials: section<TestimonialItem>("testimonials"),
};
