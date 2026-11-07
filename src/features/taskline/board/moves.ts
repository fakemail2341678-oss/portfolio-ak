import { compareOrderKeys, keyBetweenNeighbours } from "@/lib/fractional-index";
import type { TasklineStatus, TaskSummary } from "../types";

/**
 * Where a task goes on the board, as the one row a move changes (Kanban's moves,
 * decision 0188, on statuses): a status and a position in it. Pure, so the board
 * (pointer and keyboard) and the tests compute moves the same way. With swimlanes,
 * each lane is its own layout over the lane's tasks: a key between two neighbours in
 * a lane is also between them in the whole column.
 */
export type TaskMove = { statusId: string; position: string };

export type BoardLayout = {
	columns: ReadonlyArray<TasklineStatus>;
	/** Each status's tasks, in order (every status has an entry). */
	cards: ReadonlyMap<string, ReadonlyArray<TaskSummary>>;
};

const byPosition = <T extends { position: string; id: string }>(a: T, b: T) =>
	compareOrderKeys(a.position, b.position) || compareOrderKeys(a.id, b.id);

/** Statuses in order, each with its tasks in order (tasks of an unknown status are left out). */
export function boardLayout(statuses: ReadonlyArray<TasklineStatus>, tasks: ReadonlyArray<TaskSummary>): BoardLayout {
	const ordered = [...statuses].sort(byPosition);
	const grouped = new Map<string, TaskSummary[]>(ordered.map((status) => [status.id, []]));
	for (const task of tasks) grouped.get(task.statusId)?.push(task);
	for (const list of grouped.values()) list.sort(byPosition);
	return { columns: ordered, cards: grouped };
}

/** The position for something placed at `index` among `siblings` (which don't include it). */
const positionAt = (siblings: ReadonlyArray<{ position: string }>, index: number) =>
	keyBetweenNeighbours(siblings[index - 1]?.position, siblings[index]?.position);

const locate = (layout: BoardLayout, taskId: string) => {
	for (const [columnIndex, column] of layout.columns.entries()) {
		const cards = layout.cards.get(column.id) ?? [];
		const index = cards.findIndex((card) => card.id === taskId);
		if (index >= 0) return { columnIndex, column, cards, index };
	}
	return null;
};

/**
 * A task dropped at `index` of `statusId` (the index among that status's tasks once the
 * task has left its old place). Null when nothing changes.
 */
export function cardDrop(layout: BoardLayout, taskId: string, statusId: string, index: number): TaskMove | null {
	const from = locate(layout, taskId);
	if (!from) return null;
	const siblings = (layout.cards.get(statusId) ?? []).filter((card) => card.id !== taskId);
	const at = Math.max(0, Math.min(index, siblings.length));
	if (statusId === from.column.id && at === from.index) return null;
	return { statusId, position: positionAt(siblings, at) };
}

export type Direction = "up" | "down" | "left" | "right";

/**
 * A keyboard move: one place up or down in its column, or into the next column to the
 * left or right at the same height (or its end). Null at an edge.
 */
export function cardStep(layout: BoardLayout, taskId: string, direction: Direction): TaskMove | null {
	const from = locate(layout, taskId);
	if (!from) return null;
	if (direction === "up" || direction === "down") {
		const to = from.index + (direction === "up" ? -1 : 1);
		if (to < 0 || to >= from.cards.length) return null;
		return cardDrop(layout, taskId, from.column.id, to);
	}
	const target = layout.columns[from.columnIndex + (direction === "left" ? -1 : 1)];
	if (!target) return null;
	return cardDrop(layout, taskId, target.id, from.index);
}

/** Where a task lands once a move is applied: its status and index (for announcements). */
export function cardPlace(layout: BoardLayout, taskId: string, move: TaskMove) {
	const siblings = (layout.cards.get(move.statusId) ?? []).filter((card) => card.id !== taskId);
	const index = siblings.filter((card) => compareOrderKeys(card.position, move.position) < 0).length;
	const column = layout.columns.find((each) => each.id === move.statusId);
	return { column, index, total: siblings.length + 1 };
}

/** The position of a new task at the end of a status (after every task in it, shown or not). */
export const endPosition = (siblings: ReadonlyArray<{ position: string }>) =>
	positionAt(
		[...siblings].sort((a, b) => compareOrderKeys(a.position, b.position)),
		siblings.length,
	);
