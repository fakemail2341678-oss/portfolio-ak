import { sql } from "drizzle-orm";
import {
	check,
	date,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type { SprintState } from "../../../../features/taskline/types";
import { tlProject } from "./project";

/**
 * Sprints (Task 52): a project's time boxes, planned, then active (one at a time, a
 * partial unique index), then completed. What was committed at the start and done at
 * the end is stored on the row; the burndown reads a snapshot per day (decision 0216).
 */

export const tlSprint = pgTable(
	"tl_sprint",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		name: text().notNull(),
		goal: text().notNull().default(""),
		state: text().$type<SprintState>().notNull().default("planned"),
		startOn: date({ mode: "string" }).notNull(),
		endOn: date({ mode: "string" }).notNull(),
		startedAt: timestamp({ withTimezone: true }),
		completedAt: timestamp({ withTimezone: true }),
		/** The scope when it started (canceled tasks aside). */
		committedPoints: integer(),
		committedTasks: integer(),
		/** Task 53: the estimates in minutes, for a project that estimates in time. */
		committedMinutes: integer(),
		/** What was completed when it completed. */
		completedPoints: integer(),
		completedTasks: integer(),
		completedMinutes: integer(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("tl_sprint_project_idx").on(table.projectId, table.startOn),
		uniqueIndex("tl_sprint_one_active").on(table.projectId).where(sql`${table.state} = 'active'`),
		check("tl_sprint_state_valid", sql`${table.state} in ('planned', 'active', 'completed')`),
		check("tl_sprint_dates_valid", sql`${table.endOn} >= ${table.startOn}`),
	],
);

/**
 * A sprint's totals at a day's close, written by the daily job (and at the start and
 * the end): the burndown's points. Idempotent: (sprint, day) is the key.
 */
export const tlSprintSnapshot = pgTable(
	"tl_sprint_snapshot",
	{
		sprintId: uuid()
			.notNull()
			.references(() => tlSprint.id, { onDelete: "cascade" }),
		day: date({ mode: "string" }).notNull(),
		scopePoints: integer().notNull(),
		donePoints: integer().notNull(),
		scopeTasks: integer().notNull(),
		doneTasks: integer().notNull(),
		/** Task 53: the same in estimated minutes (0 before the migration). */
		scopeMinutes: integer().notNull().default(0),
		doneMinutes: integer().notNull().default(0),
		takenAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [primaryKey({ columns: [table.sprintId, table.day] })],
);

export type TlSprintRow = typeof tlSprint.$inferSelect;
