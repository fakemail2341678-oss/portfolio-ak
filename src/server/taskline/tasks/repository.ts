import "@tanstack/react-start/server-only";
import {
	type AnyColumn,
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	lte,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import type {
	ProjectActivity,
	TaskField,
	TaskPriority,
	TaskSummary,
	TaskType,
	TrashedTask,
} from "@/features/taskline/types";
import { generateKeyBetween, generateKeysBetween } from "@/lib/fractional-index";
import { type Paged, parseSort } from "@/lib/list/paging";
import { allOf, countRows, paginate, textSearch } from "@/server/db/list";
import {
	type TlStatusRow,
	type TlTaskRow,
	tlActivity,
	tlMember,
	tlStatus,
	tlTask,
	tlTaskDependency,
	tlTaskLabel,
	tlTaskWatcher,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { byPosition } from "../workflow/repository";

/** Tasks: plain reads and writes (numbers, history and rules are the service's). */

export const taskRef = (key: string, number: number) => `${key}-${number}`;

export function taskSummary(row: TlTaskRow, key: string, labelIds: string[], blocked: boolean): TaskSummary {
	return {
		id: row.id,
		ref: taskRef(key, row.number),
		number: row.number,
		type: row.type,
		title: row.title,
		statusId: row.statusId,
		priority: row.priority as TaskPriority,
		assigneeId: row.assigneeId,
		parentId: row.parentId,
		labelIds,
		position: row.position,
		startOn: row.startOn,
		dueOn: row.dueOn,
		completedAt: row.completedAt?.toISOString() ?? null,
		checklist: { done: row.checklist.filter((item) => item.done).length, total: row.checklist.length },
		updatedAt: row.updatedAt.toISOString(),
		sprintId: row.sprintId,
		points: row.points,
		rank: row.rank,
		estimateMinutes: row.estimateMinutes,
		milestoneId: row.milestoneId,
		blocked,
		fields: row.fields,
		recurrence: row.recurrence,
	};
}

/** The backlog's order (Task 52): rank keys compared by code unit, as positions are. */
export const byRank = (column: AnyColumn) => sql`${column} collate "C"`;

/** The rank after every task of the project (trashed ones too): where a new task goes in the backlog. */
export async function endRank(db: Db, projectId: string): Promise<string> {
	const [row] = await db
		.select({ rank: tlTask.rank })
		.from(tlTask)
		.where(eq(tlTask.projectId, projectId))
		.orderBy(desc(byRank(tlTask.rank)))
		.limit(1);
	return generateKeyBetween(row?.rank ?? null, null);
}

/** `count` ranks after every task of the project (the CSV import's). */
export async function endRanks(db: Db, projectId: string, count: number): Promise<string[]> {
	const [row] = await db
		.select({ rank: tlTask.rank })
		.from(tlTask)
		.where(eq(tlTask.projectId, projectId))
		.orderBy(desc(byRank(tlTask.rank)))
		.limit(1);
	return generateKeysBetween(row?.rank ?? null, null, count);
}

/** Each task's label ids. */
export async function labelIdsOf(db: Db, taskIds: string[]): Promise<Map<string, string[]>> {
	const map = new Map<string, string[]>();
	if (taskIds.length === 0) return map;
	const rows = await db
		.select({ taskId: tlTaskLabel.taskId, labelId: tlTaskLabel.labelId })
		.from(tlTaskLabel)
		.where(inArray(tlTaskLabel.taskId, taskIds))
		.orderBy(asc(tlTaskLabel.labelId));
	for (const row of rows) map.set(row.taskId, [...(map.get(row.taskId) ?? []), row.labelId]);
	return map;
}

/** An open task blocks: outside the trash and not closed (completed or canceled), in any project (Task 54). */
const OPEN_BLOCKER = sql`exists (select 1 from ${tlTaskDependency} join ${tlTask} as blocker on blocker.id = ${tlTaskDependency.blockerId} where ${tlTaskDependency.blockedId} = ${tlTask.id} and blocker.deleted_at is null and blocker.completed_at is null)`;

/** Which of these tasks an open task blocks. */
export async function openBlockedIds(db: Db, taskIds: ReadonlyArray<string>): Promise<Set<string>> {
	if (taskIds.length === 0) return new Set();
	const rows = await db
		.selectDistinct({ id: tlTaskDependency.blockedId })
		.from(tlTaskDependency)
		.innerJoin(tlTask, eq(tlTask.id, tlTaskDependency.blockerId))
		.where(
			and(inArray(tlTaskDependency.blockedId, [...taskIds]), isNull(tlTask.deletedAt), isNull(tlTask.completedAt)),
		);
	return new Set(rows.map((row) => row.id));
}

export async function summaries(db: Db, rows: TlTaskRow[], key: string): Promise<TaskSummary[]> {
	const ids = rows.map((row) => row.id);
	const [labels, blocked] = await Promise.all([labelIdsOf(db, ids), openBlockedIds(db, ids)]);
	return rows.map((row) => taskSummary(row, key, labels.get(row.id) ?? [], blocked.has(row.id)));
}

/** A project's tasks outside the trash, in board order (status, then position). */
export async function listTasks(db: Db, projectId: string): Promise<TlTaskRow[]> {
	return db
		.select()
		.from(tlTask)
		.where(and(eq(tlTask.projectId, projectId), isNull(tlTask.deletedAt)))
		.orderBy(asc(tlTask.statusId), byPosition(tlTask.position), asc(tlTask.id));
}

export async function subtasksOf(db: Db, parentId: string): Promise<TlTaskRow[]> {
	return db
		.select()
		.from(tlTask)
		.where(and(eq(tlTask.parentId, parentId), isNull(tlTask.deletedAt)))
		.orderBy(asc(tlTask.number));
}

export async function getByNumber(db: Db, projectId: string, number: number): Promise<TlTaskRow | null> {
	const [row] = await db
		.select()
		.from(tlTask)
		.where(and(eq(tlTask.projectId, projectId), eq(tlTask.number, number)));
	return row ?? null;
}

export async function getById(db: Db, projectId: string, taskId: string): Promise<TlTaskRow | null> {
	const [row] = await db
		.select()
		.from(tlTask)
		.where(and(eq(tlTask.projectId, projectId), eq(tlTask.id, taskId)));
	return row ?? null;
}

/** Tasks of the workspace outside the trash: what its quota counts. */
export async function countTasks(db: Db, workspaceId: string): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(tlTask)
		.where(and(eq(tlTask.workspaceId, workspaceId), isNull(tlTask.deletedAt)));
	return row?.total ?? 0;
}

/** Tasks in a status, trashed ones included (deleting a status moves them all). */
export async function countInStatus(db: Db, statusId: string): Promise<number> {
	const [row] = await db.select({ total: count() }).from(tlTask).where(eq(tlTask.statusId, statusId));
	return row?.total ?? 0;
}

/** The order key of the last task in a status (trashed ones too), or null for an empty one. */
export async function lastInStatus(db: Db, statusId: string): Promise<string | null> {
	const [row] = await db
		.select({ position: tlTask.position })
		.from(tlTask)
		.where(eq(tlTask.statusId, statusId))
		.orderBy(desc(byPosition(tlTask.position)))
		.limit(1);
	return row?.position ?? null;
}

/** The key after the last task in a status: where a new or moved-in task goes. */
export async function endOfStatus(db: Db, statusId: string): Promise<string> {
	return generateKeyBetween(await lastInStatus(db, statusId), null);
}

/** A new task; without a rank, it goes at the end of the backlog's order. */
export async function insertTask(
	tx: Tx,
	values: Omit<typeof tlTask.$inferInsert, "rank"> & { rank?: string },
): Promise<TlTaskRow> {
	const rank = values.rank ?? (await endRank(tx, values.projectId));
	const [row] = await tx
		.insert(tlTask)
		.values({ ...values, rank })
		.returning();
	if (!row) throw new Error("Task insert returned no row");
	return row;
}

/** Many tasks at once (the CSV import), in batches far under Postgres' parameter limit. */
export async function insertTasks(tx: Tx, values: ReadonlyArray<typeof tlTask.$inferInsert>): Promise<void> {
	for (let start = 0; start < values.length; start += 200) {
		await tx.insert(tlTask).values(values.slice(start, start + 200));
	}
}

/** Labels and watchers of many new tasks at once (the CSV import). */
export async function linkTasks(
	tx: Tx,
	labels: ReadonlyArray<{ taskId: string; labelId: string }>,
	watchers: ReadonlyArray<{ taskId: string; memberId: string }>,
): Promise<void> {
	for (let start = 0; start < labels.length; start += 1000) {
		await tx
			.insert(tlTaskLabel)
			.values(labels.slice(start, start + 1000))
			.onConflictDoNothing();
	}
	for (let start = 0; start < watchers.length; start += 1000) {
		await tx
			.insert(tlTaskWatcher)
			.values(watchers.slice(start, start + 1000))
			.onConflictDoNothing();
	}
}

export type TaskPatch = Partial<
	Pick<
		TlTaskRow,
		| "type"
		| "priority"
		| "assigneeId"
		| "parentId"
		| "startOn"
		| "dueOn"
		| "statusId"
		| "position"
		| "completedAt"
		| "checklist"
		| "deletedAt"
		| "sprintId"
		| "points"
		| "estimateMinutes"
		| "milestoneId"
		| "rank"
		| "recurrence"
	>
>;

/** A last-write-wins change: the version stays. */
export async function patchTask(tx: Tx, taskId: string, set: TaskPatch): Promise<TlTaskRow> {
	const [row] = await tx.update(tlTask).set(set).where(eq(tlTask.id, taskId)).returning();
	if (!row) throw new Error("Task update returned no row");
	return row;
}

export async function setLabels(tx: Tx, taskId: string, labelIds: ReadonlyArray<string>): Promise<void> {
	await tx.delete(tlTaskLabel).where(eq(tlTaskLabel.taskId, taskId));
	if (labelIds.length > 0) await tx.insert(tlTaskLabel).values(labelIds.map((labelId) => ({ taskId, labelId })));
}

/** Makes members watchers of a task (creating it, being assigned and commenting do). */
export async function addWatchers(tx: Tx, taskId: string, memberIds: ReadonlyArray<string | null>): Promise<void> {
	const ids = [...new Set(memberIds.filter((id): id is string => id !== null))];
	if (ids.length === 0) return;
	await tx
		.insert(tlTaskWatcher)
		.values(ids.map((memberId) => ({ taskId, memberId })))
		.onConflictDoNothing();
}

/** A task's subtasks and theirs (two levels at most, MAX_TASK_DEPTH), trashed or not. */
export async function descendantsOf(db: Db, taskId: string): Promise<TlTaskRow[]> {
	const children = await db.select().from(tlTask).where(eq(tlTask.parentId, taskId));
	if (children.length === 0) return [];
	const grandchildren = await db
		.select()
		.from(tlTask)
		.where(
			inArray(
				tlTask.parentId,
				children.map((child) => child.id),
			),
		);
	return [...children, ...grandchildren];
}

/** How many ancestors a task has (0: a top-level task). */
export async function depthOf(db: Db, task: Pick<TlTaskRow, "parentId">): Promise<number> {
	let depth = 0;
	let parentId = task.parentId;
	while (parentId && depth <= 3) {
		const [parent] = await db.select({ parentId: tlTask.parentId }).from(tlTask).where(eq(tlTask.id, parentId));
		depth += 1;
		parentId = parent?.parentId ?? null;
	}
	return depth;
}

/** Sets `completed_at` of every task in a status whose category now closes (or opens) them. */
export async function syncCompletedAt(tx: Tx, statusId: string, closed: boolean): Promise<void> {
	await tx
		.update(tlTask)
		.set({ completedAt: closed ? sql`coalesce(${tlTask.completedAt}, now())` : null })
		.where(eq(tlTask.statusId, statusId));
}

/**
 * Moves every task of a status (trashed ones too) to the end of `to`, in their order,
 * with `completed_at` following `to`'s category.
 */
export async function moveAllToStatus(tx: Tx, fromStatusId: string, to: TlStatusRow, closed: boolean): Promise<number> {
	const rows = await tx
		.select({ id: tlTask.id })
		.from(tlTask)
		.where(eq(tlTask.statusId, fromStatusId))
		.orderBy(byPosition(tlTask.position), asc(tlTask.id));
	if (rows.length === 0) return 0;
	const [after] = await tx
		.select({ position: tlTask.position })
		.from(tlTask)
		.where(eq(tlTask.statusId, to.id))
		.orderBy(desc(byPosition(tlTask.position)))
		.limit(1);
	const keys = generateKeysBetween(after?.position ?? null, null, rows.length);
	for (const [index, row] of rows.entries()) {
		await tx
			.update(tlTask)
			.set({
				statusId: to.id,
				position: keys[index] ?? generateKeyBetween(after?.position ?? null, null),
				completedAt: closed ? sql`coalesce(${tlTask.completedAt}, now())` : null,
			})
			.where(eq(tlTask.id, row.id));
	}
	return rows.length;
}

/** Puts tasks in the trash (or takes them out, with null), all with the same time. */
export async function setDeleted(tx: Tx, taskIds: string[], at: Date | null): Promise<void> {
	if (taskIds.length === 0) return;
	await tx.update(tlTask).set({ deletedAt: at }).where(inArray(tlTask.id, taskIds));
}

/** Tasks of a project by id (trashed ones too: the caller decides). */
export async function getByIds(db: Db, projectId: string, taskIds: ReadonlyArray<string>): Promise<TlTaskRow[]> {
	if (taskIds.length === 0) return [];
	return db
		.select()
		.from(tlTask)
		.where(and(eq(tlTask.projectId, projectId), inArray(tlTask.id, [...taskIds])))
		.orderBy(asc(tlTask.number));
}

/** Deletes tasks for good (their subtasks, labels, watchers and history cascade). */
export async function deleteTasks(tx: Tx, taskIds: ReadonlyArray<string>): Promise<void> {
	if (taskIds.length === 0) return;
	await tx.delete(tlTask).where(inArray(tlTask.id, [...taskIds]));
}

/** Adds one label to tasks (those that have it keep it). */
export async function addLabel(tx: Tx, taskIds: ReadonlyArray<string>, labelId: string): Promise<void> {
	if (taskIds.length === 0) return;
	await tx
		.insert(tlTaskLabel)
		.values(taskIds.map((taskId) => ({ taskId, labelId })))
		.onConflictDoNothing();
}

export async function removeLabel(tx: Tx, taskIds: ReadonlyArray<string>, labelId: string): Promise<void> {
	if (taskIds.length === 0) return;
	await tx.delete(tlTaskLabel).where(and(inArray(tlTaskLabel.taskId, [...taskIds]), eq(tlTaskLabel.labelId, labelId)));
}

/** What the list view filters by (search.ts's taskFilterParams, resolved: `me` is a member id or nothing). */
export type TaskListFilters = {
	q: string;
	statusId?: string;
	/** A member's id, `none` (unassigned), or `nobody` (`me` for a caller without a member row: matches nothing). */
	assignee?: string;
	labelId?: string;
	priority?: number;
	type?: TaskType;
	due?: "overdue" | "week" | "none";
	/** A sprint's id, `none` (the backlog), or `nobody` (`active` when there's none: matches nothing). */
	sprint?: string;
	/** Task 54: a milestone's id or `none`; blocked by an open task, or not. */
	milestone?: string;
	blocked?: boolean;
	/** Task 55: field filters (a `me` already the caller's member id, or null for nobody). */
	fields?: ReadonlyArray<{ field: Pick<TaskField, "id" | "type">; value: string | null }>;
	today: string;
	weekEnd: string;
};

/**
 * One field filter as SQL (`matchesFieldFilter` in the browser means the same): a value
 * or none, a ticked box, a day before or from today, or one value (`@>`, so a
 * multiple choice matches when it holds the option). Both `?` and `@>` use the GIN index.
 */
function fieldWhere(field: Pick<TaskField, "id" | "type">, value: string | null, today: string): SQL {
	const has = sql`${tlTask.fields} ? ${field.id}`;
	const contains = (json: unknown) => sql`${tlTask.fields} @> ${JSON.stringify({ [field.id]: json })}::jsonb`;
	switch (value) {
		case null:
			return sql`false`;
		case "any":
			return has;
		case "none":
		case "no":
			return sql`not (${has})`;
		case "yes":
			return contains(true);
		case "past":
			return sql`(${tlTask.fields} ->> ${field.id}::text) < ${today}`;
		case "future":
			return sql`(${tlTask.fields} ->> ${field.id}::text) >= ${today}`;
		default:
			return contains(field.type === "multi_select" ? [value] : value);
	}
}

/** The list view's WHERE: a project's tasks outside the trash, filtered. */
export function listWhere(projectId: string, filters: TaskListFilters): SQL | undefined {
	const number = /^(?:[A-Z][A-Z0-9]{1,5}-)?([1-9][0-9]{0,8})$/i.exec(filters.q)?.[1];
	return allOf(
		eq(tlTask.projectId, projectId),
		isNull(tlTask.deletedAt),
		filters.q
			? or(
					textSearch(filters.q, [tlTask.title, tlTask.descriptionText]),
					number ? eq(tlTask.number, Number(number)) : undefined,
				)
			: undefined,
		filters.statusId ? eq(tlTask.statusId, filters.statusId) : undefined,
		filters.assignee === "none"
			? isNull(tlTask.assigneeId)
			: filters.assignee === "nobody"
				? sql`false`
				: filters.assignee
					? eq(tlTask.assigneeId, filters.assignee)
					: undefined,
		filters.labelId
			? sql`exists (select 1 from ${tlTaskLabel} where ${tlTaskLabel.taskId} = ${tlTask.id} and ${tlTaskLabel.labelId} = ${filters.labelId})`
			: undefined,
		filters.priority === undefined ? undefined : eq(tlTask.priority, filters.priority),
		filters.type ? eq(tlTask.type, filters.type) : undefined,
		filters.due === "none"
			? isNull(tlTask.dueOn)
			: filters.due === "overdue"
				? and(lt(tlTask.dueOn, filters.today), isNull(tlTask.completedAt))
				: filters.due === "week"
					? and(gte(tlTask.dueOn, filters.today), lte(tlTask.dueOn, filters.weekEnd))
					: undefined,
		filters.sprint === "none"
			? isNull(tlTask.sprintId)
			: filters.sprint === "nobody"
				? sql`false`
				: filters.sprint
					? eq(tlTask.sprintId, filters.sprint)
					: undefined,
		filters.milestone === "none"
			? isNull(tlTask.milestoneId)
			: filters.milestone
				? eq(tlTask.milestoneId, filters.milestone)
				: undefined,
		filters.blocked === undefined ? undefined : filters.blocked ? OPEN_BLOCKER : sql`not ${OPEN_BLOCKER}`,
		...(filters.fields ?? []).map(({ field, value }) => fieldWhere(field, value, filters.today)),
	);
}

/** The status's place on the board, as a sortable expression (statuses order by key). */
const statusOrder = sql`(select ${tlStatus.position} from ${tlStatus} where ${tlStatus.id} = ${tlTask.statusId}) collate "C"`;
/** The assignee's name; unassigned tasks last. */
const assigneeOrder = sql`(select lower(${tlMember.displayName}) from ${tlMember} where ${tlMember.id} = ${tlTask.assigneeId})`;

/**
 * A page of the list view: the sort (board order by default) after the grouping, so
 * a group's rows are together on a page.
 */
export async function listPage(
	db: Db,
	projectId: string,
	key: string,
	{
		filters,
		sort,
		group,
		page,
		pageSize,
	}: {
		filters: TaskListFilters;
		sort: string;
		group: "none" | "status" | "assignee";
		page: number;
		pageSize: number;
	},
): Promise<Paged<TaskSummary>> {
	const where = listWhere(projectId, filters);
	const { field, direction } = parseSort(sort);
	const dir = (column: SQL | AnyColumn) => (direction === "desc" ? desc(column) : asc(column));
	const groupBy =
		group === "status" ? [asc(statusOrder)] : group === "assignee" ? [sql`${assigneeOrder} asc nulls last`] : [];
	const sortBy =
		field === "status"
			? [dir(statusOrder), dir(byPosition(tlTask.position))]
			: field === "due"
				? [sql`${tlTask.dueOn} ${sql.raw(direction)} nulls last`]
				: [
						dir(
							{
								updated: tlTask.updatedAt,
								number: tlTask.number,
								title: sql`lower(${tlTask.title})`,
								priority: tlTask.priority,
							}[field] ?? tlTask.number,
						),
					];
	const result = await paginate(
		{ page, pageSize },
		{
			count: () => countRows(db, tlTask, where),
			rows: ({ limit, offset }) =>
				db
					.select()
					.from(tlTask)
					.where(where)
					.orderBy(...groupBy, ...sortBy, asc(tlTask.number))
					.limit(limit)
					.offset(offset),
		},
		(row) => row,
	);
	return { ...result, items: await summaries(db, result.items, key) };
}

/** A project's latest history, newest first, with the task each entry is about (the overview's feed). */
export async function projectActivity(
	db: Db,
	projectId: string,
	key: string,
	limit: number,
): Promise<ProjectActivity[]> {
	const rows = await db
		.select({ activity: tlActivity, number: tlTask.number, title: tlTask.title })
		.from(tlActivity)
		.leftJoin(tlTask, eq(tlTask.id, tlActivity.taskId))
		.where(eq(tlActivity.projectId, projectId))
		.orderBy(desc(tlActivity.at), desc(tlActivity.id))
		.limit(limit);
	return rows.map(({ activity, number, title }) => ({
		id: activity.id,
		kind: activity.kind,
		actorId: activity.actorId,
		data: activity.data,
		at: activity.at.toISOString(),
		task: number !== null && title !== null ? { ref: taskRef(key, number), title } : null,
	}));
}

export async function listTrash(db: Db, projectId: string, key: string): Promise<TrashedTask[]> {
	const rows = await db
		.select({ id: tlTask.id, number: tlTask.number, title: tlTask.title, deletedAt: tlTask.deletedAt })
		.from(tlTask)
		.where(and(eq(tlTask.projectId, projectId), isNotNull(tlTask.deletedAt)))
		.orderBy(desc(tlTask.deletedAt), desc(tlTask.number));
	return rows.map((row) => ({
		id: row.id,
		ref: taskRef(key, row.number),
		title: row.title,
		deletedAt: row.deletedAt?.toISOString() ?? "",
	}));
}
