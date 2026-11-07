import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import { type ChaalPreferences, readPreferences } from "@/features/chaal/settings/preferences";
import { chPreference } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/**
 * A player's preferences (PLAN 13.5, `ch_preference`; decision 0259). Each call acts on
 * the caller's own row only (tests/server/chaal-access.test.ts). Values arrive checked by
 * the functions' schema.
 */

/** The saved preferences, or null when the player hasn't changed any (the page uses this browser's, or the defaults). */
export async function preferencesOf(db: Db, userId: string): Promise<ChaalPreferences | null> {
	const [row] = await db.select().from(chPreference).where(eq(chPreference.userId, userId));
	return row ? readPreferences(row) : null;
}

/** Saves every preference (the settings page sends the whole set: one row, last write wins). */
export async function savePreferences(
	db: Db,
	userId: string,
	preferences: ChaalPreferences,
): Promise<ChaalPreferences> {
	await db
		.insert(chPreference)
		.values({ userId, ...preferences })
		.onConflictDoUpdate({ target: chPreference.userId, set: preferences });
	return preferences;
}

/**
 * Brings this browser's preferences into a session that has none yet (once, when a session
 * appears): a row already there wins, so another device's choices aren't overwritten.
 * Returns what the session has afterwards.
 */
export async function importPreferences(
	db: Db,
	userId: string,
	preferences: ChaalPreferences,
): Promise<ChaalPreferences> {
	await db
		.insert(chPreference)
		.values({ userId, ...preferences })
		.onConflictDoNothing({ target: chPreference.userId });
	return (await preferencesOf(db, userId)) ?? preferences;
}
