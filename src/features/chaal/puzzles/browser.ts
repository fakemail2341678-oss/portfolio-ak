import { z } from "zod";
import { notifyLocal, subscribeLocal } from "../settings/local";
import { PUZZLE_IMPORT_MAX, type PuzzleAttempt, puzzleAttemptSchema } from "./schema";

/**
 * Puzzle attempts in this browser, without a session (PLAN Task 80, "a local dashboard";
 * decision 0269): one list under `chaal:puzzles`, so "Delete this device's data" finds it
 * with the rest. Read through the server's schema, so a hand-edited entry is skipped, not a
 * crash; every access is wrapped (storage can be full, off or refused). A session imports
 * them (`useImportPuzzleAttempts`) and they're forgotten here.
 */
const KEY = "chaal:puzzles";

export { subscribeLocal as subscribeBrowserAttempts };

const list = z.array(z.unknown());

let snapshot: { raw: string | null; attempts: PuzzleAttempt[] } = { raw: null, attempts: [] };

/** This browser's attempts, the oldest first (the same array until storage changes). */
export function readBrowserAttempts(): PuzzleAttempt[] {
	let raw: string | null = null;
	try {
		raw = window.localStorage.getItem(KEY);
	} catch {
		raw = null;
	}
	if (raw === snapshot.raw) return snapshot.attempts;
	let attempts: PuzzleAttempt[] = [];
	try {
		const read = list.safeParse(raw ? JSON.parse(raw) : []);
		attempts = read.success
			? read.data.flatMap((item) => {
					const attempt = puzzleAttemptSchema.safeParse(item);
					return attempt.success ? [attempt.data] : [];
				})
			: [];
	} catch {
		attempts = [];
	}
	snapshot = { raw, attempts };
	return attempts;
}

function write(attempts: ReadonlyArray<PuzzleAttempt>): boolean {
	try {
		if (attempts.length === 0) window.localStorage.removeItem(KEY);
		else window.localStorage.setItem(KEY, JSON.stringify(attempts));
		return true;
	} catch {
		return false;
	} finally {
		notifyLocal();
	}
}

/** Keeps an attempt (the PUZZLE_IMPORT_MAX most recent stay). False when storage refused it. */
export function writeBrowserAttempt(attempt: PuzzleAttempt): boolean {
	const kept = readBrowserAttempts().filter((entry) => entry.id !== attempt.id);
	return write([...kept, attempt].slice(-PUZZLE_IMPORT_MAX));
}

export function forgetBrowserAttempts(ids: ReadonlyArray<string>): void {
	const gone = new Set(ids);
	write(readBrowserAttempts().filter((attempt) => !gone.has(attempt.id)));
}
