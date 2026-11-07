import { compareOrderKeys, isOrderKey, keyBetweenNeighbours } from "@/lib/fractional-index";
import type { SprintSummary, TaskSummary } from "../types";

/**
 * The backlog's layout and moves (Task 52), pure like the board's (board/moves.ts): a
 * section per open sprint (the active one first), then the backlog, each in rank order.
 * A move is the one row it changes: the task's sprint and a rank between its new
 * neighbours. Ranks are one order across the project, so a key between two neighbours
 * in a section is also between them in the whole project.
 */

/** The backlog's own section: tasks in no sprint. */
export const BACKLOG_SECTION = "backlog";

export type BacklogSection = {
	/** The sprint's id, or BACKLOG_SECTION. */
	id: string;
	sprint: SprintSummary | null;
	tasks: ReadonlyArray<TaskSummary>;
};

export type RankMove = { sprintId: string | null; rank: string };

const byRank = (a: TaskSummary, b: TaskSummary) =>
	compareOrderKeys(a.rank, b.rank) || a.number - b.number || compareOrderKeys(a.id, b.id);

/**
 * The sections: each open sprint with every task planned in it (closed ones too, so
 * its progress shows), then the backlog's open tasks. Tasks of a completed sprint, and
 * closed tasks in no sprint, aren't on the page.
 */
export function backlogLayout(
	sprints: ReadonlyArray<SprintSummary>,
	tasks: ReadonlyArray<TaskSummary>,
	isClosed: (task: TaskSummary) => boolean,
): BacklogSection[] {
	const open = sprints.filter((sprint) => sprint.state !== "completed");
	const sections: BacklogSection[] = open.map((sprint) => ({
		id: sprint.id,
		sprint,
		tasks: tasks.filter((task) => task.sprintId === sprint.id).sort(byRank),
	}));
	sections.push({
		id: BACKLOG_SECTION,
		sprint: null,
		tasks: tasks.filter((task) => task.sprintId === null && !isClosed(task)).sort(byRank),
	});
	return sections;
}

/** The nearest rank a move can stand on, looking from `from` in `step`'s direction: a new task's placeholder isn't one. */
const usable = (tasks: ReadonlyArray<TaskSummary>, from: number, step: 1 | -1) => {
	for (let index = from; index >= 0 && index < tasks.length; index += step) {
		const rank = tasks[index]?.rank;
		if (rank && isOrderKey(rank)) return rank;
	}
	return null;
};

const locate = (layout: ReadonlyArray<BacklogSection>, taskId: string) => {
	for (const [sectionIndex, section] of layout.entries()) {
		const index = section.tasks.findIndex((task) => task.id === taskId);
		if (index >= 0) return { sectionIndex, section, index };
	}
	return null;
};

const sprintOf = (sectionId: string) => (sectionId === BACKLOG_SECTION ? null : sectionId);

/** A task dropped at `index` of a section (the index once it has left its old place). Null when nothing changes. */
export function rowDrop(
	layout: ReadonlyArray<BacklogSection>,
	taskId: string,
	sectionId: string,
	index: number,
): RankMove | null {
	const from = locate(layout, taskId);
	const target = layout.find((section) => section.id === sectionId);
	if (!from || !target) return null;
	const siblings = target.tasks.filter((task) => task.id !== taskId);
	const at = Math.max(0, Math.min(index, siblings.length));
	if (sectionId === from.section.id && at === from.index) return null;
	return {
		sprintId: sprintOf(sectionId),
		rank: keyBetweenNeighbours(usable(siblings, at - 1, -1), usable(siblings, at, 1)),
	};
}

/**
 * A keyboard move: one place up or down; past a section's edge it goes to the end of
 * the section above or the start of the one below. Null at the page's edges.
 */
export function rowStep(
	layout: ReadonlyArray<BacklogSection>,
	taskId: string,
	direction: "up" | "down",
): RankMove | null {
	const from = locate(layout, taskId);
	if (!from) return null;
	const to = from.index + (direction === "up" ? -1 : 1);
	if (to >= 0 && to < from.section.tasks.length) return rowDrop(layout, taskId, from.section.id, to);
	const next = layout[from.sectionIndex + (direction === "up" ? -1 : 1)];
	if (!next) return null;
	return rowDrop(layout, taskId, next.id, direction === "up" ? next.tasks.length : 0);
}

/** Where a task lands once a move is applied: its section and place (for announcements). */
export function rowPlace(layout: ReadonlyArray<BacklogSection>, taskId: string, move: RankMove) {
	const section = layout.find((each) => each.id === (move.sprintId ?? BACKLOG_SECTION));
	const siblings = (section?.tasks ?? []).filter((task) => task.id !== taskId);
	const index = siblings.filter((task) => compareOrderKeys(task.rank, move.rank) < 0).length;
	return { section, index, total: siblings.length + 1 };
}

/** A section's points (unestimated tasks count 0) and how many tasks have none. */
export function sectionPoints(tasks: ReadonlyArray<TaskSummary>): { points: number; unestimated: number } {
	return tasks.reduce(
		(sum, task) => ({
			points: sum.points + (task.points ?? 0),
			unestimated: sum.unestimated + (task.points === null ? 1 : 0),
		}),
		{ points: 0, unestimated: 0 },
	);
}

/** A section's estimate in minutes (Task 53), and how many of its tasks have none. */
export function sectionEstimate(tasks: ReadonlyArray<TaskSummary>): { minutes: number; unestimated: number } {
	return tasks.reduce(
		(sum, task) => ({
			minutes: sum.minutes + (task.estimateMinutes ?? 0),
			unestimated: sum.unestimated + (task.estimateMinutes === null ? 1 : 0),
		}),
		{ minutes: 0, unestimated: 0 },
	);
}
