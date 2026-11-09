import { index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Which kind of lane a call ran in: the shared public one, a user's, or a user's play lane. Never the user. */
export type ChaalLaneKind = "public" | "user" | "play";

/**
 * Chaal's Lichess calls by hour and endpoint class (PLAN 13.5, Task 79; decision 0268): each
 * instance counts its calls in memory and adds them here after the call (`waitUntil`), so
 * /admin/chaal/health sees every server's. Pruned after 30 days by the daily job.
 */
export const chApiStat = pgTable(
	"ch_api_stat",
	{
		/** The hour the calls started in (UTC, truncated). */
		hour: timestamp({ withTimezone: true }).notNull(),
		/** The endpoint class ("account", "puzzle-daily", "stream:event"). */
		endpoint: text().notNull(),
		calls: integer().notNull().default(0),
		/** Answers of 400 and over, and requests that got no answer (a timeout, a refused connection). */
		errors: integer().notNull().default(0),
		rateLimited: integer().notNull().default(0),
		totalMs: integer().notNull().default(0),
	},
	(table) => [primaryKey({ columns: [table.hour, table.endpoint] })],
);

/**
 * The last 500 failed Lichess calls (Task 79): the endpoint class, the status (0 when no
 * answer came), the time it took and the lane's kind. Never a token, a user or a URL.
 */
export const chApiError = pgTable(
	"ch_api_error",
	{
		id: uuid().primaryKey().defaultRandom(),
		at: timestamp({ withTimezone: true }).defaultNow().notNull(),
		endpoint: text().notNull(),
		status: integer().notNull(),
		ms: integer().notNull(),
		lane: text().$type<ChaalLaneKind>().notNull(),
	},
	(table) => [index("ch_api_error_at_idx").on(table.at)],
);
