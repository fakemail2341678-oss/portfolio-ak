import { createServerFn } from "@tanstack/react-start";
import {
	type ExperienceItem,
	experienceInputSchema,
	experienceUpdateSchema,
	type ProcessStepItem,
	processStepInputSchema,
	processStepUpdateSchema,
	reorderSchema,
	type SkillItem,
	skillInputSchema,
	skillUpdateSchema,
	type TestimonialItem,
	testimonialInputSchema,
	testimonialUpdateSchema,
} from "@/features/portfolio/schema";
import { zodInput } from "@/functions/_lib/validator";
import { bulkIdsSchema } from "@/lib/list/paging";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as sections from "@/server/portfolio/sections-service";

/**
 * The portfolio's ordered sections (experience, skills, process steps,
 * testimonials; decision 0176): list, add, edit, delete and reorder each,
 * under portfolio:read and portfolio:write. One literal createServerFn per
 * function (Start extracts them statically).
 */

// Experience -------------------------------------------------------------------

export const listExperience = createServerFn({ method: "GET" })
	.middleware([requirePermission("portfolio:read"), withServices])
	.handler(({ context }): Promise<ExperienceItem[]> => sections.experience.list(context));

export const createExperience = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(experienceInputSchema))
	.handler(({ data, context }): Promise<ExperienceItem> => sections.experience.create(context, data));

export const updateExperience = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(experienceUpdateSchema))
	.handler(({ data, context }): Promise<ExperienceItem> => sections.experience.update(context, data));

export const deleteExperience = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => sections.experience.remove(context, data.ids));

export const reorderExperience = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(reorderSchema))
	.handler(({ data, context }): Promise<{ moved: number }> => sections.experience.reorder(context, data.ids));

// Skills -----------------------------------------------------------------------

export const listSkills = createServerFn({ method: "GET" })
	.middleware([requirePermission("portfolio:read"), withServices])
	.handler(({ context }): Promise<SkillItem[]> => sections.skills.list(context));

export const createSkill = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(skillInputSchema))
	.handler(({ data, context }): Promise<SkillItem> => sections.skills.create(context, data));

export const updateSkill = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(skillUpdateSchema))
	.handler(({ data, context }): Promise<SkillItem> => sections.skills.update(context, data));

export const deleteSkills = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => sections.skills.remove(context, data.ids));

export const reorderSkills = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(reorderSchema))
	.handler(({ data, context }): Promise<{ moved: number }> => sections.skills.reorder(context, data.ids));

// ProcessSteps -----------------------------------------------------------------

export const listProcessSteps = createServerFn({ method: "GET" })
	.middleware([requirePermission("portfolio:read"), withServices])
	.handler(({ context }): Promise<ProcessStepItem[]> => sections.process.list(context));

export const createProcessStep = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(processStepInputSchema))
	.handler(({ data, context }): Promise<ProcessStepItem> => sections.process.create(context, data));

export const updateProcessStep = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(processStepUpdateSchema))
	.handler(({ data, context }): Promise<ProcessStepItem> => sections.process.update(context, data));

export const deleteProcessSteps = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => sections.process.remove(context, data.ids));

export const reorderProcessSteps = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(reorderSchema))
	.handler(({ data, context }): Promise<{ moved: number }> => sections.process.reorder(context, data.ids));

// Testimonials -----------------------------------------------------------------

export const listTestimonials = createServerFn({ method: "GET" })
	.middleware([requirePermission("portfolio:read"), withServices])
	.handler(({ context }): Promise<TestimonialItem[]> => sections.testimonials.list(context));

export const createTestimonial = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(testimonialInputSchema))
	.handler(({ data, context }): Promise<TestimonialItem> => sections.testimonials.create(context, data));

export const updateTestimonial = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(testimonialUpdateSchema))
	.handler(({ data, context }): Promise<TestimonialItem> => sections.testimonials.update(context, data));

export const deleteTestimonials = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => sections.testimonials.remove(context, data.ids));

export const reorderTestimonials = createServerFn({ method: "POST" })
	.middleware([requirePermission("portfolio:write"), withServices])
	.validator(zodInput(reorderSchema))
	.handler(({ data, context }): Promise<{ moved: number }> => sections.testimonials.reorder(context, data.ids));
