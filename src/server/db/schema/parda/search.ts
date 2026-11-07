import { boolean, date, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * What viewers search for (PLAN 12.5, "Data model"; decision 0239): one row per UTC day
 * and normalized query, counted by the search page only (never the overlay's
 * suggestions), with no user, IP or profile. Task 69's overview reads it for the top and
 * zero-result searches.
 */
export const pdSearchStat = pgTable(
	"pd_search_stat",
	{
		day: date({ mode: "string" }).notNull(),
		/** Lower case, NFKC, single spaces, at most 100 characters (`normalizeQuery`). */
		query: text().notNull(),
		count: integer().notNull().default(1),
		/** The latest search's outcome: true when it found nothing. */
		zeroResults: boolean().notNull().default(false),
		updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [primaryKey({ name: "pd_search_stat_pk", columns: [table.day, table.query] })],
);
