import { m } from "@/paraglide/messages";
import type { BoardEnd, GameResult } from "../chess/rules";

const REASONS: Record<BoardEnd["reason"], () => string> = {
	checkmate: () => m.ch_reason_checkmate(),
	stalemate: () => m.ch_reason_stalemate(),
	insufficient: () => m.ch_reason_insufficient(),
	fivefold: () => m.ch_reason_fivefold(),
	"seventy-five": () => m.ch_reason_seventy_five(),
};

const SCORES: Record<GameResult, string> = { "1-0": "1–0", "0-1": "0–1", "1/2-1/2": "½–½" };

/**
 * How a game ended (PLAN 13.5, `ResultBanner`): the score as a scoresheet writes it, who
 * won, and why. A status, so it's read out when it appears. The play tasks add their own
 * reasons (resignation, time, agreement) to `REASONS` as they arrive.
 */
export function ResultBanner({
	result,
	reason,
	className,
}: {
	result: GameResult;
	reason?: BoardEnd["reason"];
	className?: string;
}) {
	const outcome = result === "1-0" ? m.ch_result_white() : result === "0-1" ? m.ch_result_black() : m.ch_result_draw();
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
