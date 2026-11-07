import "@tanstack/react-start/server-only";
import { eq, sql } from "drizzle-orm";
import { chConnection, chSettings } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { ChaalControls } from "../controls";
import type { Cooldown, CooldownStore } from "./client";

/** How long a connection's cooldown read is trusted, as the settings' (PLAN 13.5). */
const TTL_MS = 5_000;

const toCooldown = (until: Date | null, ms: number): Cooldown | null =>
	until ? { until: until.getTime(), ms: Math.max(ms, 0) } : null;

const later = (a: Cooldown | null, b: Cooldown | null) => (!a ? b : !b ? a : a.until >= b.until ? a : b);

/**
 * Cooldowns every instance sees (PLAN 13.5, "One request at a time"): the public lane's in
 * `ch_settings`, a connection's in its `ch_connection` row. Reads are cached for 5 s;
 * a cooldown this instance starts applies here at once.
 */
export function createDbCooldowns(db: Db, controls: ChaalControls, now: () => number = Date.now): CooldownStore {
	const started = new Map<string, Cooldown>();
	const reads = new Map<string, { cooldown: Cooldown | null; at: number }>();

	const readConnection = async (userId: string) => {
		const known = reads.get(userId);
		if (known && now() - known.at < TTL_MS) return known.cooldown;
		const [row] = await db
			.select({ until: chConnection.cooldownUntil, ms: chConnection.cooldownMs })
			.from(chConnection)
			.where(eq(chConnection.userId, userId));
		const cooldown = row ? toCooldown(row.until, row.ms) : null;
		reads.set(userId, { cooldown, at: now() });
		return cooldown;
	};

	return {
		read: async (key) => {
			const stored =
				key === "public"
					? await controls.settings().then((row) => toCooldown(row.publicCooldownUntil, row.publicCooldownMs))
					: key.startsWith("conn:")
						? await readConnection(key.slice("conn:".length))
						: null;
			return later(stored, started.get(key) ?? null);
		},
		start: async (key, cooldown) => {
			started.set(key, cooldown);
			const until = new Date(cooldown.until);
			if (key === "public") {
				await db
					.insert(chSettings)
					.values({ id: 1, publicCooldownUntil: until, publicCooldownMs: cooldown.ms })
					.onConflictDoUpdate({
						target: chSettings.id,
						set: { publicCooldownUntil: until, publicCooldownMs: cooldown.ms, updatedAt: sql`now()` },
					});
			} else if (key.startsWith("conn:")) {
				await db
					.update(chConnection)
					.set({ cooldownUntil: until, cooldownMs: cooldown.ms })
					.where(eq(chConnection.userId, key.slice("conn:".length)));
			}
		},
	};
}
