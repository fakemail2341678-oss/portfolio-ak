import { fn } from "storybook/test";
import type {
	FoundTask,
	SavedViewDto,
	SavedViews,
	TaskImportResult,
	TaskSearchPage,
} from "../../../../src/features/taskline/types";

// Stand-ins for src/functions/taskline/find.ts.
export const searchTasklineTasks = fn(
	async (): Promise<TaskSearchPage> => ({ items: [], total: 0, page: 1, pageSize: 20, jump: null }),
).mockName("searchTasklineTasks");
export const findTasklineTasks = fn(async (): Promise<FoundTask[]> => []).mockName("findTasklineTasks");
export const listTasklineSavedViews = fn(
	async (): Promise<SavedViews> => ({ views: [], canSave: true, canShare: true }),
).mockName("listTasklineSavedViews");
export const saveTasklineSavedView = fn(
	async (): Promise<SavedViewDto> => ({
		id: "view-1",
		name: "View",
		view: "list",
		search: "",
		shared: false,
		author: "Asha",
		mine: true,
		canDelete: true,
	}),
).mockName("saveTasklineSavedView");
export const deleteTasklineSavedView = fn(async (): Promise<void> => undefined).mockName("deleteTasklineSavedView");
export const importTasklineTasks = fn(
	async (): Promise<TaskImportResult & { replayed: boolean }> => ({
		inserted: 0,
		unmatched: { statuses: [], assignees: [], labels: [] },
		replayed: false,
	}),
).mockName("importTasklineTasks");
