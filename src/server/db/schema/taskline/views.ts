import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { SavedViewKind, TaskImportResult } from "../../../../features/taskline/types";
import { user } from "../auth";
import { tlProject } from "./project";
import { tlMember, tlWorkspace } from "./workspace";

/**
 * Finding things (Task 51): a project's saved views and the CSV imports' idempotency
 * keys. A saved view is a search string for one of the project's views (the URL is
 * the view's state), its member's own or shared with the project.
 */

export const tlSavedView = pgTable(
	"tl_saved_view",
	{
		id: uuid().primaryKey().defaultRandom(),
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		/** Who saved it (and may delete it; a shared one, the project's lead too). */
		memberId: uuid()
			.notNull()
			.references(() => tlMember.id, { onDelete: "cascade" }),
		name: text().notNull(),
		view: text().$type<SavedViewKind>().notNull(),
		/** The view's search string ("?status=…&sort=due"), or "" for none. */
		search: text().notNull(),
		shared: boolean().notNull().default(false),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		// Saving a name again replaces that view (each member's names, per project and view, any case).
		uniqueIndex("tl_saved_view_name_unique").on(table.projectId, table.memberId, table.view, sql`lower(${table.name})`),
		index("tl_saved_view_project_idx").on(table.projectId, table.view),
		check("tl_saved_view_kind_valid", sql`${table.view} in ('list', 'board', 'calendar')`),
		check(
			"tl_saved_view_search_valid",
			sql`${table.search} = '' or (left(${table.search}, 1) = '?' and length(${table.search}) <= 2000)`,
		),
	],
);

/**
 * A CSV import of tasks, once per idempotency key (Expenses' pattern, 0192): the key
 * is claimed in the import's transaction, so a retry waits for the first and gets
 * its result; the same key with other rows is refused.
 */
export const tlImport = pgTable(
	"tl_import",
	{
		key: uuid().primaryKey(),
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		/** The account that imported: a retry by anyone else is refused. */
		userId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** A hash of the rows: the same key with other rows is refused. */
		fingerprint: text().notNull(),
		result: jsonb().$type<TaskImportResult>(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("tl_import_project_idx").on(table.projectId)],
);

export type TlSavedViewRow = typeof tlSavedView.$inferSelect;
