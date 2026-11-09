import { Link } from "@tanstack/react-router";
import { ChartSplineIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/data-display/copy-button";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";
import { Board } from "../board/board";
import { Clock } from "../board/clock";
import { EvalGraph } from "../board/eval-graph";
import { GameControls, type Step, useBoardKeys } from "../board/game-controls";
import { Material } from "../board/material";
import { MoveList } from "../board/move-list";
import { OpeningName } from "../board/opening-name";
import { PlayerStrip } from "../board/player-strip";
import { ResultBanner } from "../board/result-banner";
import { type Color, opposite, turnOf } from "../chess/rules";
import { chaalLinks } from "../links";
import { gameKind } from "../players/labels";
import type { ChaalReplay, ReplayPlayer } from "../players/schema";
import { useChaalPreferences } from "../settings/use-preferences";
import { LAND_BOARD, LAND_SIDE, PLACE, PLAY_COLUMN, playGrid, STRIP } from "../shell/play-layout";
import { lichessGameUrl } from "./lichess-links";
import { clocksAt, replayEnding, replayLine, replayScores } from "./replay";

/** A player's name as a replay shows it: the Lichess AI by its level. */
const nameOf = (player: ReplayPlayer) =>
	player.aiLevel !== null ? m.ch_live_ai_name({ level: String(player.aiLevel) }) : player.name;

/** "+12" or "−8" after a rated game. */
const diffText = (diff: number | null) => (diff === null ? undefined : diff >= 0 ? `+${diff}` : `−${-diff}`);

/**
 * A finished game, replayed (Task 81, decision 0271): the board between the players with
 * each side's clock as it stood after every move, the moves with Lichess's judgements as
 * the annotator's symbols, Lichess's eval graph and each side's summary when the game was
 * analysed, the result, and the PGN, "Analyse" and lichess.org. Opens at the end.
 */
export function ReplayBoard({ game }: { game: ChaalReplay }) {
	const { preferences } = useChaalPreferences();
	const [line] = useState(() => replayLine(game));
	const last = line.ids.length - 1;
	const [ply, setPly] = useState(last);
	const [flipped, setFlipped] = useState(false);
	const orientation: Color = flipped ? "black" : "white";
	const node = line.tree.nodes[line.ids[ply] ?? line.tree.root] ?? line.tree.nodes[line.tree.root];
	const fen = node?.fen ?? line.startFen;
	const clocks = clocksAt(game, line.startFen, ply);
	const ending = replayEnding(game);
	const scores = replayScores(game);
	const analysed = game.analysis !== null && (game.white.analysis !== null || game.black.analysis !== null);

	const step = (to: Step) => {
		const target = to === "first" ? 0 : to === "prev" ? ply - 1 : to === "next" ? ply + 1 : last;
		setPly(Math.max(0, Math.min(last, target)));
	};
	useBoardKeys({ onStep: step, onFlip: () => setFlipped((value) => !value) });
	const select = (id: string) => {
		const index = line.ids.indexOf(id);
		if (index >= 0) setPly(index);
	};

	const strip = (side: Color) => {
		const player = game[side];
		return (
			<PlayerStrip
				name={nameOf(player)}
				color={side}
				title={player.title}
				rating={player.rating}
				href={player.id ? localizeHref(`/app/chaal/players/${player.name}`) : undefined}
				active={ply < last && turnOf(fen) === side}
				note={ply === last ? diffText(player.ratingDiff) : undefined}
				material={<Material fen={fen} color={side} pieces={preferences.pieces} />}
				className={PLACE}
			>
				{clocks ? <Clock ms={clocks[side]} color={side} className="text-[2rem] sm:text-ch-clock" /> : null}
			</PlayerStrip>
		);
	};

	const download = () => {
		const url = URL.createObjectURL(new Blob([game.pgn], { type: "application/x-chess-pgn" }));
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `lichess-${game.id}.pgn`;
		anchor.click();
		URL.revokeObjectURL(url);
	};

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-replay">
			<h1 className="sr-only">{m.ch_replay_heading({ white: nameOf(game.white), black: nameOf(game.black) })}</h1>
			<div className={playGrid(false)}>
				<div className={`${PLAY_COLUMN} lg:items-end`}>
					<div className={`${STRIP} land:row-start-1`}>{strip(opposite(orientation))}</div>
					<div className={`${PLACE} ${LAND_BOARD}`} data-testid="chaal-replay-board">
						<Board
							fen={fen}
							orientation={orientation}
							movable="none"
							lastMove={node?.uci && node.san ? { uci: node.uci, san: node.san } : null}
							coordinates={preferences.coordinates}
							theme={preferences.board}
							pieces={preferences.pieces}
							sound={preferences.sounds ? preferences.volume : false}
							label={m.ch_replay_board_label()}
						/>
					</div>
					<div className={`${STRIP} land:row-start-2`}>{strip(orientation)}</div>
					<div
						className={`flex w-full flex-col gap-2 px-4 sm:px-0 lg:max-w-[calc(100dvh-15rem)] ${LAND_SIDE} land:row-start-3`}
					>
						<GameControls
							onStep={step}
							canBack={ply > 0}
							canForward={ply < last}
							onFlip={() => setFlipped((value) => !value)}
						/>
						<MoveList
							tree={line.tree}
							current={line.ids[ply] ?? line.tree.root}
							onSelect={select}
							layout="strip"
							notation={preferences.notation}
							className="lg:hidden"
						/>
					</div>
				</div>

				<div className="flex min-w-0 flex-col gap-4 px-4 sm:px-0">
					<div className="ch-rule flex flex-col gap-1 pt-3">
						<p className="ch-display text-ch-head" data-testid="chaal-replay-title">
							{nameOf(game.white)} – {nameOf(game.black)}
						</p>
						<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ch-muted text-sm">
							<span>{gameKind(game)}</span>
							{game.createdAt ? (
								<time dateTime={new Date(game.createdAt).toISOString()}>{formatDate(game.createdAt)}</time>
							) : null}
						</p>
						<OpeningName opening={game.opening} />
					</div>
					{ending ? <ResultBanner result={ending.result} reason={ending.reason ?? undefined} /> : null}
					{analysed ? (
						<section aria-labelledby="chaal-replay-analysis" className="flex flex-col gap-2">
							<h2 id="chaal-replay-analysis" className="font-semibold text-sm">
								{m.ch_replay_analysis()}
							</h2>
							<EvalGraph scores={scores} current={ply - 1} onSelect={(index) => setPly(Math.max(0, index + 1))} />
							<table className="w-full text-sm" data-testid="chaal-replay-summary">
								<thead>
									<tr className="text-ch-muted text-xs">
										<td />
										<th scope="col" className="truncate py-1 text-end font-normal">
											{nameOf(game.white)}
										</th>
										<th scope="col" className="truncate py-1 text-end font-normal">
											{nameOf(game.black)}
										</th>
									</tr>
								</thead>
								<tbody>
									<SummaryRow label={m.ch_replay_accuracy()} white={game.white} black={game.black} pick="accuracy" />
									<SummaryRow
										label={m.ch_replay_inaccuracies()}
										white={game.white}
										black={game.black}
										pick="inaccuracy"
									/>
									<SummaryRow label={m.ch_replay_mistakes()} white={game.white} black={game.black} pick="mistake" />
									<SummaryRow label={m.ch_replay_blunders()} white={game.white} black={game.black} pick="blunder" />
									<SummaryRow label={m.ch_replay_acpl()} white={game.white} black={game.black} pick="acpl" />
								</tbody>
							</table>
						</section>
					) : (
						<p className="text-ch-muted text-sm" data-testid="chaal-replay-not-analysed">
							{m.ch_replay_not_analysed()}
						</p>
					)}
					<MoveList
						tree={line.tree}
						current={line.ids[ply] ?? line.tree.root}
						onSelect={select}
						layout="table"
						notation={preferences.notation}
						className="max-h-[24rem] max-lg:hidden"
					/>
					<div className="flex flex-wrap gap-2">
						<Button asChild>
							<Link {...chaalLinks.analysis({ fen: game.initialFen ?? undefined, moves: line.uci.join("_") })}>
								<ChartSplineIcon aria-hidden />
								{m.ch_replay_analyse()}
							</Link>
						</Button>
						<CopyButton value={game.pgn} label={m.ch_export_copy_pgn()} showLabel />
						<Button type="button" variant="outline" size="sm" onClick={download}>
							<DownloadIcon aria-hidden />
							{m.ch_export_download()}
						</Button>
						<Button asChild variant="outline" size="sm">
							<a href={lichessGameUrl(game.id)} rel="noopener" target="_blank">
								<ExternalLinkIcon aria-hidden />
								{m.ch_game_on_lichess()}
							</a>
						</Button>
					</div>
				</div>
			</div>
		</main>
	);
}

type SummaryKey = "accuracy" | "inaccuracy" | "mistake" | "blunder" | "acpl";

/** One line of Lichess's summary: a figure for each side. */
function SummaryRow({
	label,
	white,
	black,
	pick,
}: {
	label: string;
	white: ReplayPlayer;
	black: ReplayPlayer;
	pick: SummaryKey;
}) {
	const value = (player: ReplayPlayer) => {
		const figure = player.analysis?.[pick];
		if (figure === null || figure === undefined) return "–";
		return pick === "accuracy" ? `${Math.round(figure)}%` : String(figure);
	};
	return (
		<tr className="border-ch-hair border-t">
			<th scope="row" className="py-1 text-start font-normal">
				{label}
			</th>
			<td className="ch-figures py-1 text-end">{value(white)}</td>
			<td className="ch-figures py-1 text-end">{value(black)}</td>
		</tr>
	);
}
