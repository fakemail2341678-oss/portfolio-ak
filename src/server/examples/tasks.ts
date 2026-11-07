import "@tanstack/react-start/server-only";
import type { ExamplePriority, ExampleTask, ExampleTaskPage, ExampleTaskSearch } from "@/features/dev/examples/schema";
import { EXAMPLE_PAGE_SIZE, EXAMPLE_PRIORITIES } from "@/features/dev/examples/schema";
import { paginateArray, parseSort } from "@/lib/list/paging";

/**
 * The dev examples' task list, kept in memory by the dev server process (it
 * resets on restart). Ids and dates are fixed so server and client renders agree.
 */

const TITLES = [
	"Write the release notes",
	"Review the permission matrix",
	"Translate the new messages",
	"Fix the flaky upload test",
	"Plan the next sprint",
	"Update the Storybook stories",
	"Check the sitemap in Search Console",
	"Rotate the cron secret",
	"Answer the design feedback",
	"Measure layout shift on mobile",
	"Prune unused message keys",
	"Archive old drafts",
	"Draft the onboarding guide",
	"Profile the list query",
	"Test the Nepali dates",
	"Clean up Cloudinary orphans",
	"Add a filter for tags",
	"Document the cache headers",
];

const seed = (): ExampleTask[] =>
	TITLES.map((title, index) => ({
		id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
		title,
		priority: EXAMPLE_PRIORITIES[index % EXAMPLE_PRIORITIES.length] as ExamplePriority,
		done: index % 4 === 0,
		createdAt: new Date(Date.UTC(2026, 0, 1 + index * 3, 9)).toISOString(),
	}));

let tasks = seed();
let snapshots = 0;

export const resetTasks = () => {
	tasks = seed();
};

/** Filter, sort and paginate like a repository would (see src/server/db/list.ts for the SQL version). */
export function listTasks(search: ExampleTaskSearch, pageSize = EXAMPLE_PAGE_SIZE): ExampleTaskPage {
	const q = search.q.toLowerCase();
	const { field, direction } = parseSort(search.sort);
	const sign = direction === "asc" ? 1 : -1;
	const rows = tasks
		.filter((task) => !q || task.title.toLowerCase().includes(q))
		.filter((task) => search.priority === "all" || task.priority === search.priority)
		.filter((task) => search.done === undefined || task.done === search.done)
		.sort((a, b) =>
			field === "title" ? sign * a.title.localeCompare(b.title) : sign * a.createdAt.localeCompare(b.createdAt),
		);
	return paginateArray(rows, search.page, pageSize);
}

export function setTasksDone(ids: ReadonlyArray<string>, done: boolean): number {
	const wanted = new Set(ids);
	tasks = tasks.map((task) => (wanted.has(task.id) ? { ...task, done } : task));
	return wanted.size;
}

export function deleteTasks(ids: ReadonlyArray<string>): number {
	const before = tasks.length;
	const wanted = new Set(ids);
	tasks = tasks.filter((task) => !wanted.has(task.id));
	return before - tasks.length;
}

/** Counts server calls for the loader + Query example (a refetch would raise it). */
export const nextSnapshot = () => ({ calls: ++snapshots, renderedAt: new Date().toISOString() });

export const getTask = (id: string): ExampleTask | null => tasks.find((task) => task.id === id) ?? null;
