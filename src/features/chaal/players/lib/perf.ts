import type { ChaalPlayer, PlayerPerf } from "../schema";

/** The rating the overview opens on: the one with the most games (blitz for a new player). */
export function mainPerf(player: ChaalPlayer): PlayerPerf {
	let best: { perf: PlayerPerf; games: number } | null = null;
	for (const rating of player.ratings) if (!best || rating.games > best.games) best = rating;
	return best?.perf ?? "blitz";
}
