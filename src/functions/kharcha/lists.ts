import { createServerFn } from "@tanstack/react-start";
import {
	createCategoryInput,
	createMethodInput,
	createRuleInput,
	listIdInput,
	reorderInput,
	tagInput,
	updateCategoryInput,
	updateMethodInput,
	updateRuleInput,
	updateTagInput,
} from "@/features/kharcha/schema";
import type { KharchaLists } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as lists from "@/server/kharcha/lists/service";

/**
 * The caller's own lists (docs/guides/kharcha.md "Lists", Task 89): categories, tags,
 * payment methods and merchant rules. Anyone signed in, guests included; each list is the
 * caller's alone. Every change answers with all of them.
 */

export const getKharchaLists = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<KharchaLists> => lists.getLists(context));

export const createKharchaCategory = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(createCategoryInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.createCategory(context, data));

export const updateKharchaCategory = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updateCategoryInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.updateCategory(context, data));

/** Its expenses become uncategorized. */
export const deleteKharchaCategory = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(listIdInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.deleteCategory(context, data.id));

export const reorderKharchaCategories = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(reorderInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.reorderCategories(context, data.ids));

export const createKharchaTag = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(tagInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.createTag(context, data.name));

export const updateKharchaTag = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updateTagInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.updateTag(context, data));

export const deleteKharchaTag = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(listIdInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.deleteTag(context, data.id));

export const createKharchaMethod = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(createMethodInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.createMethod(context, data.name));

export const updateKharchaMethod = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updateMethodInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.updateMethod(context, data));

export const deleteKharchaMethod = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(listIdInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.deleteMethod(context, data.id));

export const reorderKharchaMethods = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(reorderInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.reorderMethods(context, data.ids));

export const createKharchaRule = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(createRuleInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.createRule(context, data));

export const updateKharchaRule = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updateRuleInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.updateRule(context, data));

export const deleteKharchaRule = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(listIdInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.deleteRule(context, data.id));

export const reorderKharchaRules = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(reorderInput))
	.handler(({ data, context }): Promise<KharchaLists> => lists.reorderRules(context, data.ids));
