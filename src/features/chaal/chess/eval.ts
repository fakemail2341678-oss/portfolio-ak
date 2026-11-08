/**
 * An engine's evaluation (PLAN 13.5, `EvalBar`, `EvalGraph`): centipawns or a mate, always
 * from White's side, as the engine (Task 75), cloud eval and PGN's `[%eval]` give it.
 */
export type Score = { cp: number } | { mate: number };

/**
 * White's chance of winning, 0 to 100, from a score: Lichess's published curve
 * (2 / (1 + e^(−0.00368208·cp)) − 1, fitted to its games), so a bar and a graph read the
 * way players expect. A mate is all or nothing.
 */
export function winChance(score: Score): number {
	if ("mate" in score) return score.mate > 0 ? 100 : 0;
	const cp = Math.max(-1000, Math.min(1000, score.cp));
	return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** "+0.35", "−1.20", "0.00", "#3", "#−2" (a real minus sign, which lines up with the plus). */
export function formatScore(score: Score): string {
	if ("mate" in score) return score.mate < 0 ? `#−${-score.mate}` : `#${score.mate}`;
	const pawns = (Math.abs(score.cp) / 100).toFixed(2);
	if (score.cp === 0) return pawns;
	return score.cp > 0 ? `+${pawns}` : `−${pawns}`;
}
