import { beforeEach, describe, expect, it } from "vitest";
import { EXAMPLE_SEARCH_DEFAULTS, type ExampleTaskSearch } from "@/features/dev/examples/schema";
import { deleteTasks, getTask, listTasks, nextSnapshot, resetTasks, setTasksDone } from "@/server/examples/tasks";

const search = (patch: Partial<ExampleTaskSearch> = {}): ExampleTaskSearch => ({
	...EXAMPLE_SEARCH_DEFAULTS,
	done: undefined,
	...patch,
});

beforeEach(() => resetTasks());

describe("example task store", () => {
	it("lists newest first, a page at a time", () => {
		const first = listTasks(search());
		expect(first.total).toBe(18);
		expect(first.pageCount).toBe(3);
		expect(first.items).toHaveLength(6);
		const dates = first.items.map((task) => task.createdAt);
		expect([...dates].sort().reverse()).toEqual(dates);
		expect(listTasks(search({ page: 3 })).items).toHaveLength(6);
	});

	it("filters by text, priority and status, and sorts by title", () => {
		expect(listTasks(search({ q: "MESSAGE" })).items.map((task) => task.title)).toEqual([
			"Prune unused message keys",
			"Translate the new messages",
		]);
		expect(listTasks(search({ priority: "high" })).items.every((task) => task.priority === "high")).toBe(true);
		expect(listTasks(search({ done: true })).items.every((task) => task.done)).toBe(true);
		const titles = listTasks(search({ sort: "title" })).items.map((task) => task.title);
		expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
	});

	it("updates, deletes and resets", () => {
		const [task] = listTasks(search({ done: false })).items;
		if (!task) throw new Error("no open task");
		expect(setTasksDone([task.id], true)).toBe(1);
		expect(getTask(task.id)?.done).toBe(true);
		expect(deleteTasks([task.id, "00000000-0000-4000-8000-999999999999"])).toBe(1);
		expect(getTask(task.id)).toBeNull();
		resetTasks();
		expect(getTask(task.id)?.done).toBe(false);
	});

	it("counts snapshot calls", () => {
		const first = nextSnapshot();
		expect(nextSnapshot().calls).toBe(first.calls + 1);
	});
});
