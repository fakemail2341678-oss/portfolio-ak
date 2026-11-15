import { m } from "@/paraglide/messages";
import { formatTimeControl, type TimeControl } from "../chess/lib/clock";
import type { Color } from "../chess/lib/rules";
import { sideName } from "../chess/lib/speech";
import type { LocalGameRecord } from "./types";

/** Local games in words (Task 76), at render time. */

type Described = Pick<LocalGameRecord, "mode" | "level" | "color" | "clock">;

/** "Stockfish, level 3" or "Over the board". */
export const opponentOf = (game: Described): string =>
	game.mode === "engine" ? m.chaal_local_computer({ level: String(game.level ?? 1) }) : m.chaal_local_over_board();

/** The name on a side's strip: "You" and the computer, or White and Black over the board. */
export function playerName(game: Described, side: Color): string {
	if (game.mode === "board") return sideName(side);
	return side === game.color ? m.chaal_local_you() : m.chaal_local_computer({ level: String(game.level ?? 1) });
}

/** "10+0", or "No clock". */
export const clockLabel = (clock: TimeControl | null): string =>
	clock ? formatTimeControl(clock) : m.chaal_local_no_clock();

/** The PGN's names, in the reader's language. */
export const pgnNames = (game: Described) => ({
	white: playerName(game, "white"),
	black: playerName(game, "black"),
	event: game.mode === "engine" ? m.chaal_local_vs_computer() : m.chaal_local_over_board(),
});
