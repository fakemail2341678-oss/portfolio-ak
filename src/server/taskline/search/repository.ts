import "@tanstack/react-start/server-only";
import { and, asc, count, desc, eq, inArray, isNull, type SQL, sql } from "drizzle-orm";
import type { TaskPriority } from "@/features/taskline/types";
import { tlStatus, tlTask } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/**
 * Search (Task 51): the tasks' `search` tsvector (`simple`: the title weighted A, the
 * description's text B; a GIN index) against a prefix query, ranked.
 */

/**
 * Words → a prefix tsquery ("desig hom" → `desig:* & hom:*`): every word must start a
 * word of the title or description. Words are only letters, marks and digits, so no
 * tsquery syntax can come from the browser; null when there are none.
 */
export function prefixQuery(q: string): string | null {
	// Anything but a letter, a mark or a digit separates words, as the tsvector's parser does ("sign-up": sign, up).
	const words = q
		.toLowerCase()
		.split(/[^\p{L}\p{M}\p{N}]+/u)
		.filter(Boolean)
		.slice(0, 8);
	return words.length === 0 ? null : words.map((word) => `${word}:*`).join(" & ");
}

const matchOf = (query: string): { where: SQL; rank: SQL } => {
	const tsquery = sql`to_tsquery('simple', ${query})`;
	return { where: sql`${tlTask.search} @@ ${tsquery}`, rank: sql`ts_rank(${tlTask.search}, ${tsquery})` };
};

const FOUND = {
	id: tlTask.id,
	projectId: tlTask.projectId,
	number: tlTask.number,
	type: tlTask.type,
	title: tlTask.title,
	priority: tlTask.priority,
	excerpt: sql<string>`left(${tlTask.descriptionText}, 180)`,
	closed: sql<boolean>`${tlTask.completedAt} is not null`,
	statusName: tlStatus.name,
	statusCategory: tlStatus.category,
	statusColor: tlStatus.color,
};

const selectFound = (db: Db, where: SQL | undefined) =>
	db.select(FOUND).from(tlTask).innerJoin(tlStatus, eq(tlStatus.id, tlTask.statusId)).where(where);

type Selected = Awaited<ReturnType<typeof selectFound>>[number];
export type FoundRow = Omit<Selected, "priority"> & { priority: TaskPriority };
const typed = (row: Selected): FoundRow => ({ ...row, priority: row.priority as TaskPriority });

/** One page of matching tasks (outside the trash) in `projectIds`, best first, and how many match in all. */
export async function searchTasks(
	db: Db,
	projectIds: string[],
	query: string,
	{ limit, offset }: { limit: number; offset: number },
) {
	if (projectIds.length === 0) return { rows: [], total: 0 };
	const { where, rank } = matchOf(query);
	const filter = and(inArray(tlTask.projectId, projectIds), isNull(tlTask.deletedAt), where);
	const [rows, [total]] = await Promise.all([
		selectFound(db, filter)
			// Open tasks before closed ones, then the best match, then the newest.
			.orderBy(sql`${tlTask.completedAt} is not null`, desc(rank), desc(tlTask.updatedAt), asc(tlTask.id))
			.limit(limit)
			.offset(offset),
		db.select({ value: count() }).from(tlTask).where(filter),
	]);
	return {
		rows: rows.map(typed),
		total: total?.value ?? 0,
	};
}

/** The task numbered `number` of a project, outside the trash (an exact reference), or null. */
export async function taskByNumber(db: Db, projectId: string, number: number): Promise<FoundRow | null> {
	const [row] = await selectFound(
		db,
		and(eq(tlTask.projectId, projectId), eq(tlTask.number, number), isNull(tlTask.deletedAt)),
	);
	return row ? typed(row) : null;
}
