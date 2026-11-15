import type { TaskPriority, TaskSummary } from "../../types";

/** A task the board adds at a column's foot, before the server numbers it. */
export function draftTask(
	values: Pick<TaskSummary, "title" | "statusId" | "position"> & {
		priority?: TaskPriority;
		assigneeId?: string | null;
		/** Task 52: added in a sprint's section of the backlog. */
		sprintId?: string | null;
		key: string;
	},
): TaskSummary {
	return {
		id: crypto.randomUUID(),
		// The server gives the number; until then the card shows no ref.
		ref: `${values.key}-…`,
		number: 0,
		type: "task",
		title: values.title,
		statusId: values.statusId,
		priority: values.priority ?? 0,
		assigneeId: values.assigneeId ?? null,
		parentId: null,
		labelIds: [],
		position: values.position,
		startOn: null,
		dueOn: null,
		completedAt: null,
		checklist: { done: 0, total: 0 },
		updatedAt: new Date().toISOString(),
		sprintId: values.sprintId ?? null,
		points: null,
		// The server ranks it last in the backlog; until then it sorts after every key ("~" is past base 62).
		rank: DRAFT_RANK,
		estimateMinutes: null,
		milestoneId: null,
		blocked: false,
		fields: {},
		recurrence: null,
	};
}

/** A new task's rank before the server gives it one: after every order key. */
export const DRAFT_RANK = "~";
