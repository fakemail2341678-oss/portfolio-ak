import { m } from "@/paraglide/messages";
import { formatTimeControl } from "../chess/clock";
import type { ChaalEventChallenge, ChaalEventPlayer } from "../live/events";

/**
 * Online play's words that the frame shares with the hub (Task 78: the bell and the toasts),
 * kept apart from the hub's components so the frame loads only these.
 */

/** "10+5 · Rated", "3 d · Casual". */
export function challengePace(challenge: ChaalEventChallenge): string {
	const { timeControl } = challenge;
	const pace =
		timeControl.type === "clock" && timeControl.limit !== null
			? formatTimeControl({ initial: timeControl.limit, increment: timeControl.increment ?? 0 })
			: timeControl.daysPerTurn
				? m.ch_online_days_short({ days: String(timeControl.daysPerTurn) })
				: m.ch_online_unlimited();
	return `${pace} · ${challenge.rated ? m.ch_online_rated() : m.ch_online_casual()}`;
}

/** A player as lists name them: the Lichess AI by its level. */
export const eventPlayerName = (player: ChaalEventPlayer | null) =>
	!player ? "?" : player.aiLevel !== null ? m.ch_live_ai_name({ level: String(player.aiLevel) }) : player.name;
