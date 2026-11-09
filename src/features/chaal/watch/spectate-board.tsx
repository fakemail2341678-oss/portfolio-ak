import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";
import { Board } from "../board/board";
import { Clock } from "../board/clock";
import { GameControls, type Step, useBoardKeys } from "../board/game-controls";
import { Material } from "../board/material";
import { MoveList } from "../board/move-list";
import { OpeningName } from "../board/opening-name";
import { PlayerStrip } from "../board/player-strip";
import { ResultBanner } from "../board/result-banner";
import { type Color, opposite, turnOf } from "../chess/rules";
import { addMove, createTree, type GameTree } from "../chess/tree";
import { lichessGameUrl } from "../game/lichess-links";
import { endingOf } from "../game/live-game";
import { clocksAt } from "../game/replay";
import { gameKind } from "../players/labels";
import type { ChaalReplay, ReplayPlayer } from "../players/schema";
import { chaalStatusQueryOptions } from "../queries";
import { useChaalPreferences } from "../settings/use-preferences";
import { LAND_BOARD, LAND_SIDE, PLACE, PLAY_COLUMN, playGrid, STRIP } from "../shell/play-layout";
import { gameStreamUrl } from "./live";
import { applySpectateLine, type Spectated, spectatedFen, spectatedFrom } from "./spectate";
import { usePageVisible, usePublicStream } from "./use-live";
import { ClockPlace, LiveDot } from "./watch-header";

const nameOf = (player: ReplayPlayer) =>
	player.aiLevel !== null ? m.ch_live_ai_name({ level: String(player.aiLevel) }) : player.name;

/** The moves as the kit's move list takes them: a tree with one line, and the node at each ply. */
function lineOf(state: Spectated): { tree: GameTree; ids: string[] } {
	let tree = createTree(state.startFen);
	const ids = [tree.root];
	for (const move of state.moves) {
		const added = addMove(tree, ids[ids.length - 1] ?? tree.root, move);
		tree = added.tree;
		ids.push(added.id);
	}
	return { tree, ids };
}

/**
 * Someone else's game while it's played (Task 82, decision 0272): the board between the
 * players with their clocks, the moves so far, following each new one from Lichess's stream
 * (three moves behind, as Lichess shows spectators) unless the viewer has stepped back. When
 * it ends the result shows and `onOver` lets the page bring the replay in.
 */
