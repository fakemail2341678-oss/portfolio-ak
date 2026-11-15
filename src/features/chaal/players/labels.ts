import { m } from "@/paraglide/messages";
import { formatTimeControl } from "../chess/lib/clock";
import type { ChaalGameSummary, PlayerPerf } from "./schema";

/** Each rating's name (Task 81): the speeds' words from the glossary. */
export const PERF_NAMES: Readonly<Record<PlayerPerf, () => string>> = {
	ultraBullet: m.chaal_speed_ultra_bullet,
	bullet: m.chaal_speed_bullet,
	blitz: m.chaal_speed_blitz,
	rapid: m.chaal_speed_rapid,
	classical: m.chaal_speed_classical,
	correspondence: m.chaal_speed_correspondence,
};

/** A perf Lichess names that Chaal may not know (a variant's): its own name, else Lichess's word. */
export const perfName = (perf: string): string => (perf in PERF_NAMES ? PERF_NAMES[perf as PlayerPerf]() : perf);

/** "10+5" or "3 days a move", or nothing without either. */
export function paceText(game: Pick<ChaalGameSummary, "clock" | "daysPerTurn">): string | null {
	if (game.clock) return formatTimeControl({ initial: game.clock.initial, increment: game.clock.increment });
	if (game.daysPerTurn) return m.chaal_online_days({ days: String(game.daysPerTurn) });
	return null;
}

/** "Rated · Blitz · 3+2". */
export const gameKind = (game: Pick<ChaalGameSummary, "rated" | "perf" | "clock" | "daysPerTurn">): string =>
	[game.rated ? m.chaal_online_rated() : m.chaal_online_casual(), perfName(game.perf), paceText(game)]
		.filter(Boolean)
		.join(" · ");

/** The score as a scoresheet writes it. */
export function scoreOf(game: Pick<ChaalGameSummary, "winner" | "ongoing" | "status">): string {
	if (game.ongoing) return "*";
	if (game.status === "aborted" || game.status === "noStart") return "–";
	return game.winner === "white" ? "1–0" : game.winner === "black" ? "0–1" : "½–½";
}
