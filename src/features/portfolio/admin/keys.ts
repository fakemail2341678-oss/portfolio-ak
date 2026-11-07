import { createCrudKeys } from "@/lib/crud/keys";
import type { MessageListInput, PostListInput, ProjectListInput } from "../search";

/** The portfolio admin's Query keys (the shared shape, src/lib/crud/keys.ts), one set per section. */

const projects = createCrudKeys<ProjectListInput>("portfolio-projects");
export const projectKeys = {
	...projects,
	/** Every project in display order (the reorder dialog). */
	order: () => [...projects.all, "order"] as const,
};

export const postKeys = createCrudKeys<PostListInput>("portfolio-posts");

export const profileKeys = { all: ["portfolio-profile"] as const };

export const messageKeys = createCrudKeys<MessageListInput>("portfolio-messages");

/** The ordered sections: each is one short list, read whole. */
export const sectionKeys = (section: "experience" | "skills" | "process" | "testimonials") =>
	({ all: ["portfolio-section", section] as const }) as const;
