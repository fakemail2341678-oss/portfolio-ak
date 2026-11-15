import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { collectionOptions } from "@tanstack/react-db";
import { reorderTasklineTask } from "@/functions/taskline/sprints";
import {
	createTasklineTask,
	listTasklineTasks,
	moveTasklineTask,
	setTasklineTaskField,
	trashTasklineTask,
} from "@/functions/taskline/tasks";
import { queryClientOf } from "@/lib/tanstack-db";
import { tasklineKeys } from "../keys";
import type { PatchTaskInput } from "../schema";
import type { ProjectTasks, TaskSummary } from "../types";

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
						await reorderTasklineTask({
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
					if (hasAny(patch)) await setTasklineTaskField({ data: { ws, ref: original.ref, ...patch } });
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
export function projectTaskRows(userId: string, ws: string, key: string): TaskCollection {
	const id = `${userId}:${ws}:${key}`;
	let found = made.get(id);
	if (!found) {
		found = make(userId, ws, key);
		made.set(id, found);
	}
	return found;
}
