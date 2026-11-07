import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tlProject } from "./project";
import { tlTask } from "./task";
import { tlMember, tlWorkspace } from "./workspace";

/**
 * Time tracking (Task 53, decision 0218): what a member spent on a task, logged by
 * hand (a day and minutes) or by the timer (`started_at` stamped by the server; a
 * running timer has no `ended_at`, and each member has at most one). An entry
 * outlives its task: purging a task leaves its time on the project (`task_id` null),
 * so timesheets and exports keep adding up.
 */
export const tlTimeEntry = pgTable(
	"tl_time_entry",
	{
		id: uuid().primaryKey().defaultRandom(),
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		taskId: uuid().references(() => tlTask.id, { onDelete: "set null" }),
		memberId: uuid()
			.notNull()
			.references(() => tlMember.id, { onDelete: "cascade" }),
		/** The day it counts on, in the workspace's time zone (a timer's: the day it started). */
		onDay: date({ mode: "string" }).notNull(),
		/** 0 while a timer runs; a day at most. */
		minutes: integer().notNull().default(0),
		/** A timer's start and end, from the server's clock; both null for an entry logged by hand. */
		startedAt: timestamp({ withTimezone: true }),
		endedAt: timestamp({ withTimezone: true }),
		note: text().notNull().default(""),
		billable: boolean().notNull().default(false),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("tl_time_entry_member_day_idx").on(table.memberId, table.onDay),
		index("tl_time_entry_project_day_idx").on(table.projectId, table.onDay),
		index("tl_time_entry_workspace_day_idx").on(table.workspaceId, table.onDay),
		index("tl_time_entry_task_idx").on(table.taskId),
		uniqueIndex("tl_time_entry_one_running")
			.on(table.memberId)
			.where(sql`${table.startedAt} is not null and ${table.endedAt} is null`),
		check("tl_time_entry_minutes_valid", sql`${table.minutes} between 0 and 1440`),
		check("tl_time_entry_timer_valid", sql`${table.endedAt} is null or ${table.startedAt} is not null`),
	],
);

export type TlTimeEntryRow = typeof tlTimeEntry.$inferSelect;
