import { notifyLocal, subscribeLocal } from "../settings/local";
import { localGameRecordSchema } from "./schema";
import { LOCAL_GAMES_MAX, type LocalGameRecord } from "./types";

/**
 * Local games in this browser, without a session (PLAN Task 76, decision 0265): one key per
 * game under `chaal:game:`, so "Delete this device's data" finds them with the rest. Read
 * through the same schema as the server's, so a hand-edited or stale entry is skipped, not
 * a crash. Every access is wrapped: storage can be full, off or refused. A session imports
 * them (`useImportLocalGames`) and they're forgotten here.
 */
const GAME_PREFIX = "chaal:game:";

export { subscribeLocal as subscribeBrowserGames };

const keyOf = (id: string) => `${GAME_PREFIX}${id}`;

function parse(raw: string | null): LocalGameRecord | null {
	if (raw === null) return null;
	try {
		const read = localGameRecordSchema.safeParse(JSON.parse(raw));
		return read.success ? (read.data as LocalGameRecord) : null;
	} catch {
		return null;
	}
}

function rawEntries(): Array<[string, string]> {
	try {
		const storage = window.localStorage;
		const entries: Array<[string, string]> = [];
		for (let index = 0; index < storage.length; index++) {
			const key = storage.key(index);
			if (!key?.startsWith(GAME_PREFIX)) continue;
			const value = storage.getItem(key);
			if (value !== null) entries.push([key, value]);
		}
		return entries.sort(([a], [b]) => a.localeCompare(b));
	} catch {
		return [];
	}
}

/** The last list read, so useSyncExternalStore gets the same array until storage changes. */
let snapshot: { signature: string; games: LocalGameRecord[] } = { signature: "", games: [] };

/** This browser's games, the most recently played first. */
export function readBrowserGames(): LocalGameRecord[] {
	const entries = rawEntries();
	const signature = entries.map(([key, value]) => `${key}\u0000${value}`).join("\u0001");
	if (signature !== snapshot.signature) {
		const games = entries
			.map(([, value]) => parse(value))
			.filter((game): game is LocalGameRecord => game !== null)
			.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
		snapshot = { signature, games };
	}
	return snapshot.games;
}

/** Half-moves in a stored game's PGN, counted without reading the moves (the history list). */
export function movesInPgn(pgn: string): number {
	const text = pgn
		.replace(/^\[.*\]$/gm, " ")
		.replace(/\{[^}]*\}/g, " ")
		.replace(/\d+\.+/g, " ")
		.replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, " ");
	return text.split(/\s+/).filter((token) => token !== "" && !token.startsWith("$")).length;
}

export function readBrowserGame(id: string): LocalGameRecord | null {
	return readBrowserGames().find((game) => game.id === id) ?? null;
}

/** Stores a game, then keeps the LOCAL_GAMES_MAX most recently played. False when storage refused it. */
export function writeBrowserGame(game: LocalGameRecord): boolean {
	let stored = true;
	try {
		window.localStorage.setItem(keyOf(game.id), JSON.stringify(game));
	} catch {
		stored = false;
	}
	const games = readBrowserGames();
	for (const old of games.slice(LOCAL_GAMES_MAX)) removeKey(old.id);
	notifyLocal();
	return stored;
}

export function deleteBrowserGames(ids: ReadonlyArray<string>): void {
	for (const id of ids) removeKey(id);
	notifyLocal();
}

function removeKey(id: string) {
	try {
		window.localStorage.removeItem(keyOf(id));
	} catch {
		// Nothing to remove.
	}
}
