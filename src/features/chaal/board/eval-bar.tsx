import { m } from "@/paraglide/messages";
import { formatScore, type Score, winChance } from "../chess/eval";
import type { Orientation } from "./geometry";

/**
 * The evaluation bar (PLAN 13.5, `EvalBar`; the comps): paper for White and ink for Black,
 * in the board's own colours (the board stays paper in both themes). Upright beside the
 * board on a laptop, a thin band above it on a phone. The ink part grows with a transform,
 * so it moves on the one ease. A meter to assistive technology: the score is its text.
 */
export function EvalBar({
	score,
	orientation = "white",
	direction = "vertical",
	className,
}: {
	score: Score | null;
	orientation?: Orientation;
	direction?: "vertical" | "horizontal";
	className?: string;
}) {
	const white = score ? winChance(score) : 50;
	const black = (100 - white) / 100;
	// The ink part starts at the edge farther from White's side as the board is drawn.
	const fromStart = orientation === "white";
	const vertical = direction === "vertical";
	const origin = vertical ? (fromStart ? "top" : "bottom") : fromStart ? "left" : "right";
	const text = score ? formatScore(score) : undefined;
	return (
		// biome-ignore lint/a11y/useSemanticElements: <meter> can't draw the bar's paper and ink halves; the role carries the same meaning.
		<div
			role="meter"
			aria-label={m.ch_eval_label()}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(white)}
			aria-valuetext={text}
			className={`relative overflow-hidden border-[1.5px] border-ch-frame bg-ch-paper ${vertical ? "h-full w-5" : "h-3.5 w-full"} ${className ?? ""}`}
			data-testid="chaal-eval-bar"
		>
			<div
				className="ch-move absolute inset-0 bg-ch-frame"
				style={{
					transform: vertical ? `scaleY(${black})` : `scaleX(${black})`,
					transformOrigin: origin,
				}}
			/>
			{vertical && text ? (
				<span
					aria-hidden
					// In the leading side's part of the bar: White's is at the bottom when the board is drawn from White.
					className={`ch-display absolute inset-x-0 text-center text-[0.6875rem] ${white >= 50 ? "text-ch-frame" : "text-ch-paper"} ${white >= 50 === fromStart ? "bottom-1.5" : "top-1.5"}`}
				>
					{text.replace(/^\+/, "")}
				</span>
			) : null}
		</div>
	);
}
