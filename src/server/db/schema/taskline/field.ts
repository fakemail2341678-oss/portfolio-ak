import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { FieldOption, FieldType } from "../../../../features/taskline/types";
import { tlProject } from "./project";
import { tlWorkspace } from "./workspace";

/**
 * Custom fields (Task 55, decision 0220): the workspace's (`project_id` null, the
 * admin's) or a project's (its lead's). A task's values are `tl_task.fields`, keyed by
 * this row's id and checked against it by the server; a select's values are option ids
 * (from `options`), so renaming an option keeps them. Archiving keeps every value.
 */
export const tlField = pgTable(
	"tl_field",
	{
		id: uuid().primaryKey().defaultRandom(),
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		/** Null: a workspace field, on every project's tasks. */
		projectId: uuid().references(() => tlProject.id, { onDelete: "cascade" }),
		name: text().notNull(),
		type: text().$type<FieldType>().notNull(),
		/** A select's choices, in order (empty for the other types). */
		options: jsonb().$type<FieldOption[]>().notNull().default([]),
		required: boolean().notNull().default(false),
		/** The order within its scope (a fractional key, compared with COLLATE "C"). */
		position: text().notNull(),
		archivedAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		// A name once per scope, in any case (as labels).
		uniqueIndex("tl_field_workspace_name_unique")
			.on(table.workspaceId, sql`lower(${table.name})`)
			.where(sql`${table.projectId} is null`),
		uniqueIndex("tl_field_project_name_unique")
			.on(table.projectId, sql`lower(${table.name})`)
			.where(sql`${table.projectId} is not null`),
		index("tl_field_workspace_idx").on(table.workspaceId),
		check("tl_field_name_valid", sql`length(${table.name}) between 1 and 40`),
		check(
			"tl_field_type_valid",
			sql`${table.type} in ('text', 'number', 'select', 'multi_select', 'date', 'member', 'checkbox', 'url')`,
		),
	],
);

export type TlFieldRow = typeof tlField.$inferSelect;
