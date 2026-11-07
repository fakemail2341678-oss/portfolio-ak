import { addDays } from "@/lib/i18n/date-only";
import { matchesFieldFilters, parseFieldFilters } from "./fields";
import type { TaskFilters } from "./search";
import type { TaskField, TaskSummary } from "./types";

/**
 * The project's filters applied in the browser: the board has every task of the
 * project already and filters them here; the list asks the server, whose SQL
 * (`listWhere` in src/server/taskline/tasks/repository.ts) means the same thing.
 */

/**
 * What a filter needs besides the task: the caller's member row (for `me`), today in
 * the workspace, and the project's active sprint (for `sprint=active`, Task 52).
 */
export type FilterContext = {
	me: string | null;
	today: string;
	activeSprintId?: string | null;
	/** Task 55: the project's custom fields, for `?cf=`. */
	fields?: ReadonlyArray<TaskField>;
};

/** "web-12", "12" or words of the title (any case). */
const matchesText = (task: TaskSummary, q: string) => {
	const text = q.trim().toLowerCase();
	if (!text) return true;
	if (task.ref.toLowerCase() === text || String(task.number) === text) return true;
	return task.title.toLowerCase().includes(text);
};

export function matchesFilters(
	task: TaskSummary,
	filters: TaskFilters,
	{ me, today, activeSprintId = null, fields = [] }: FilterContext,
): boolean {
	if (!matchesText(task, filters.q)) return false;
	if (filters.status !== "all" && task.statusId !== filters.status) return false;
	if (filters.assignee === "none" && task.assigneeId !== null) return false;
	if (filters.assignee === "me" && (me === null || task.assigneeId !== me)) return false;
	if (!["all", "none", "me"].includes(filters.assignee) && task.assigneeId !== filters.assignee) return false;
	if (filters.label !== "all" && !task.labelIds.includes(filters.label)) return false;
	if (filters.priority !== "all" && task.priority !== Number(filters.priority)) return false;
	if (filters.type !== "all" && task.type !== filters.type) return false;
	if (filters.due === "none" && task.dueOn !== null) return false;
	if (filters.due === "overdue" && !(task.dueOn !== null && task.dueOn < today && task.completedAt === null)) {
		return false;
	}
	if (filters.due === "week" && !(task.dueOn !== null && task.dueOn >= today && task.dueOn <= addDays(today, 6))) {
		return false;
	}
	if (filters.sprint === "none" && task.sprintId !== null) return false;
	if (filters.sprint === "active" && (activeSprintId === null || task.sprintId !== activeSprintId)) return false;
	if (!["all", "none", "active"].includes(filters.sprint) && task.sprintId !== filters.sprint) return false;
	if (filters.milestone === "none" && task.milestoneId !== null) return false;
	if (!["all", "none"].includes(filters.milestone) && task.milestoneId !== filters.milestone) return false;
	if (filters.blocked !== "all" && task.blocked !== (filters.blocked === "yes")) return false;
	if (filters.cf.length > 0 && !matchesFieldFilters(task, parseFieldFilters(filters.cf), fields, { me, today })) {
		return false;
	}
	return true;
}

/** True when any filter is set (the board then says how many tasks it hides). */
export const hasFilters = (filters: TaskFilters) =>
	filters.q.trim() !== "" ||
	filters.status !== "all" ||
	filters.assignee !== "all" ||
	filters.label !== "all" ||
	filters.priority !== "all" ||
	filters.type !== "all" ||
	filters.due !== "all" ||
	filters.sprint !== "all" ||
	filters.milestone !== "all" ||
	filters.blocked !== "all" ||
	filters.cf.length > 0;

/** The filters out of a view's search (which carries other params too). */
export const filtersOf = (search: TaskFilters): TaskFilters => ({
	q: search.q,
	status: search.status,
	assignee: search.assignee,
	label: search.label,
	priority: search.priority,
	type: search.type,
	due: search.due,
	sprint: search.sprint,
	milestone: search.milestone,
	blocked: search.blocked,
	cf: search.cf,
});
