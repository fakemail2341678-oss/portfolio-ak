import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
	ChartSplineIcon,
	FlagIcon,
	HandshakeIcon,
	PauseIcon,
	PlayIcon,
	RotateCcwIcon,
	ShareIcon,
	Undo2Icon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useConfirm } from "@/components/dialogs/confirm";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionQueryOptions } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { ExportDialog } from "../analysis/analysis-dialogs";
import { Board } from "../board/board";
import { Clock } from "../board/clock";
import { GameControls, type Step, useBoardKeys } from "../board/game-controls";
import { Material } from "../board/material";
import { MoveList } from "../board/move-list";
import { PlayerStrip } from "../board/player-strip";
import { ResultBanner } from "../board/result-banner";
import { type Color, opposite, START_FEN, turnOf } from "../chess/rules";
import { sideName } from "../chess/speech";
import type { Engine } from "../engine/engine";
import { chaalLinks } from "../links";
import { useFairPlay } from "../live/fair-play";
import { useChaalPreferences } from "../settings/use-preferences";
import { analysisLineOf, fromRecord, localGamePgn, treeOf } from "./game";
import { clockLabel, opponentOf, pgnNames, playerName } from "./labels";
import { localGameQueryOptions } from "./queries";
import type { LocalGame } from "./types";
import { type LocalGameView, useLocalGame } from "./use-local-game";
import { useBrowserGames, useHydrated } from "./use-local-games";
import { useStartLocalGame } from "./use-start";

const route = getRouteApi("/_chaal/app/chaal/local/$id");

/**
 * /app/chaal/local/$id (PLAN Task 76; noindex): a local game, to play on or look back at.
 * With a session the loader read it from the account, so it renders on the server; without
 * one it's in this browser, read after hydration (a board-sized placeholder holds its
 * place until then). An id that's neither says so, with the way back to the hub.
 */
export function ChaalLocalGamePage() {
	const { id } = route.useParams();
	const { data: session } = useQuery(sessionQueryOptions());
	const signedIn = Boolean(session);
	const account = useQuery({ ...localGameQueryOptions(id), enabled: signedIn });
	const browser = useBrowserGames().find((game) => game.id === id) ?? null;
	const hydrated = useHydrated();
	const record = account.data ?? browser;
	const read = record ? fromRecord(record) : null;

	if (!read?.ok) {
		const waiting = !read && (!hydrated || (signedIn && account.isPending));
		return (
			<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-local">
				<h1 className="sr-only">{m.ch_local_title()}</h1>
				{waiting ? <GameSkeleton /> : <MissingGame />}
			</main>
		);
	}
	return <LocalGameBoard key={id} initial={read.game} signedIn={signedIn} />;
}

const PLACE = "w-full lg:max-w-[calc(100dvh-15rem)]";

/**
 * The board's place before there's a game: the same grid, strips and square as the board,
 * so the page doesn't move when this browser's game is read (or found missing).
 */
function BoardPlace({ children, busy }: { children?: ReactNode; busy?: boolean }) {
	return (
		<div className="mx-auto grid w-full max-w-7xl gap-x-8 gap-y-3 pt-2 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:px-8 lg:pt-6">
			<div className="flex flex-col gap-1 lg:items-end" aria-busy={busy || undefined}>
				<div className={`h-12 ${PLACE}`} />
				{children ?? <Skeleton className={`aspect-square rounded-none ${PLACE}`} />}
				<div className={`h-12 ${PLACE}`} />
			</div>
		</div>
	);
}

const GameSkeleton = () => <BoardPlace busy />;

/** An id that's neither on the account nor in this browser: said where the board would be. */
function MissingGame() {
	return (
		<BoardPlace>
			<div
				className={`ch-frame flex aspect-square flex-col items-start justify-center gap-4 bg-ch-plate p-6 sm:p-10 ${PLACE}`}
				data-testid="chaal-local-missing"
			>
				<p className="ch-display text-ch-head">{m.ch_local_missing_title()}</p>
				<p className="text-ch-muted">{m.ch_local_missing_body()}</p>
				<Button asChild>
					<Link {...chaalLinks.play()}>{m.ch_local_to_play()}</Link>
				</Button>
			</div>
		</BoardPlace>
	);
}

