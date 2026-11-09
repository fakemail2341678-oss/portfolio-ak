import { Link } from "@tanstack/react-router";
import { ChartSplineIcon, ExternalLinkIcon, EyeIcon, LightbulbIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { Board } from "../board/board";
import type { Shape } from "../board/shapes";
import { sideName } from "../chess/speech";
import { chaalLinks } from "../links";
import { useChaalPreferences } from "../settings/use-preferences";
import type { ChaalPuzzle } from "./schema";
import { themeName } from "./themes";
import type { Trainer } from "./trainer";
import { type TrainerResult, usePuzzleTrainer } from "./use-trainer";

/** Where the board sits on a puzzle page: the container's width, and from `lg` the height under the chrome. */
export const PUZZLE_BOARD = "w-full lg:max-w-[calc(100dvh-10.5rem)]";

/** The page's grid: the board, then the panel beside it from `lg` (under it on a phone, within a thumb's reach). */
export const PUZZLE_GRID =
	"mx-auto grid w-full max-w-7xl gap-x-8 gap-y-3 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:px-8 lg:pt-6";

const LICHESS = "https://lichess.org";

function statusOf(trainer: Trainer, won: boolean, streak: boolean): string {
	switch (trainer.phase) {
		case "intro":
			return m.ch_puzzle_status_intro();
		case "play":
			return trainer.step === 0
				? m.ch_puzzle_status_find({ side: sideName(trainer.puzzle.color) })
				: m.ch_puzzle_status_continue();
		case "reply":
			return m.ch_puzzle_status_right();
		case "wrong":
			return streak ? m.ch_puzzle_status_streak_over() : m.ch_puzzle_status_wrong();
		case "reveal":
			return m.ch_puzzle_status_reveal();
		case "solved":
			return won ? m.ch_puzzle_status_solved() : m.ch_puzzle_status_solved_helped();
		case "failed":
			return m.ch_puzzle_status_failed();
	}
}

/** The line from the position before the opponent's move, for the analysis board. */
const analysisOf = (trainer: Trainer) =>
	chaalLinks.analysis({
		fen: trainer.puzzle.before,
		moves: [trainer.puzzle.lastMove.uci, ...trainer.moves.map((move) => move.uci)].join("_"),
	});

/** What a finished puzzle was: its rating, how often it's been played, its themes and its game. */
function PuzzleFacts({ puzzle }: { puzzle: ChaalPuzzle }) {
	const themes = puzzle.themes.flatMap((key) => {
		const name = themeName(key);
		return name ? [{ key, name }] : [];
	});
	const { white, black } = puzzle.game;
	return (
		<div className="flex flex-col gap-3 text-sm" data-testid="chaal-puzzle-facts">
			<dl className="grid grid-cols-2 gap-x-4 gap-y-1">
				<dt className="text-ch-muted">{m.ch_puzzle_rating()}</dt>
				<dd className="ch-figures text-end" data-testid="chaal-puzzle-rating">
					{formatNumber(puzzle.rating)}
				</dd>
				<dt className="text-ch-muted">{m.ch_puzzle_plays()}</dt>
				<dd className="ch-figures text-end">{formatNumber(puzzle.plays)}</dd>
			</dl>
			{themes.length > 0 ? (
				<ul className="flex flex-wrap gap-1.5" aria-label={m.ch_puzzle_themes()} data-testid="chaal-puzzle-themes">
					{themes.map((theme) => (
						<li key={theme.key}>
							<Link
								{...chaalLinks.puzzles({ mode: "train", theme: theme.key })}
								className="block rounded-sm border border-ch-hair px-2 py-0.5 text-xs outline-none hover:border-ch-ink focus-visible:ring-[3px] focus-visible:ring-ring/50"
							>
								{theme.name}
							</Link>
						</li>
					))}
				</ul>
			) : null}
			<p className="text-ch-muted text-xs">
				{m.ch_puzzle_from_game({
					white: white.rating ? `${white.name} (${white.rating})` : white.name,
					black: black.rating ? `${black.name} (${black.rating})` : black.name,
				})}{" "}
				<a
					href={`${LICHESS}/${puzzle.game.id}`}
					rel="nofollow ugc noopener"
					target="_blank"
					className="underline underline-offset-2 hover:text-ch-ink"
				>
					{m.ch_puzzle_open_game()}
				</a>
			</p>
		</div>
	);
}

/**
 * The board's place while there's no puzzle to show (loading, an error, nothing left, puzzles
 * off): the same grid and a board-sized plate, so nothing moves when one arrives.
 */
export function PuzzlePlace({
	heading,
	busy = false,
	message,
	action,
	extra,
}: {
	heading: ReactNode;
	busy?: boolean;
	message?: string;
	action?: ReactNode;
	extra?: ReactNode;
}) {
	return (
		<div className={PUZZLE_GRID}>
			<div className="flex min-w-0 flex-col gap-2 lg:items-end" aria-busy={busy || undefined}>
				<div
					className={`${PUZZLE_BOARD} flex aspect-square items-center justify-center border-2 border-ch-ink bg-ch-plate p-6`}
					data-testid="chaal-puzzle-place"
				>
					{message ? (
						<div className="flex max-w-xs flex-col items-center gap-3 text-center text-ch-ink">
							<p className="text-base">{message}</p>
							{action}
						</div>
					) : null}
				</div>
			</div>
			<div className="flex min-w-0 flex-col gap-4 px-4 sm:px-0">
				<section className="flex flex-col gap-3" aria-labelledby="chaal-puzzle-heading">
					{heading}
				</section>
				{extra}
			</div>
		</div>
	);
}

/**
 * One puzzle on the board and its panel (PLAN Task 80; decision 0269). Render it with
 * `key={puzzle.id}`: each puzzle starts afresh. `heading` is the page's h1 and what sits by
 * it (the streak's count); `next` is the button or link after the puzzle; `extra` follows
 * the panel (the modes, the choices, the progress).
 */
export function PuzzleSolver({
	puzzle,
	heading,
	streak = false,
	onResult,
	next,
	extra,
}: {
	puzzle: ChaalPuzzle;
	heading: ReactNode;
	streak?: boolean;
	onResult: (result: TrainerResult) => void;
	next: ReactNode;
	extra?: ReactNode;
}) {
	const { preferences } = useChaalPreferences();
	const volume = preferences.sounds ? preferences.volume : 0;
	const { trainer, done, won, move, hint, reveal } = usePuzzleTrainer({ puzzle, streak, volume, onResult });
	const shapes: Shape[] = trainer.hint ? [{ from: trainer.hint, brush: "mark" }] : [];
	const playing = trainer.phase === "play";
	return (
		<div className={PUZZLE_GRID}>
			<div className="flex min-w-0 flex-col gap-2 lg:items-end">
				<div
					className={PUZZLE_BOARD}
					data-testid="chaal-puzzle-board"
					data-phase={trainer.phase}
					data-puzzle={puzzle.id}
				>
					<Board
						fen={trainer.fen}
						orientation={puzzle.color}
						movable={playing ? puzzle.color : "none"}
						lastMove={trainer.lastMove}
						onMove={move}
						shapes={shapes}
						autoQueen={preferences.autoQueen}
						coordinates={preferences.coordinates}
						theme={preferences.board}
						pieces={preferences.pieces}
						sound={volume > 0 ? volume : false}
						label={m.ch_puzzle_board_label({ side: sideName(puzzle.color) })}
					/>
				</div>
			</div>
			<div className="flex min-w-0 flex-col gap-4 px-4 sm:px-0">
				<section className="flex flex-col gap-3" aria-labelledby="chaal-puzzle-heading">
					{heading}
					<p
						className={`min-h-[2.5rem] text-base ${trainer.phase === "wrong" ? "text-ch-danger" : ""}`}
						aria-live="polite"
						data-testid="chaal-puzzle-status"
						data-won={done ? String(won) : undefined}
					>
						{statusOf(trainer, won, streak)}
					</p>
					<div className="flex flex-wrap items-center gap-2">
						{done ? (
							next
						) : (
							<>
								{streak ? null : (
									<Button
										type="button"
										variant="outline"
										onClick={hint}
										disabled={!playing || trainer.hint !== null}
										data-testid="chaal-puzzle-hint"
									>
										<LightbulbIcon aria-hidden />
										{m.ch_puzzle_hint()}
									</Button>
								)}
								<Button
									type="button"
									variant="ghost"
									onClick={reveal}
									disabled={trainer.phase === "reveal"}
									data-testid="chaal-puzzle-solution"
								>
									<EyeIcon aria-hidden />
									{m.ch_puzzle_solution()}
								</Button>
							</>
						)}
					</div>
					{done ? null : <p className="text-ch-muted text-xs">{m.ch_puzzle_help_note()}</p>}
					{done ? (
						<>
							<PuzzleFacts puzzle={puzzle} />
							<div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
								<Link
									{...analysisOf(trainer)}
									className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
									data-testid="chaal-puzzle-analyse"
								>
									<ChartSplineIcon aria-hidden className="size-4" />
									{m.ch_puzzle_analyse()}
								</Link>
								<a
									href={`${LICHESS}/training/${puzzle.id}`}
									rel="nofollow ugc noopener"
									target="_blank"
									className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
								>
									<ExternalLinkIcon aria-hidden className="size-4" />
									{m.ch_puzzle_open_lichess()}
								</a>
							</div>
						</>
					) : null}
				</section>
				{extra}
			</div>
		</div>
	);
}
