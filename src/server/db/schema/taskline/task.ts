import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	check,
	customType,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type {
	ActivityData,
	ActivityKind,
	ChecklistItem,
	Recurrence,
	TaskFieldValues,
	TaskType,
} from "../../../../features/taskline/types";
import { tlMilestone } from "./milestone";
import { tlLabel, tlProject, tlStatus } from "./project";
import { tlSprint } from "./sprint";
import { tlMember, tlWorkspace } from "./workspace";

/**
 * Tasks and their history. A task's number comes from its project's `task_seq`
 * under the project's row lock; `deleted_at` is the trash; `completed_at` follows
 * its status's category. `tl_activity` is the app's history (never the admin audit log, 0205).
 */

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const tlTask = pgTable(
	"tl_task",
	{
		id: uuid().primaryKey().defaultRandom(),
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		number: integer().notNull(),
		type: text().$type<TaskType>().notNull().default("task"),
		title: text().notNull(),
		descriptionHtml: text().notNull().default(""),
		descriptionText: text().notNull().default(""),
		/** A status is deleted only after its tasks moved (the service moves them). */
		statusId: uuid()
			.notNull()
			.references(() => tlStatus.id, { onDelete: "restrict" }),
		priority: smallint().notNull().default(0),
		assigneeId: uuid().references(() => tlMember.id, { onDelete: "set null" }),
		reporterId: uuid().references(() => tlMember.id, { onDelete: "set null" }),
		parentId: uuid().references((): AnyPgColumn => tlTask.id, { onDelete: "cascade" }),
		/** The order key within its status (the board's column). */
		position: text().notNull(),
		checklist: jsonb().$type<ChecklistItem[]>().notNull().default([]),
		startOn: date({ mode: "string" }),
		dueOn: date({ mode: "string" }),
		completedAt: timestamp({ withTimezone: true }),
		/** Task 52: the sprint it's planned in (null: the backlog); a deleted sprint leaves its tasks in the backlog. */
		sprintId: uuid().references(() => tlSprint.id, { onDelete: "set null" }),
		/** The estimate in points (null: not estimated). */
		points: smallint(),
		/** Task 53: the estimate in minutes (null: not estimated), what a sprint counts when the project estimates in time. */
		estimateMinutes: integer(),
		/** Task 54: the milestone it leads to; a deleted milestone leaves its tasks without one. */
		milestoneId: uuid().references(() => tlMilestone.id, { onDelete: "set null" }),
		/** Task 55: custom field values by field id (`tl_field`), checked against their definitions by the server. */
		fields: jsonb().$type<TaskFieldValues>().notNull().default({}),
		/** Task 56: how it repeats; closing it creates the next task, which takes the rule over. */
		recurrence: jsonb().$type<Recurrence>(),
		/** The backlog's order (a fractional key across the project, compared with COLLATE "C"). */
		rank: text().notNull(),
		/** Bumped by each save of the title or the description only: other fields are last-write-wins. */
		version: integer().notNull().default(1),
		search: tsvector().generatedAlwaysAs(
			sql`setweight(to_tsvector('simple', title), 'A') || setweight(to_tsvector('simple', description_text), 'B')`,
		),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		deletedAt: timestamp({ withTimezone: true }),
	},
	(table) => [
		uniqueIndex("tl_task_number_unique").on(table.projectId, table.number),
		index("tl_task_status_idx").on(table.statusId, table.position),
		index("tl_task_assignee_idx").on(table.assigneeId),
		index("tl_task_parent_idx").on(table.parentId),
		index("tl_task_workspace_due_idx").on(table.workspaceId, table.dueOn),
		index("tl_task_search_idx").using("gin", table.search),
		index("tl_task_sprint_idx").on(table.sprintId),
		index("tl_task_milestone_idx").on(table.milestoneId),
		/** The fields' filters: `?` (has a value) and `@>` (has this value) use it. */
		index("tl_task_fields_idx").using("gin", table.fields),
		check("tl_task_points_valid", sql`${table.points} between 0 and 100`),
		check("tl_task_estimate_valid", sql`${table.estimateMinutes} between 0 and 60000`),
		check("tl_task_type_valid", sql`${table.type} in ('task', 'bug', 'story', 'epic')`),
		check("tl_task_priority_valid", sql`${table.priority} between 0 and 4`),
		check("tl_task_not_own_parent", sql`${table.parentId} <> ${table.id}`),
	],
);

export const tlTaskLabel = pgTable(
	"tl_task_label",
	{
		taskId: uuid()
			.notNull()
			.references(() => tlTask.id, { onDelete: "cascade" }),
		labelId: uuid()
			.notNull()
			.references(() => tlLabel.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.taskId, table.labelId] }),
		index("tl_task_label_label_idx").on(table.labelId),
	],
);

/**
 * Dependencies (Task 54): `blocker_id` blocks `blocked_id`. Both tasks are in one
 * workspace (the service checks; projects may differ). Never a task on itself (a
 * check) and never a cycle (the service walks the graph with a recursive CTE under
 * the workspace's lock). Deleting either task for good takes the row with it.
 */
export const tlTaskDependency = pgTable(
	"tl_task_dependency",
	{
		blockerId: uuid()
			.notNull()
			.references(() => tlTask.id, { onDelete: "cascade" }),
		blockedId: uuid()
			.notNull()
			.references(() => tlTask.id, { onDelete: "cascade" }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.blockerId, table.blockedId] }),
		index("tl_task_dependency_blocked_idx").on(table.blockedId),
		check("tl_task_dependency_not_self", sql`${table.blockerId} <> ${table.blockedId}`),
	],
);

export const tlTaskWatcher = pgTable(
	"tl_task_watcher",
	{
		taskId: uuid()
			.notNull()
			.references(() => tlTask.id, { onDelete: "cascade" }),
		memberId: uuid()
			.notNull()
			.references(() => tlMember.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.taskId, table.memberId] }),
		index("tl_task_watcher_member_idx").on(table.memberId),
	],
);

export const tlActivity = pgTable(
	"tl_activity",
	{
		id: uuid().primaryKey().defaultRandom(),
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		taskId: uuid().references(() => tlTask.id, { onDelete: "cascade" }),
		actorId: uuid().references(() => tlMember.id, { onDelete: "set null" }),
		kind: text().$type<ActivityKind>().notNull(),
		data: jsonb().$type<ActivityData>().notNull().default({}),
		at: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("tl_activity_project_idx").on(table.projectId, table.at.desc()),
		/** The admin's activity page reads the whole team's, newest first (Task 49). */
		index("tl_activity_workspace_idx").on(table.workspaceId, table.at.desc()),
		index("tl_activity_task_idx").on(table.taskId, table.at),
	],
);

export type TlTaskRow = typeof tlTask.$inferSelect;
