import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { collectionOptions } from "@tanstack/react-db";
import { rankTasklineTask } from "@/functions/taskline/sprints";
import {
	createTasklineTask,
	listTasklineTasks,
	moveTasklineTask,
	patchTasklineTask,
	trashTasklineTask,
} from "@/functions/taskline/tasks";
import { queryClientOf } from "@/lib/tanstack-db";
import { tasklineKeys } from "../queries";
import type { PatchTaskInput } from "../schema";
import type { ProjectTasks, TaskPriority, TaskSummary } from "../types";

/**
 * A project's tasks as a TanStack DB collection (Kanban's, decisions 0188 and 0189):
 * it reads the project query the layout's loader filled (`select`), so its first rows
 * are the server-rendered ones and the board's live query renders on the server too.
 * A move or an edit shows at once; the handler saves it, and if the server refuses,
 * DB puts the row back. After a save the project is read again (one GET), so the rows
 * are the server's (with the numbers and refs it gave new tasks).
 */

/**
 * After a save, the project is read again before the optimistic change is dropped, so
 * the rows don't flicker back. Explicit, because query collections' automatic refetch
 * is deprecated (it goes away at TanStack DB 1.0).
 */
const saved = async (collection: { utils: { refetch: () => Promise<unknown> } }) => {
	await collection.utils.refetch();
	return { refetch: false };
};

/** The single fields an edit may send (`patchTask`'s input is strict). */
const patchOf = ({
	type,
	priority,
	assigneeId,
	labelIds,
	startOn,
	dueOn,
	points,
	estimateMinutes,
}: Partial<TaskSummary>): Omit<PatchTaskInput, "ws" | "ref"> => ({
	type,
	priority,
	assigneeId,
	labelIds,
	startOn,
	dueOn,
	points,
	estimateMinutes,
});

const hasAny = (patch: object) => Object.values(patch).some((value) => value !== undefined);

const make = (userId: string, ws: string, key: string) =>
	collectionOptions(`taskline:tasks:${ws}:${key}`, (client) =>
		queryCollectionOptions({
			id: `taskline:tasks:${ws}:${key}`,
			queryKey: tasklineKeys.projectTasks(userId, ws, key),
			queryFn: () => listTasklineTasks({ data: { ws, key } }),
			select: (data: ProjectTasks) => data.tasks,
			queryClient: queryClientOf(client),
			getKey: (task: TaskSummary) => task.id,
			onInsert: async ({ transaction, collection }) => {
				for (const { modified } of transaction.mutations) {
					await createTasklineTask({
						data: {
							ws,
							key,
							id: modified.id,
							title: modified.title,
							statusId: modified.statusId,
							position: modified.position,
							priority: modified.priority,
							assigneeId: modified.assigneeId,
							sprintId: modified.sprintId,
						},
					});
				}
				return saved(collection);
			},
			onUpdate: async ({ transaction, collection }) => {
				for (const { original, changes } of transaction.mutations) {
					// A drop on the backlog (Task 52): its sprint and rank.
					if (changes.sprintId !== undefined || changes.rank !== undefined) {
						await rankTasklineTask({
							data: {
								ws,
								ref: original.ref,
								sprintId: changes.sprintId !== undefined ? changes.sprintId : original.sprintId,
								rank: changes.rank ?? original.rank,
							},
						});
					}
					if (changes.statusId !== undefined || changes.position !== undefined) {
						await moveTasklineTask({
							data: {
								ws,
								ref: original.ref,
								statusId: changes.statusId ?? original.statusId,
								position: changes.position ?? original.position,
							},
						});
					}
					const patch = patchOf(changes);
					if (hasAny(patch)) await patchTasklineTask({ data: { ws, ref: original.ref, ...patch } });
				}
				return saved(collection);
			},
			onDelete: async ({ transaction, collection }) => {
				for (const { original } of transaction.mutations) {
					await trashTasklineTask({ data: { ws, ref: original.ref } });
				}
				return saved(collection);
			},
		}),
	);

type TaskCollection = ReturnType<typeof make>;
const made = new Map<string, TaskCollection>();

/** The collection descriptor of one project's tasks (the same object every time, as DB needs). */
export function projectTaskCollection(userId: string, ws: string, key: string): TaskCollection {
	const id = `${userId}:${ws}:${key}`;
	let found = made.get(id);
	if (!found) {
		found = make(userId, ws, key);
		made.set(id, found);
	}
	return found;
}

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
