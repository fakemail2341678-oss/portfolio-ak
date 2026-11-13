import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { khPerson } from "./person";

/**
 * Spend's own tables (Task 93, decision 0287). A saved search is a named query in the
 * search language, the caller's alone, in their order; the built-in ones (This month,
 * Uncategorized, Unsettled, Receipts) are in code. An import is one CSV import, by the
 * idempotency key its page made: a repeat waits for the first and gets its result.
 */
export const khSavedSearch = pgTable(
	"kh_saved_search",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		name: text().notNull(),
		query: text().notNull(),
		position: integer().notNull(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("kh_saved_search_owner_idx").on(table.ownerId, table.position)],
);

export type KhImportResult = { inserted: number; categories: number; tags: number; methods: number };

export const khImport = pgTable(
	"kh_import",
	{
		key: uuid().primaryKey(),
		ownerId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		/** A hash of the rows: the same key with other rows is a conflict. */
		fingerprint: text().notNull(),
		/** Set when the import's transaction commits. */
		result: jsonb().$type<KhImportResult>(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("kh_import_owner_idx").on(table.ownerId)],
);

export type KhSavedSearchRow = typeof khSavedSearch.$inferSelect;