/** Where the board stands: the player's side (or White, face to face) at the bottom, turning with the move when flipping. */
function orientationOf(game: LocalGame, turn: Color, flipped: boolean): Color {
	const base: Color = game.mode === "engine" ? (game.color ?? "white") : game.layout === "flip" ? turn : "white";
	return flipped ? opposite(base) : base;
}

/** The game itself: the board between the two players, the actions, the moves, and the ending. */
export function LocalGameBoard({
	initial,
	signedIn,
	createEngine,
}: {
	initial: LocalGame;
	signedIn: boolean;
	/** Stories pass a computer of their own; the page loads Stockfish. */
	createEngine?: () => Engine;
}) {
	const fairPlay = useFairPlay();
	const view = useLocalGame({ initial, signedIn, locked: fairPlay.locked, createEngine });
	const { game, fen } = view;
	const { preferences } = useChaalPreferences();
	const notation = preferences.notation;
	const confirm = useConfirm();
	const startGame = useStartLocalGame();
	const [flipped, setFlipped] = useState(false);
	const [exporting, setExporting] = useState(false);
	// The ply shown when looking back; null follows the game.
	const [viewing, setViewing] = useState<number | null>(null);

	const tree = treeOf(game);
	const last = game.moves.length;
	const shownPly = viewing === null ? last : Math.min(viewing, last);
	const live = shownPly === last;
	const shownFen = shownPly === 0 ? game.startFen : (game.moves[shownPly - 1]?.fen ?? fen);
	const shownMove = shownPly > 0 ? game.moves[shownPly - 1] : null;
	const turn = turnOf(fen);
	const orientation = orientationOf(game, turn, flipped);
	const over = game.result !== null;

	const step = (to: Step) => {
		const target = to === "first" ? 0 : to === "prev" ? shownPly - 1 : to === "next" ? shownPly + 1 : last;
		const clamped = Math.max(0, Math.min(last, target));
		setViewing(clamped === last ? null : clamped);
	};
	useBoardKeys({ onStep: step, onFlip: () => setFlipped((value) => !value) });

	const resign = async () => {
		const side = game.mode === "engine" ? (game.color ?? "white") : turn;
		const sure = await confirm({
			title: m.ch_local_resign_title(),
			description: game.mode === "engine" ? m.ch_local_resign_you() : m.ch_local_resign_side({ side: sideName(side) }),
			confirmLabel: m.ch_local_resign(),
			destructive: true,
		});
		if (sure) view.resign(side);
	};
	const agree = async () => {
		const sure = await confirm({
			title: m.ch_local_draw_title(),
			description: m.ch_local_draw_description(),
			confirmLabel: m.ch_local_draw_agree(),
		});
		if (sure) view.agreeDraw();
	};

	const top = opposite(orientation);
	const bottom = orientation;
	const tablet = game.mode === "board" && game.layout === "tablet";
	const analysisLink = chaalLinks.analysis({
		moves: analysisLineOf(game),
		...(game.startFen !== START_FEN ? { fen: game.startFen } : {}),
	});
	const pgn = localGamePgn(game, pgnNames(game));
	const shareLink =
		typeof window === "undefined"
			? ""
			: `${window.location.origin}${window.location.pathname.replace(/\/local\/[^/]+$/, "/analysis")}?moves=${analysisLineOf(game)}`;

	const strip = (side: Color, rotated: boolean) => (
		<PlayerStrip
			name={playerName(game, side)}
			color={side}
			active={!over && turn === side}
			note={stripNote(view, side)}
			material={<Material fen={shownFen} color={side} pieces={preferences.pieces} />}
			className={`w-full lg:max-w-[calc(100dvh-15rem)] ${rotated ? "rotate-180" : ""}`}
		>
			{view.clock ? (
				<Clock
					ms={view.clock[side]}
					color={side}
					running={view.clock.running === side}
					since={view.clock.since}
					className="text-[2rem] sm:text-ch-clock"
				/>
			) : null}
		</PlayerStrip>
	);

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-local">
			<h1 className="sr-only">
				{m.ch_local_title()}: {opponentOf(game)}
			</h1>
			<div className="mx-auto grid w-full max-w-7xl gap-x-8 gap-y-3 pt-2 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:px-8 lg:pt-6">
				<div className="flex min-w-0 flex-col gap-1 lg:items-end">
					<div className="w-full px-4 sm:px-0 lg:max-w-[calc(100dvh-15rem)]" data-testid="chaal-local-top">
						{strip(top, tablet)}
					</div>
					<div className="w-full lg:max-w-[calc(100dvh-15rem)]" data-testid="chaal-local-board">
						<Board
							fen={shownFen}
							orientation={orientation}
							movable={live && view.movable ? view.movable : "none"}
							lastMove={shownMove ? { uci: shownMove.uci, san: shownMove.san } : null}
							onMove={view.move}
							autoQueen={preferences.autoQueen}
							coordinates={preferences.coordinates}
							theme={preferences.board}
							pieces={preferences.pieces}
							sound={preferences.sounds ? preferences.volume : false}
							label={m.ch_local_board_label()}
						/>
					</div>
					<div className="w-full px-4 sm:px-0 lg:max-w-[calc(100dvh-15rem)]" data-testid="chaal-local-bottom">
						{strip(bottom, false)}
					</div>
					<div className="flex w-full flex-col gap-2 px-4 sm:px-0 lg:max-w-[calc(100dvh-15rem)]">
						<GameControls
							onStep={step}
							canBack={shownPly > 0}
							canForward={!live}
							onFlip={() => setFlipped((value) => !value)}
						>
							{over ? null : <GameActions view={view} onResign={() => void resign()} onAgree={() => void agree()} />}
						</GameControls>
						<MoveList
							tree={tree}
							current={String(shownPly)}
							onSelect={(id) => setViewing(Number(id) >= last ? null : Number(id))}
							layout="strip"
							notation={notation}
							className="lg:hidden"
						/>
					</div>
				</div>

				<div className="flex min-w-0 flex-col gap-4 px-4 sm:px-0">
					<div className="ch-rule flex flex-col gap-1 pt-3">
						<p className="ch-display text-ch-head">{opponentOf(game)}</p>
						<p className="text-ch-muted text-sm">
							{[
								game.mode === "engine" && game.color ? m.ch_history_you_played({ side: sideName(game.color) }) : null,
								clockLabel(game.clock),
								game.mode === "board"
									? game.layout === "tablet"
										? m.ch_play_layout_tablet()
										: m.ch_play_layout_flip()
									: null,
							]
								.filter(Boolean)
								.join(" · ")}
						</p>
					</div>
					<GameStatus view={view} />
					{over && game.result ? (
						<div className="flex flex-col gap-3">
							<ResultBanner result={game.result} reason={game.reason ?? undefined} />
							<div className="flex flex-wrap gap-2">
								<Button asChild data-testid="chaal-local-analyse">
									<Link {...analysisLink}>
										<ChartSplineIcon aria-hidden />
										{m.ch_local_analyse()}
									</Link>
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => setExporting(true)}
									data-testid="chaal-local-export"
								>
									<ShareIcon aria-hidden />
									{m.ch_export_title()}
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => void startGame(setupOf(game))}
									data-testid="chaal-local-again"
								>
									<RotateCcwIcon aria-hidden />
									{m.ch_local_again()}
								</Button>
							</div>
						</div>
					) : null}
					<MoveList
						tree={tree}
						current={String(shownPly)}
						onSelect={(id) => setViewing(Number(id) >= last ? null : Number(id))}
						layout="table"
						notation={notation}
						className="max-h-[24rem] max-lg:hidden"
					/>
					<Link {...chaalLinks.play()} className="text-sm underline-offset-4 hover:underline">
						{m.ch_local_to_play()}
					</Link>
				</div>
			</div>
			<ExportDialog
				open={exporting}
				onOpenChange={setExporting}
				pgn={pgn}
				fen={fen}
				link={shareLink}
				fileName={`chaal-${game.createdAt.slice(0, 10)}.pgn`}
			/>
		</main>
	);
}

