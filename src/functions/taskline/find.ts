import { createServerFn } from "@tanstack/react-start";
import {
	deleteViewInputSchema,
	findTasksInputSchema,
	importTasksInputSchema,
	savedViewsInputSchema,
	saveViewInputSchema,
	searchTasksInputSchema,
} from "@/features/taskline/schema";
import type { FoundTask, SavedViewDto, SavedViews, TaskImportResult, TaskSearchPage } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as search from "@/server/taskline/search/service";
import * as imports from "@/server/taskline/tasks/import";
import * as views from "@/server/taskline/views/service";

/** Finding things (Task 51): search (the page and the palette), a project's saved views, and the CSV import of tasks. */

export const searchTasklineTasks = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(searchTasksInputSchema))
	.handler(({ data, context }): Promise<TaskSearchPage> => search.searchTasks(context, data));

export const listTasklineFindResults = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(findTasksInputSchema))
	.handler(({ data, context }): Promise<FoundTask[]> => search.findTasks(context, data));

export const listTasklineSavedViews = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(savedViewsInputSchema))
	.handler(({ data, context }): Promise<SavedViews> => views.listViews(context, data));

export const createTasklineSavedView = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(saveViewInputSchema))
	.handler(({ data, context }): Promise<SavedViewDto> => views.saveView(context, data));

export const deleteTasklineSavedView = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(deleteViewInputSchema))
	.handler(({ data, context }): Promise<void> => views.deleteView(context, data));

export const importTasklineTasks = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(importTasksInputSchema))
	.handler(
		({ data, context }): Promise<TaskImportResult & { replayed: boolean }> => imports.importTasks(context, data),
	);
