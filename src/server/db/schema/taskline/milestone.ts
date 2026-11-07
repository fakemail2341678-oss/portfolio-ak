import { sql } from "drizzle-orm";
import { check, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tlProject } from "./project";

/**
 * Milestones (Task 54): a project's checkpoints, each with a day it's due and the
 * tasks that lead to it (`tl_task.milestone_id`). Ordered by `position` (a fractional
 * order key, compared with COLLATE "C" as statuses are); completing one is a stamp.
 */
export const tlMilestone = pgTable(
	"tl_milestone",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		name: text().notNull(),
		description: text().notNull().default(""),
		dueOn: date({ mode: "string" }),
		completedAt: timestamp({ withTimezone: true }),
		position: text().notNull(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("tl_milestone_project_idx").on(table.projectId),
		check("tl_milestone_name_valid", sql`length(${table.name}) between 1 and 80`),
	],
);

export type TlMilestoneRow = typeof tlMilestone.$inferSelect;
