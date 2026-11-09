import "@tanstack/react-start/server-only";
import { scopesFor } from "@/features/chaal/features";
import type { ChaalLabState, ChaalLaneCheck } from "@/features/chaal/schema";
import { serverEnv } from "@/server/env";
import { redirectUriFor } from "../connect/oauth";
import { untilUtcMidnight } from "../lichess/cache";
import { puzzleAnswer } from "../lichess/schemas";
import { chaalCache, chaalConnectDeps, chaalControls, chaalLichess } from "../store";
import { STREAM_WINDOW_MS } from "../stream";

/**
 * /admin/chaal/lab (Task 71, `chaal:configure`): how Chaal is set up on this server, what
 * connecting asks for, the stream's window and this instance's Lichess calls. Never a
 * token or a key: only whether one is set, and the key id new tokens are sealed with.
 */
export async function labState(): Promise<ChaalLabState> {
	const [deps, settings] = await Promise.all([chaalConnectDeps(), chaalControls.settings()]);
	return {
		setup: {
			tokenKey: deps.vault !== null,
			keyId: deps.vault?.keyId ?? null,
			appToken: Boolean(serverEnv.LICHESS_APP_TOKEN),
			clientId: serverEnv.LICHESS_CLIENT_ID,
			apiBase: serverEnv.LICHESS_API_BASE,
			redirectUri: redirectUriFor(serverEnv.BETTER_AUTH_URL),
		},
		scopes: scopesFor(settings.features, settings.extraScopes),
		streamWindowSeconds: STREAM_WINDOW_MS / 1000,
		publicCooldownUntil: settings.publicCooldownUntil?.toISOString() ?? null,
		counters: Object.entries(chaalLichess.counters.snapshot())
			.map(([endpoint, counts]) => ({
				endpoint,
				calls: counts.calls,
				errors: counts.errors,
				rateLimited: counts.rateLimited,
				avgMs: counts.calls > 0 ? Math.round(counts.totalMs / counts.calls) : 0,
				lastStatus: counts.lastStatus,
			}))
			.sort((a, b) => a.endpoint.localeCompare(b.endpoint)),
	};
}

/**
 * Reads the daily puzzle through the public lane and the cache: proves the client, the lane and
 * the cache work here. The answer is the puzzles page's (`puzzleAnswer`), as they share the key (Task 80).
 */
export async function checkPublicLane(now: () => number = Date.now): Promise<ChaalLaneCheck> {
	const settings = await chaalControls.settings();
	const started = now();
	const puzzle = await chaalCache.read(
		{ endpoint: "puzzle-daily", path: "/api/puzzle/daily", epoch: settings.cacheEpoch },
		untilUtcMidnight(started),
		() => chaalLichess.json({ endpoint: "puzzle-daily", path: "/api/puzzle/daily", lane: "public" }, puzzleAnswer),
	);
	return { puzzleId: puzzle.id, rating: puzzle.rating, ms: now() - started };
}
