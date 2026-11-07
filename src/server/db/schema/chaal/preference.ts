import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { ChaalPreferences } from "@/features/chaal/settings/preferences";
import { user } from "../auth";

/**
 * A player's preferences (PLAN 13.5; decision 0259): one row per user, guests included,
 * written on the first change. No row means the defaults. Values are checked by
 * `chaalPreferencesSchema` on the way in and read field by field on the way out
 * (`readPreferences`), so a board theme removed later falls back to the default. A guest's
 * row moves to the account it signs up or in as, unless the account has its own
 * (src/server/chaal/guest-data.ts).
 */
export const chPreference = pgTable("ch_preference", {
	userId: text()
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	board: text().$type<ChaalPreferences["board"]>().notNull(),
	pieces: text().$type<ChaalPreferences["pieces"]>().notNull(),
	sounds: boolean().notNull(),
	volume: integer().notNull(),
	autoQueen: boolean().notNull(),
	premove: boolean().notNull(),
	confirmMoves: boolean().notNull(),
	coordinates: boolean().notNull(),
	notation: text().$type<ChaalPreferences["notation"]>().notNull(),
	zen: boolean().notNull(),
	updatedAt: timestamp({ withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});