/** The game's own actions beside the step buttons: takeback, a draw, pause, resign. */
function GameActions({ view, onResign, onAgree }: { view: LocalGameView; onResign: () => void; onAgree: () => void }) {
	const { game } = view;
	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={view.takeBack}
				disabled={!view.canTakeBack}
				aria-label={m.ch_local_takeback()}
				title={m.ch_local_takeback()}
				className="ch-press"
				data-testid="chaal-local-takeback"
			>
				<Undo2Icon aria-hidden />
			</Button>
			{view.claim ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={view.claimDraw}
					className="ch-press"
					data-testid="chaal-local-claim"
				>
					<HandshakeIcon aria-hidden />
					{m.ch_local_claim()}
				</Button>
			) : game.mode === "board" ? (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={onAgree}
					aria-label={m.ch_local_draw_agree()}
					title={m.ch_local_draw_agree()}
					className="ch-press"
					data-testid="chaal-local-draw"
				>
					<HandshakeIcon aria-hidden />
				</Button>
			) : null}
			{game.clock ? (
				view.paused ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={view.resume}
						className="ch-press"
						data-testid="chaal-local-resume"
					>
						<PlayIcon aria-hidden />
						{m.ch_local_continue()}
					</Button>
				) : (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={view.pause}
						disabled={!view.clock?.running}
						aria-label={m.ch_local_pause()}
						title={m.ch_local_pause()}
						className="ch-press"
						data-testid="chaal-local-pause"
					>
						<PauseIcon aria-hidden />
					</Button>
				)
			) : null}
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={onResign}
				aria-label={m.ch_local_resign()}
				title={m.ch_local_resign()}
				className="ch-press"
				data-testid="chaal-local-resign"
			>
				<FlagIcon aria-hidden />
			</Button>
		</>
	);
}

