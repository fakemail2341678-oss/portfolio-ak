import { errorMessage } from "@/components/errors/error-page";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { showSan } from "../chess/notation";
import type { ChaalTablebase, TablebaseResult } from "../schema";

const RESULT_NAMES: Readonly<Record<TablebaseResult, () => string>> = {
	win: m.ch_tablebase_win,
	"maybe-win": m.ch_tablebase_maybe_win,
	"cursed-win": m.ch_tablebase_cursed_win,
	draw: m.ch_tablebase_draw,
	"blessed-loss": m.ch_tablebase_blessed_loss,
	"maybe-loss": m.ch_tablebase_maybe_loss,
	loss: m.ch_tablebase_loss,
	unknown: m.ch_tablebase_unknown,
};

/** Ink for a win, grey for a draw, plain for a loss: the outcome reads without colour. */
const TONE: Readonly<Record<TablebaseResult, string>> = {
	win: "font-semibold",
	"maybe-win": "font-semibold",
	"cursed-win": "",
	draw: "text-ch-muted",
	"blessed-loss": "text-ch-muted",
	"maybe-loss": "text-ch-muted",
	loss: "text-ch-muted",
	unknown: "text-ch-muted",
};

/**
 * The distance players read in tablebases: DTM (half-moves to mate) when known, else DTZ
 * (half-moves to the next capture or pawn move). The abbreviations are the field's own, the
 * same in both languages; their meaning is the title.
 */
function distance(tablebase: { dtm: number | null; dtz: number | null }) {
	const [label, title, plies] =
		tablebase.dtm !== null && tablebase.dtm !== 0
			? ["DTM", m.ch_tablebase_dtm_title(), tablebase.dtm]
			: tablebase.dtz !== null && tablebase.dtz !== 0
				? ["DTZ", m.ch_tablebase_dtz_title(), tablebase.dtz]
				: [null, null, 0];
	if (!label) return null;
	return (
		<>
			<abbr title={title ?? undefined} className="no-underline">
				{label}
			</abbr>{" "}
			{formatNumber(Math.abs(plies))}
		</>
	);
}

/**
 * The endgame tablebase (PLAN Task 75): with seven pieces or fewer, Lichess knows the
 * result with perfect play. The position's, then each move's for the side that plays it,
 * best first, with the distance to mate (or to the next capture or pawn move).
 */
export function TablebasePanel({
	result,
	pending,
	error,
	tooMany,
	notation,
	locked,
	onPlay,
}: {
	result: ChaalTablebase | null | undefined;
	pending: boolean;
	error: unknown;
	/** More than seven pieces: the tablebase doesn't know. */
	tooMany: boolean;
	notation: "figurine" | "letters";
	locked: boolean;
	onPlay: (uci: string) => void;
}) {
	if (locked) return <p className="py-3 text-ch-muted text-sm">{m.ch_explorer_locked()}</p>;
	if (tooMany) return <p className="py-3 text-ch-muted text-sm">{m.ch_tablebase_too_many()}</p>;
	if (pending) {
		return (
			<div className="flex flex-col gap-2 py-2" aria-busy="true">
				{[0, 1, 2, 3].map((row) => (
					<Skeleton key={row} className="h-6 w-full rounded-none" />
				))}
			</div>
		);
	}
	if (error) {
		return (
			<p className="py-3 text-sm" role="alert">
				{errorMessage(error)}
			</p>
		);
	}
	if (!result) return <p className="py-3 text-ch-muted text-sm">{m.ch_tablebase_none()}</p>;
	const ended = result.checkmate
		? m.ch_tablebase_checkmate()
		: result.stalemate
			? m.ch_tablebase_stalemate()
			: result.insufficientMaterial
				? m.ch_tablebase_insufficient()
				: null;
	return (
		<div className="flex flex-col gap-2 py-2" data-testid="chaal-tablebase">
			<p className="flex items-baseline gap-2">
				<span className={`ch-display text-lg ${TONE[result.result]}`}>{ended ?? RESULT_NAMES[result.result]()}</span>
				{ended ? null : <span className="text-ch-muted text-sm">{distance(result)}</span>}
			</p>
			{result.moves.length > 0 ? (
				<ul aria-label={m.ch_tablebase_moves()} className="flex flex-col">
					{result.moves.map((move) => (
						<li key={move.uci} className="ch-hairline">
							<button
								type="button"
								onClick={() => onPlay(move.uci)}
								className="flex w-full items-baseline gap-3 py-1.5 text-start text-sm outline-none hover:bg-ch-hair focus-visible:ring-2 focus-visible:ring-ch-ink"
							>
								<span className="w-14 shrink-0 font-medium">{showSan(move.san, notation)}</span>
								<span className={`flex-1 ${TONE[move.result]}`}>{RESULT_NAMES[move.result]()}</span>
								<span className="text-ch-muted tabular-nums">{distance(move)}</span>
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
