import type { QueryClient } from "@tanstack/react-query";
import { ensureQuery } from "@/lib/query";
import { liveGameQueryOptions } from "../play/queries";
import { replayQueryOptions } from "../players/queries";

/** Lichess's statuses for a game that hasn't ended (as `isOver` in ./live-game.ts, without chess.js). */
export const inProgress = (status: string) => status === "created" || status === "started";

/**
 * /app/chaal/game/$id's loader (Tasks 77 and 81, decision 0271): for a session it first
 * reads the game as the player's own (the Board API's first line, with their token); a
 * game they play that's still going on is the live page. Anything else (a visitor, a
 * player not connected for play, someone else's game, a finished one) is the replay, from
 * Lichess's public export. A failed read is the page's to say.
 */
export async function loadGamePage(queryClient: QueryClient, signedIn: boolean, id: string) {
	if (signedIn) {
		const live = await ensureQuery(queryClient, liveGameQueryOptions(id)).catch(() => null);
		if (live && inProgress(live.game.state.status)) return;
	}
	await ensureQuery(queryClient, replayQueryOptions(id)).catch(() => undefined);
}
