import "@tanstack/react-start/server-only";
import { DEFAULT_ENGINE_LIMITS } from "@/features/chaal/engine/limits";
import { DEFAULT_PLAY_LIMITS } from "@/features/chaal/play/controls";
import { chBlock, chSettings } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/**
 * The rows every Chaal call depends on, read from Postgres at most every 5 s per process
 * (PLAN 13.5): the settings (switches, connecting rules, the cache epoch, the public lane's
 * cooldown) and the blocks. An admin's change reaches every server within 5 s.
 */
const TTL_MS = 5_000;

export type ChaalSettingsRow = typeof chSettings.$inferSelect;

export const DEFAULT_CHAAL_SETTINGS: ChaalSettingsRow = {
	id: 1,
	features: {},
	guestsMayConnect: true,
	extraScopes: [],
	cacheEpoch: 0,
	publicCooldownUntil: null,
	publicCooldownMs: 0,
	banner: null,
	engine: DEFAULT_ENGINE_LIMITS,
	play: DEFAULT_PLAY_LIMITS,
	version: 1,
	updatedAt: new Date(0),
};

const cached = <T>(load: () => Promise<T>, now: () => number) => {
	let entry: { value: Promise<T>; until: number } | undefined;
	const read = () => {
		if (!entry || now() >= entry.until) {
			const value = load();
			const current = { value, until: now() + TTL_MS };
			entry = current;
			// A failed read isn't kept: the next caller tries again.
			value.catch(() => {
				if (entry === current) entry = undefined;
			});
		}
		return entry.value;
	};
	return Object.assign(read, {
		clear: () => {
			entry = undefined;
		},
	});
};

export type ChaalBlocks = { users: ReadonlySet<string>; lichess: ReadonlySet<string> };

export function createChaalControls(db: Db, now: () => number = Date.now) {
	const settings = cached(async (): Promise<ChaalSettingsRow> => {
		const [row] = await db.select().from(chSettings).limit(1);
		return row ?? DEFAULT_CHAAL_SETTINGS;
	}, now);
	const blocks = cached(async (): Promise<ChaalBlocks> => {
		const rows = await db.select({ userId: chBlock.userId, lichessId: chBlock.lichessId }).from(chBlock);
		return {
			users: new Set(rows.flatMap((row) => (row.userId ? [row.userId] : []))),
			lichess: new Set(rows.flatMap((row) => (row.lichessId ? [row.lichessId] : []))),
		};
	}, now);
	return {
		settings,
		blocks,
		/** After a write on this process: read the rows again at once (other servers within 5 s). */
		invalidate: () => {
			settings.clear();
			blocks.clear();
		},
	};
}

export type ChaalControls = ReturnType<typeof createChaalControls>;