/** One line on what the game waits for: the computer, a paused clock, or the engine failing to start. */
function GameStatus({ view }: { view: LocalGameView }) {
	const { computer, paused } = view;
	let text: string | null = null;
	if (view.game.result) text = null;
	else if (paused) text = m.ch_local_paused();
	else if (computer.status === "failed") text = m.ch_local_engine_failed();
	else if (computer.status === "loading")
		text = m.ch_local_engine_loading({ percent: String(Math.round(computer.progress * 100)) });
	else if (computer.status === "thinking") text = m.ch_local_thinking();
	return (
		<p className="min-h-5 text-ch-muted text-sm" aria-live="polite" data-testid="chaal-local-status">
			{text}
		</p>
	);
}

function stripNote(view: LocalGameView, side: Color): string | undefined {
	const { game } = view;
	if (game.result) return undefined;
	if (game.mode === "engine" && side !== game.color && view.computer.status === "thinking")
		return m.ch_local_thinking();
	if (turnOf(view.fen) === side)
		return game.mode === "engine" && side === game.color ? m.ch_local_your_move() : undefined;
	return undefined;
}

/** "Play again" starts the same game: the same level, side and clock, or the same clock and layout. */
function setupOf(game: LocalGame) {
	return game.mode === "engine"
		? { mode: "engine" as const, level: game.level ?? 1, color: game.color ?? ("white" as const), clock: game.clock }
		: { mode: "board" as const, clock: game.clock, layout: game.layout ?? ("flip" as const) };
}