export function SpectateBoard({ game, onOver }: { game: ChaalReplay; onOver?: () => void }) {
	const { preferences } = useChaalPreferences();
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const visible = usePageVisible();
	const [state, setState] = useState<Spectated>(() => spectatedFrom(game));
	const over = state.over;
	const link = usePublicStream(
		status?.live && visible && !over ? gameStreamUrl(status.live, game.id) : null,
		(value) => setState((current) => applySpectateLine(current, value, performance.now())),
		// The stream ends with the game: it isn't opened again.
		{ reopenWhenClosed: false },
	);
	useEffect(() => {
		if (over) onOver?.();
	}, [over, onOver]);

	const { tree, ids } = lineOf(state);
	const exportClocks = clocksAt(game, state.startFen, game.moves.length);
	const last = ids.length - 1;
	// Null follows the game: each new move shows as it comes.
	const [chosen, setChosen] = useState<number | null>(null);
	const ply = chosen === null ? last : Math.min(chosen, last);
	const [flipped, setFlipped] = useState(false);
	const orientation: Color = flipped ? "black" : "white";
	const node = tree.nodes[ids[ply] ?? tree.root];
	const fen = node?.fen ?? spectatedFen(state);
	const turn = turnOf(spectatedFen(state));
	const ending = over ? endingOf({ status: over.status, winner: over.winner }) : null;

	const step = (to: Step) => {
		const target = to === "first" ? 0 : to === "prev" ? ply - 1 : to === "next" ? ply + 1 : last;
		const clamped = Math.max(0, Math.min(last, target));
		setChosen(clamped >= last ? null : clamped);
	};
	useBoardKeys({ onStep: step, onFlip: () => setFlipped((value) => !value) });
	const select = (id: string) => {
		const index = ids.indexOf(id);
		if (index >= 0) setChosen(index >= last ? null : index);
	};

	const strip = (side: Color) => {
		const player = game[side];
		// The stream's clocks, else the export's after the last move (both in the first paint when the game has a clock).
		const seconds = state.clocks?.[side] ?? (exportClocks ? exportClocks[side] / 1_000 : undefined);
		return (
			<PlayerStrip
				name={nameOf(player)}
				color={side}
				title={player.title}
				rating={player.rating}
				href={player.id ? localizeHref(`/app/chaal/players/${player.name}`) : undefined}
				active={!over && turn === side}
				material={<Material fen={fen} color={side} pieces={preferences.pieces} />}
				className={PLACE}
			>
				{seconds === undefined ? (
					game.clock ? (
						<ClockPlace />
					) : null
				) : (
					<Clock
						ms={seconds * 1_000}
						since={state.at}
						running={!over && turn === side && chosen === null && state.clocks !== null}
						color={side}
						className="text-[2rem] sm:text-ch-clock"
					/>
				)}
			</PlayerStrip>
		);
	};

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-spectate">
			<h1 className="sr-only">{m.ch_spectate_heading({ white: nameOf(game.white), black: nameOf(game.black) })}</h1>
			<div className={playGrid(false)}>
				<div className={`${PLAY_COLUMN} lg:items-end`}>
					<div className={`${STRIP} land:row-start-1`}>{strip(opposite(orientation))}</div>
					<div className={`${PLACE} ${LAND_BOARD}`} data-testid="chaal-spectate-board" data-ply={ply}>
						<Board
							fen={fen}
							orientation={orientation}
							movable="none"
							lastMove={node?.uci && node.san ? { uci: node.uci, san: node.san } : null}
							coordinates={preferences.coordinates}
							theme={preferences.board}
							pieces={preferences.pieces}
							sound={preferences.sounds ? preferences.volume : false}
							label={m.ch_spectate_board_label()}
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
							tree={tree}
							current={ids[ply] ?? tree.root}
							onSelect={select}
							layout="strip"
							notation={preferences.notation}
							className="lg:hidden"
						/>
					</div>
				</div>

				<div className="flex min-w-0 flex-col gap-4 px-4 sm:px-0">
					<div className="ch-rule flex flex-col gap-1 pt-3">
						<p className="ch-display text-ch-head">
							{nameOf(game.white)} – {nameOf(game.black)}
						</p>
						<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ch-muted text-sm">
							<span>{gameKind(game)}</span>
							{over ? null : <LiveDot link={link} behind />}
						</p>
						<OpeningName opening={game.opening} />
					</div>
					{ending?.result ? (
						<ResultBanner result={ending.result} reason={ending.reason ?? undefined} />
					) : (
						<p className="text-ch-muted text-sm" data-testid="chaal-spectate-note">
							{chosen === null ? m.ch_spectate_note() : m.ch_spectate_stepped_back()}
						</p>
					)}
					<MoveList
						tree={tree}
						current={ids[ply] ?? tree.root}
						onSelect={select}
						layout="table"
						notation={preferences.notation}
						className="max-h-[24rem] max-lg:hidden"
					/>
					<div className="flex flex-wrap gap-2">
						{chosen !== null ? (
							<Button type="button" size="sm" onClick={() => setChosen(null)} data-testid="chaal-spectate-live">
								{m.ch_spectate_back_to_live()}
							</Button>
						) : null}
						<Button asChild variant="outline" size="sm">
							<a href={lichessGameUrl(game.id)} rel="noopener" target="_blank">
								<ExternalLinkIcon aria-hidden />
								{m.ch_game_on_lichess()}
								<span className="sr-only"> {m.ch_opens_new_tab()}</span>
							</a>
						</Button>
					</div>
				</div>
			</div>
		</main>
	);
}
