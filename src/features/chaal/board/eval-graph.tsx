import type { KeyboardEvent, PointerEvent } from "react";
import { m } from "@/paraglide/messages";
import { formatScore, type Score, winChance } from "../chess/eval";

/**
 * The evaluation through a game (PLAN 13.5, `EvalGraph`; decision 0262): one ink line of
 * White's winning chance by move, the even line, and a vermilion mark at the move shown,
 * as in the comps. Our own SVG rather than Recharts: one line needs no chart library.
 * It's a slider: click or drag to a move, or ←/→ when focused.
 */
export function EvalGraph({
	scores,
	current,
	onSelect,
	className,
}: {
	/** One score per move of the main line (null where there's none yet). */
	scores: ReadonlyArray<Score | null>;
	/** The move shown, as an index into `scores` (−1 for the start). */
	current: number;
	onSelect?: (index: number) => void;
	className?: string;
}) {
	if (scores.length < 2) return null;
	const last = scores.length - 1;
	const x = (index: number) => (index / last) * 100;
	const y = (score: Score | null) => 100 - (score ? winChance(score) : 50);
	const points = scores.map((score, index) => `${x(index)},${y(score)}`).join(" ");
	const known = scores[current];
	const pick = (event: PointerEvent<HTMLDivElement>) => {
		const box = event.currentTarget.getBoundingClientRect();
		if (box.width === 0 || !onSelect) return;
		onSelect(Math.round(((event.clientX - box.left) / box.width) * last));
	};
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const step = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[event.key];
		if (step === undefined || !onSelect) return;
		event.preventDefault();
		onSelect(Math.max(-1, Math.min(last, current + step)));
	};
	return (
		<div
			role="slider"
			tabIndex={0}
			aria-label={m.ch_eval_graph_label()}
			aria-valuemin={0}
			aria-valuemax={scores.length}
			aria-valuenow={current + 1}
			aria-valuetext={known ? `${current + 1}: ${formatScore(known)}` : String(current + 1)}
			onPointerDown={pick}
			onKeyDown={onKeyDown}
			className={`ch-hairline h-16 w-full cursor-pointer border-t border-t-ch-hair outline-none focus-visible:ring-2 focus-visible:ring-ch-ink ${className ?? ""}`}
			data-testid="chaal-eval-graph"
		>
			<svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="size-full">
				<line
					x1={0}
					y1={50}
					x2={100}
					y2={50}
					stroke="var(--ch-hair)"
					strokeWidth={1}
					vectorEffect="non-scaling-stroke"
				/>
				<polyline
					points={points}
					fill="none"
					stroke="var(--ch-ink)"
					strokeWidth={1.5}
					vectorEffect="non-scaling-stroke"
				/>
				{current >= 0 ? (
					<line
						x1={x(current)}
						y1={0}
						x2={x(current)}
						y2={100}
						stroke="var(--ch-mark)"
						strokeWidth={1.5}
						vectorEffect="non-scaling-stroke"
					/>
				) : null}
			</svg>
		</div>
	);
}
