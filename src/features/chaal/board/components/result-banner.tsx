import { m } from "@/paraglide/messages";
import type { GameEndReason, GameResult } from "../../chess/lib/rules";

const REASONS: Record<GameEndReason, () => string> = {
	checkmate: () => m.chaal_reason_checkmate(),
	stalemate: () => m.chaal_reason_stalemate(),
	insufficient: () => m.chaal_reason_insufficient(),
	fivefold: () => m.chaal_reason_fivefold(),
	"seventy-five": () => m.chaal_reason_seventy_five(),
	resign: () => m.chaal_reason_resign(),
	timeout: () => m.chaal_reason_timeout(),
	"timeout-draw": () => m.chaal_reason_timeout_draw(),
	agreement: () => m.chaal_reason_agreement(),
	threefold: () => m.chaal_reason_threefold(),
	fifty: () => m.chaal_reason_fifty(),
	left: () => m.chaal_reason_left(),
	cheat: () => m.chaal_reason_cheat(),
	"no-start": () => m.chaal_reason_no_start(),
};

const SCORES: Record<GameResult, string> = { "1-0": "1–0", "0-1": "0–1", "1/2-1/2": "½–½" };

/**
 * How a game ended (PLAN 13.5, `ResultBanner`): the score as a scoresheet writes it, who
 * won, and why. A status, so it's read out when it appears. Resignation, time, agreement
 * and claims arrived with the local games (Task 76); online play added Lichess's own (Task 77).
 */
export function ResultBanner({
	result,
	reason,
	className,
}: {
	result: GameResult;
	reason?: GameEndReason;
	className?: string;
}) {
	const outcome =
		result === "1-0" ? m.chaal_result_white() : result === "0-1" ? m.chaal_result_black() : m.chaal_result_draw();
	return (
		<output className={`ch-rule flex items-baseline gap-3 py-3 ${className ?? ""}`} data-testid="chaal-result">
			<span className="ch-display ch-figures text-ch-head" aria-hidden>
				{SCORES[result]}
			</span>
			<p className="font-semibold">
				{outcome}
				{reason ? <span className="font-normal text-ch-muted"> · {REASONS[reason]()}</span> : null}
			</p>
		</output>
	);
}
