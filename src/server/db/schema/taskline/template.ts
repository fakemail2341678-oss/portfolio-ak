import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { TemplateDefinition } from "../../../../features/taskline/template-definition";
import type { ProjectHealth } from "../../../../features/taskline/types";
import { tlProject } from "./project";
import { tlMember, tlWorkspace } from "./workspace";

/**
 * A team's project templates (Task 57, decision 0224); the built-ins live in code
 * (`src/server/taskline/templates/builtin.ts`). `definition` is checked against
 * `templateDefinition` when saved and read again when used.
 */
export const tlTemplate = pgTable(
	"tl_template",
	{
		id: uuid().primaryKey().defaultRandom(),
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		name: text().notNull(),
		description: text().notNull().default(""),
		definition: jsonb().$type<TemplateDefinition>().notNull(),
		/** Goes up when the form saves (a stale save is refused). */
		version: integer().notNull().default(1),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("tl_template_name_unique").on(table.workspaceId, sql`lower(${table.name})`),
		check("tl_template_name_valid", sql`length(${table.name}) between 1 and 80`),
	],
);

/**
 * A project update (Task 57): how a project is doing and a post about it, by its lead.
 * Posting one also sets the project's health. Written once; a lead may delete one.
 */
export const tlProjectUpdate = pgTable(
	"tl_project_update",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		/** Null: an admin without a member row, or a member since removed. */
		authorId: uuid().references(() => tlMember.id, { onDelete: "set null" }),
		health: text().$type<ProjectHealth>().notNull(),
		bodyHtml: text().notNull().default(""),
		bodyText: text().notNull().default(""),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("tl_project_update_project_idx").on(table.projectId, table.createdAt.desc()),
		check("tl_project_update_health_valid", sql`${table.health} in ('on_track', 'at_risk', 'off_track')`),
	],
);

export type TlTemplateRow = typeof tlTemplate.$inferSelect;
export type TlProjectUpdateRow = typeof tlProjectUpdate.$inferSelect;
