import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { formatScore, type Score } from "../chess/eval";
import { showSan } from "../chess/notation";
import { ENGINE_NAME } from "../engine/files";
import type { EngineStatus } from "../engine/use-engine";
import { lineMoves } from "./lines";

export type ShownLine = { score: Score; moves: string[] };

/**
 * The engine's block (PLAN Task 75; the comps): a switch for Stockfish, where the lines come
 * from (Lichess's cloud, or this device at a depth), the best score large, and the lines
 * below it, best first, in figurine notation. A move in a line plays the line up to it.
 * While it downloads, a bar; when fair play holds it, a reason instead of lines.
 */
export function EnginePanel({
	fen,
	status,
	progress,
	lines,
	depth,
	source,
	locked,
	notation,
	compact = false,
	onToggle,
	onPlayLine,
}: {
	fen: string;
	status: EngineStatus;
	progress: number;
	lines: ReadonlyArray<ShownLine>;
	depth: number;
	/** Where the lines shown come from. */
	source: "cloud" | "local" | null;
	locked: boolean;
	notation: "figurine" | "letters";
	/** A phone shows the best line only. */
	compact?: boolean;
	onToggle: (on: boolean) => void;
	onPlayLine: (moves: string[]) => void;
}) {
	const on = status !== "off" && !locked;
	const best = lines[0];
	const shown = compact ? lines.slice(0, 1) : lines;
	const where =
		source === "cloud"
			? m.ch_engine_cloud({ depth: formatNumber(depth) })
			: source === "local"
				? m.ch_engine_local({ depth: formatNumber(depth) })
				: null;
	return (
		// Not a landmark: the switch and "Stockfish 19" say what it is.
		<section className="ch-rule flex flex-col gap-1.5 pt-2" data-testid="chaal-engine">
			<div className="flex min-h-9 items-center gap-3">
				<Switch
					checked={on}
					disabled={locked}
					onCheckedChange={onToggle}
					aria-label={m.ch_engine_switch()}
					data-testid="chaal-engine-switch"
				/>
				<span className="font-semibold">{ENGINE_NAME}</span>
				<span className="truncate text-ch-muted text-xs" data-testid="chaal-engine-where">
					{on ? where : null}
				</span>
				<span className="ch-display ms-auto text-2xl tabular-nums" data-testid="chaal-engine-score">
					{on && best ? formatScore(best.score) : null}
				</span>
			</div>
			{locked ? (
				<p className="text-ch-muted text-sm">{m.ch_engine_locked()}</p>
			) : status === "loading" ? (
				<div className="flex flex-col gap-1.5 py-1">
					<Progress value={Math.round(progress * 100)} aria-label={m.ch_engine_loading()} className="h-1.5" />
					<p className="text-ch-muted text-xs">
						{m.ch_engine_loading_size({ percent: formatNumber(Math.round(progress * 100)) })}
					</p>
				</div>
			) : status === "failed" ? (
				<p className="text-sm" role="alert">
					{m.ch_engine_failed()}
				</p>
			) : status === "off" ? (
				<p className="text-ch-muted text-sm">{m.ch_engine_off()}</p>
			) : (
				<ol
					aria-label={m.ch_engine_lines()}
					// A phone shows the best line only, on one line (the comps).
					className="flex min-h-7 flex-col max-sm:[&>li:nth-child(n+2)]:hidden"
					data-testid="chaal-engine-lines"
				>
					{shown.map((line, index) => (
						<Line
							// biome-ignore lint/suspicious/noArrayIndexKey: a line's place is its identity (multi-PV 1, 2, 3).
							key={index}
							fen={fen}
							line={line}
							notation={notation}
							onPlayLine={onPlayLine}
							compact={compact}
						/>
					))}
				</ol>
			)}
		</section>
	);
}

function Line({
	fen,
	line,
	notation,
	compact,
	onPlayLine,
}: {
	fen: string;
	line: ShownLine;
	notation: "figurine" | "letters";
	compact: boolean;
	onPlayLine: (moves: string[]) => void;
}) {
	const moves = lineMoves(fen, line.moves, compact ? 8 : 12);
	return (
		<li
			// The score in its own column; the moves beside it (one line on a phone, wrapping under themselves elsewhere).
			className={`grid grid-cols-[3rem_minmax(0,1fr)] items-baseline gap-2 py-1 text-sm ${compact ? "overflow-hidden whitespace-nowrap" : "ch-hairline max-sm:overflow-hidden max-sm:whitespace-nowrap max-sm:border-0"}`}
		>
			<span className="font-semibold tabular-nums">{formatScore(line.score)}</span>
			<span
				className={`flex min-w-0 ${compact ? "overflow-hidden" : "flex-wrap max-sm:flex-nowrap max-sm:overflow-hidden"}`}
			>
				{moves.map((move, index) => (
					<button
						key={move.uci + String(index)}
						type="button"
						onClick={() => onPlayLine(line.moves.slice(0, index + 1))}
						className="whitespace-nowrap px-0.5 outline-none hover:bg-ch-hair focus-visible:ring-2 focus-visible:ring-ch-ink"
					>
						{move.number ? <span className="text-ch-muted">{move.number}</span> : null}
						{showSan(move.san, notation)}
					</button>
				))}
			</span>
		</li>
	);
}
