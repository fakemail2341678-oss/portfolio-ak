import { sql } from "drizzle-orm";
import { boolean, customType, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth";

/**
 * Notes (/apps/notes, decision 0190). Every row has `owner_id` (the user, a guest
 * included), deleted with them; the repository scopes every query by it (`ownedBy`).
 * A note's images are attachments (`entity_type` "note").
 */

/** Postgres' full-text document type; only ever written by the generated column below. */
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const note = pgTable(
	"note",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text().notNull(),
		/** Sanitized rich text (src/server/rich-text/sanitize.ts). */
		body: text().notNull().default(""),
		/** The body's visible text: what search reads and the list's excerpt comes from. */
		bodyText: text().notNull().default(""),
		tags: text().array().notNull().default(sql`'{}'::text[]`),
		pinned: boolean().notNull().default(false),
		archived: boolean().notNull().default(false),
		/**
		 * A random token for the read-only public page (/apps/notes/s/<token>); null when
		 * not shared. Revoking clears it, so the old link stops working for good.
		 */
		shareToken: text().unique("note_share_token_unique"),
		/**
		 * Title (weight A) and body text (B) with the `simple` configuration: no stemming,
		 * so Nepali and English words both match as written (Postgres has no Nepali stemmer).
		 */
		search: tsvector().generatedAlwaysAs(
			sql`setweight(to_tsvector('simple', title), 'A') || setweight(to_tsvector('simple', body_text), 'B')`,
		),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("note_owner_idx").on(table.ownerId, table.updatedAt),
		index("note_search_idx").using("gin", table.search),
	],
);

export type NoteRow = typeof note.$inferSelect;
