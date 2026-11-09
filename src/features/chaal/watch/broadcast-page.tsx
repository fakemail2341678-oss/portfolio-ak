import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, ChartSplineIcon, ExternalLinkIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/data-display/copy-button";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { Board } from "../board/board";
import { Clock } from "../board/clock";
import { EvalGraph } from "../board/eval-graph";
import { GameControls, type Step, useBoardKeys } from "../board/game-controls";
import { Material } from "../board/material";
import { MiniBoard } from "../board/mini-board";
import { MoveList } from "../board/move-list";
import { PlayerStrip } from "../board/player-strip";
import { ResultBanner } from "../board/result-banner";
import { formatClock } from "../chess/clock";
import { type Color, type GameResult, opposite } from "../chess/rules";
import { lineFrom } from "../chess/tree";
import { chaalKeys } from "../keys";
import { chaalLinks } from "../links";
import { chaalStatusQueryOptions } from "../queries";
import { useChaalPreferences } from "../settings/use-preferences";
import { LAND_BOARD, LAND_SIDE, PLACE, PLAY_COLUMN, playGrid, STRIP } from "../shell/play-layout";
import { infoLine, roundWhen } from "./broadcasts-page";
import { roundStreamUrl, squaresOfMove } from "./live";
import {
	broadcastGameQueryOptions,
	broadcastRoundQueryOptions,
	broadcastTourQueryOptions,
	roundShown,
} from "./queries";
import {
	asText,
	boardFromPgn,
	boardOf,
	clocksAfter,
	lichessAddress,
	pgnGames,
	readBoard,
	resultOf,
	updatedBoard,
} from "./round-live";
import type { BoardResult, BroadcastBoard, BroadcastPlayer, ChaalBroadcastRound, ChaalBroadcastTour } from "./schema";
import { type LiveLink, usePageVisible, usePublicStream } from "./use-live";
import { LiveDot, WatchOff } from "./watch-header";

const route = getRouteApi("/_chaal/app/chaal/broadcasts/$id");

/**
 * /app/chaal/broadcasts/$id (Task 82, decision 0272; noindex): a broadcast tournament, its
 * rounds, and a round's boards as diagrams, or one board followed (`?board=`) on the big
 * board with its moves, clocks and Lichess's evals. While a round is played the browser reads
 * its PGN stream from Lichess, which keeps both up to date; a finished round is its replay.
 */
export function ChaalBroadcastPage() {
	const { id } = route.useParams();
	const search = route.useSearch();
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const tour = useQuery(broadcastTourQueryOptions(id));
	const off = status?.features.watch === false;
	const roundId = tour.data ? roundShown(tour.data, search) : null;

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-broadcast">
			{off ? (
				<Frame>
					<WatchOff />
				</Frame>
			) : tour.data ? (
				<>
					<Frame>
						<TourHeader tour={tour.data} compact={Boolean(search.board)} />
						<RoundNav tour={tour.data} current={roundId} />
					</Frame>
					{roundId ? (
						<Round
							key={roundId}
							tourId={tour.data.id}
							roundId={roundId}
							board={search.board ?? null}
							live={status?.live ?? null}
						/>
					) : (
						<Frame>
							<p className="text-ch-muted">{m.ch_broadcast_no_rounds()}</p>
						</Frame>
					)}
				</>
			) : tour.isError ? (
				<Frame>
					<Failed error={tour.error} retry={() => void tour.refetch()} />
				</Frame>
			) : (
				<Frame>
					<Skeleton className="h-[32rem] w-full rounded-none" />
				</Frame>
			)}
		</main>
	);
}

function Frame({ children }: { children: ReactNode }) {
	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-8 sm:px-6 lg:px-8 lg:pt-12">{children}</div>
	);
}

function Failed({ error, retry }: { error: unknown; retry: () => void }) {
	return (
		<div className="flex flex-col items-start gap-3" data-testid="chaal-broadcast-error">
			<p className="text-ch-muted">{errorMessage(error)}</p>
			<Button type="button" variant="outline" onClick={retry}>
				{m.error_retry()}
			</Button>
		</div>
	);
}

const external = "inline-flex items-center gap-1 underline-offset-4 hover:underline";

/**
 * The tournament: its name, its group, what it says about itself, its days, and its links
 * (someone else's: nofollow). With a board followed it's only the name, so the board comes
 * first on a phone.
 */
function TourHeader({ tour, compact }: { tour: ChaalBroadcastTour; compact: boolean }) {
	const info = infoLine(tour.info);
	const [first, last] = tour.dates;
	if (compact)
		return (
			<header>
				<h1 className="ch-display truncate text-ch-head" data-testid="chaal-broadcast-name">
					{tour.name}
				</h1>
			</header>
		);
	return (
		<header className="flex flex-col gap-2">
			<p className="text-ch-muted text-sm">
				<Link
					{...chaalLinks.broadcasts()}
					className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
				>
					<ArrowLeftIcon aria-hidden className="size-3.5" />
					{m.ch_broadcasts_title()}
				</Link>
			</p>
			<h1 className="ch-display text-ch-title" data-testid="chaal-broadcast-name">
				{tour.name}
			</h1>
			{tour.group && tour.group !== tour.name ? <p className="text-ch-muted">{tour.group}</p> : null}
			{info ? <p className="text-ch-muted text-sm">{info}</p> : null}
			<p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ch-muted text-sm">
				{first ? (
					<span>
						{last && last !== first
							? m.ch_broadcast_dates({ from: formatDate(first), to: formatDate(last) })
							: formatDate(first)}
					</span>
				) : null}
				{tour.tier ? <span>{m.ch_broadcast_official()}</span> : null}
				{tour.info.website ? (
					<a href={tour.info.website} rel="nofollow ugc noopener" target="_blank" className={external}>
						<ExternalLinkIcon aria-hidden className="size-3.5" />
						{m.ch_broadcast_website()}
						<span className="sr-only"> {m.ch_opens_new_tab()}</span>
					</a>
				) : null}
				{tour.info.standings ? (
					<a href={tour.info.standings} rel="nofollow ugc noopener" target="_blank" className={external}>
						<ExternalLinkIcon aria-hidden className="size-3.5" />
						{m.ch_broadcast_standings()}
						<span className="sr-only"> {m.ch_opens_new_tab()}</span>
					</a>
				) : null}
				<a href={tour.url} rel="noopener" target="_blank" className={external}>
					<ExternalLinkIcon aria-hidden className="size-3.5" />
					{m.ch_game_on_lichess()}
					<span className="sr-only"> {m.ch_opens_new_tab()}</span>
				</a>
			</p>
		</header>
	);
}

/** The rounds, as tabs that scroll sideways on a phone; the one being played has a dot. */
function RoundNav({ tour, current }: { tour: ChaalBroadcastTour; current: string | null }) {
	const nav = useRef<HTMLElement>(null);
	// The round shown is scrolled into view (a phone shows three or four of nine).
	useEffect(() => {
		const element = nav.current;
		const shown = element?.querySelector<HTMLElement>('[aria-current="page"]');
		if (element && shown) element.scrollLeft = shown.offsetLeft - (element.clientWidth - shown.clientWidth) / 2;
	}, []);
	if (tour.rounds.length <= 1) return null;
	return (
		<nav ref={nav} aria-label={m.ch_broadcast_rounds()} className="ch-rule -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
			<ul className="flex gap-1">
				{tour.rounds.map((round) => (
					<li key={round.id}>
						<Link
							{...chaalLinks.broadcast(tour.id, { round: round.id })}
							aria-current={round.id === current ? "page" : undefined}
							className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-ch-muted text-sm transition-colors hover:text-ch-ink aria-[current=page]:text-ch-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--ch-ink)]"
							data-testid="chaal-broadcast-round"
							data-round={round.id}
						>
							{round.state === "ongoing" ? (
								<span aria-hidden className="inline-block size-2 rounded-full bg-ch-ink" />
							) : null}
							{round.name}
							{round.state === "ongoing" ? <span className="sr-only"> ({m.ch_broadcast_round_live()})</span> : null}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}

/** A round: its boards, live from its PGN stream while it's played. */
function Round({
	tourId,
	roundId,
	board,
	live,
}: {
	tourId: string;
	roundId: string;
	board: string | null;
	live: string | null;
}) {
	const round = useQuery(broadcastRoundQueryOptions(roundId));
	if (!round.data)
		return (
			<Frame>
				{round.isError ? (
					<Failed error={round.error} retry={() => void round.refetch()} />
				) : (
					<Skeleton className="h-[32rem] w-full rounded-none" />
				)}
			</Frame>
		);
	return <RoundLive tourId={tourId} round={round.data} board={board} live={live} />;
}

/** The round's stream: every board's latest PGN, and the boards brought up to date. */
function useRoundLive(round: ChaalBroadcastRound, live: string | null) {
	const queryClient = useQueryClient();
	const visible = usePageVisible();
	const [boards, setBoards] = useState<BroadcastBoard[]>(round.boards);
	const [pgns, setPgns] = useState<Readonly<Record<string, string>>>({});
	const playing = round.round.state !== "finished";
	const link = usePublicStream(
		live && visible && playing ? roundStreamUrl(live, round.round.id) : null,
		(value) => {
			if (typeof value !== "string") return;
			const id = boardOf(value);
			const game = id ? readBoard(value) : null;
			if (!id || !game) return;
			setPgns((current) => ({ ...current, [id]: value }));
			setBoards((current) => {
				const index = current.findIndex((each) => each.id === id);
				const known = current[index];
				if (!known) return [...current, boardFromPgn(id, game)];
				const updated = updatedBoard(known, game);
				return current.map((each, at) => (at === index ? updated : each));
			});
		},
		{
			split: pgnGames,
			parse: asText,
			accept: "application/x-chess-pgn",
			// A round can be quiet for minutes between moves; a reconnect restates every board.
			silenceMs: 10 * 60_000,
			// Lichess ends the stream when the round is over: its state is read again.
			reopenWhenClosed: false,
		},
	);
	useEffect(() => {
		if (link === "closed") void queryClient.invalidateQueries({ queryKey: chaalKeys.broadcastRound(round.round.id) });
	}, [link, queryClient, round.round.id]);
	return { boards, pgns, link: playing ? link : null };
}

function RoundLive({
	tourId,
	round,
	board,
	live,
}: {
	tourId: string;
	round: ChaalBroadcastRound;
	board: string | null;
	live: string | null;
}) {
	const { boards, pgns, link } = useRoundLive(round, live);
	const focused = board ? boards.find((each) => each.id === board) : undefined;
	if (board && focused)
		return (
			<FocusedBoard
				key={board}
				tourId={tourId}
				round={round}
				board={focused}
				streamed={pgns[board] ?? null}
				boards={boards}
				link={link}
			/>
		);
	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
			<p
				className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ch-muted text-sm"
				data-testid="chaal-broadcast-round-state"
			>
				<span>
					{round.round.name} · {roundWhen(round.round)}
				</span>
				{link ? <LiveDot link={link} /> : null}
			</p>
			{board ? (
				<p className="text-ch-muted" data-testid="chaal-broadcast-board-missing">
					{m.ch_broadcast_board_missing()}
				</p>
			) : null}
			{boards.length === 0 ? (
				<p className="text-ch-muted">{m.ch_broadcast_no_boards()}</p>
			) : (
				<BoardsGrid tourId={tourId} roundId={round.round.id} boards={boards} />
			)}
		</div>
	);
}

/** The round's boards: a diagram each between its players, opening the board followed on its own. */
export function BoardsGrid({
	tourId,
	roundId,
	boards,
}: {
	tourId: string;
	roundId: string;
	boards: ReadonlyArray<BroadcastBoard>;
}) {
	const { preferences } = useChaalPreferences();
	return (
		<ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4" data-testid="chaal-broadcast-boards">
			{boards.map((board) => (
				<li key={board.id} data-testid="chaal-broadcast-board" data-board={board.id} data-fen={board.fen}>
					<Link
						{...chaalLinks.broadcast(tourId, { round: roundId, board: board.id })}
						className="group flex flex-col gap-1.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<BoardSide player={board.black} score={scoreOf(board.result, "black")} />
						<MiniBoard
							fen={board.fen}
							marks={squaresOfMove(board.lastMove)}
							theme={preferences.board}
							pieces={preferences.pieces}
							coordinates={false}
							label={m.ch_broadcast_board_label({ white: board.white.name, black: board.black.name })}
							className="w-full"
						/>
						<BoardSide player={board.white} score={scoreOf(board.result, "white")} />
					</Link>
				</li>
			))}
		</ul>
	);
}

/** A side's score as a crosstable writes it: 1, 0 or ½; null while the game is played. */
function scoreOf(result: BoardResult, side: Color): string | null {
	if (result === "*") return null;
	if (result === "½-½") return "½";
	return (result === "1-0") === (side === "white") ? "1" : "0";
}

function BoardSide({ player, score }: { player: BroadcastPlayer; score: string | null }) {
	return (
		<span className="flex min-w-0 items-baseline justify-between gap-2 text-sm">
			<span className="flex min-w-0 items-baseline gap-1.5">
				{player.title ? <span className="font-bold text-xs">{player.title}</span> : null}
				<span className="truncate font-medium group-hover:underline group-hover:underline-offset-4">{player.name}</span>
				{player.rating ? (
					<span className="ch-figures shrink-0 text-ch-muted text-xs">{formatNumber(player.rating)}</span>
				) : null}
			</span>
			{score !== null ? (
				<span className="ch-figures shrink-0 font-semibold">{score}</span>
			) : player.clock !== null ? (
				<span className="ch-figures shrink-0 text-ch-muted text-xs" dir="ltr">
					{formatClock(player.clock)}
				</span>
			) : null}
		</span>
	);
}

const GAME_RESULTS: Readonly<Record<Exclude<BoardResult, "*">, GameResult>> = {
	"1-0": "1-0",
	"0-1": "0-1",
	"½-½": "1/2-1/2",
};

/**
 * One board followed (`?board=`): the big board between the players with their clocks as
 * the PGN gives them, the moves with Lichess's evals as a graph, following each new move
 * from the round's stream unless the viewer has stepped back. The first paint is the board's
 * PGN from the server.
 */
export function FocusedBoard({
	tourId,
	round,
	board,
	streamed,
	boards,
	link,
}: {
	tourId: string;
	round: ChaalBroadcastRound;
	board: BroadcastBoard;
	streamed: string | null;
	boards: ReadonlyArray<BroadcastBoard>;
	link: LiveLink | null;
}) {
	const { preferences } = useChaalPreferences();
	const fetched = useQuery(broadcastGameQueryOptions(round.round.id, board.id));
	const pgn = streamed ?? fetched.data?.pgn ?? null;
	const game = pgn ? readBoard(pgn) : null;
	const line = game ? lineFrom(game.tree, game.tree.root) : [];
	const last = Math.max(0, line.length - 1);
	const [chosen, setChosen] = useState<number | null>(null);
	const ply = chosen === null ? last : Math.min(chosen, last);
	const [flipped, setFlipped] = useState(false);
	const orientation: Color = flipped ? "black" : "white";
	const node = line[ply];
	const fen = node?.fen ?? board.fen;
	const clocks = game ? clocksAfter(line.slice(1), ply) : { white: board.white.clock, black: board.black.clock };
	const result = game ? resultOf(game) : board.result;
	const scores = line.slice(1).map((each) => each.eval ?? null);
	const analysed = scores.some((score) => score !== null);
	const lichessUrl = lichessAddress(game?.tags.GameURL) ?? lichessAddress(game?.tags.Site) ?? round.round.url;

	const step = (to: Step) => {
		const target = to === "first" ? 0 : to === "prev" ? ply - 1 : to === "next" ? ply + 1 : last;
		const clamped = Math.max(0, Math.min(last, target));
		setChosen(clamped >= last ? null : clamped);
	};
	useBoardKeys({ onStep: step, onFlip: () => setFlipped((value) => !value) });
	const select = (id: string) => {
		const index = line.findIndex((each) => each.id === id);
		if (index >= 0) setChosen(index >= last ? null : index);
	};

	const strip = (side: Color) => {
		const player = board[side];
		const ms = clocks[side];
		return (
			<PlayerStrip
				name={player.name}
				color={side}
				title={player.title}
				rating={player.rating}
				note={player.fed ?? undefined}
				active={result === "*" && ply === last && (fen.split(" ")[1] === "b") === (side === "black")}
				material={<Material fen={fen} color={side} pieces={preferences.pieces} />}
				className={PLACE}
			>
				{ms !== null ? <Clock ms={ms} color={side} className="text-[2rem] sm:text-ch-clock" /> : null}
			</PlayerStrip>
		);
	};

	return (
		<div className={playGrid(false)} data-testid="chaal-broadcast-focus" data-board={board.id}>
			<div className={`${PLAY_COLUMN} lg:items-end`}>
				<div className={`${STRIP} land:row-start-1`}>{strip(opposite(orientation))}</div>
				<div className={`${PLACE} ${LAND_BOARD}`} data-testid="chaal-broadcast-focus-board" data-ply={ply}>
					{pgn || fetched.isError ? (
						<Board
							fen={fen}
							orientation={orientation}
							movable="none"
							lastMove={node?.uci && node.san ? { uci: node.uci, san: node.san } : null}
							coordinates={preferences.coordinates}
							theme={preferences.board}
							pieces={preferences.pieces}
							sound={preferences.sounds ? preferences.volume : false}
							label={m.ch_broadcast_focus_label({ white: board.white.name, black: board.black.name })}
						/>
					) : (
						<Skeleton className="aspect-square w-full rounded-none" />
					)}
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
					{game ? (
						<MoveList
							tree={game.tree}
							current={node?.id ?? game.tree.root}
							onSelect={select}
							layout="strip"
							notation={preferences.notation}
							className="lg:hidden"
						/>
					) : null}
				</div>
			</div>

			<div className="flex min-w-0 flex-col gap-4 px-4 pb-16 sm:px-0">
				<div className="ch-rule flex flex-col gap-1 pt-3">
					<p className="text-ch-muted text-sm">
						<Link
							{...chaalLinks.broadcast(tourId, { round: round.round.id })}
							className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
							data-testid="chaal-broadcast-all-boards"
						>
							<ArrowLeftIcon aria-hidden className="size-3.5" />
							{m.ch_broadcast_all_boards()}
						</Link>
					</p>
					<h2 className="ch-display text-ch-head">
						{board.white.name} – {board.black.name}
					</h2>
					<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ch-muted text-sm">
						<span>
							{round.tour.name} · {round.round.name}
						</span>
						{link && result === "*" ? <LiveDot link={link} /> : null}
					</p>
				</div>
				{result !== "*" ? (
					<ResultBanner result={GAME_RESULTS[result]} />
				) : chosen !== null ? (
					<Button type="button" size="sm" className="self-start" onClick={() => setChosen(null)}>
						{m.ch_spectate_back_to_live()}
					</Button>
				) : null}
				{fetched.isError && !streamed ? <p className="text-ch-muted text-sm">{errorMessage(fetched.error)}</p> : null}
				{analysed ? (
					<EvalGraph
						scores={scores}
						current={ply - 1}
						onSelect={(index) => {
							const target = Math.max(0, index + 1);
							setChosen(target >= last ? null : target);
						}}
					/>
				) : null}
				{game ? (
					<MoveList
						tree={game.tree}
						current={node?.id ?? game.tree.root}
						onSelect={select}
						layout="table"
						notation={preferences.notation}
						className="max-h-[24rem] max-lg:hidden"
					/>
				) : null}
				<div className="flex flex-wrap gap-2">
					{game ? (
						<Button asChild size="sm">
							<Link
								{...chaalLinks.analysis({
									moves:
										line
											.slice(1)
											.map((each) => each.uci)
											.join("_") || undefined,
								})}
							>
								<ChartSplineIcon aria-hidden />
								{m.ch_replay_analyse()}
							</Link>
						</Button>
					) : null}
					{pgn ? <CopyButton value={pgn} label={m.ch_export_copy_pgn()} showLabel /> : null}
					<Button asChild variant="outline" size="sm">
						<a href={lichessUrl} rel="noopener" target="_blank">
							<ExternalLinkIcon aria-hidden />
							{m.ch_game_on_lichess()}
							<span className="sr-only"> {m.ch_opens_new_tab()}</span>
						</a>
					</Button>
				</div>
				<OtherBoards tourId={tourId} roundId={round.round.id} boards={boards} current={board.id} />
			</div>
		</div>
	);
}

/** The round's other boards, as lines: the way to follow another. */
function OtherBoards({
	tourId,
	roundId,
	boards,
	current,
}: {
	tourId: string;
	roundId: string;
	boards: ReadonlyArray<BroadcastBoard>;
	current: string;
}) {
	const rest = boards.filter((board) => board.id !== current);
	if (rest.length === 0) return null;
	return (
		<section aria-labelledby="chaal-broadcast-others" className="flex flex-col gap-1">
			<h2 id="chaal-broadcast-others" className="font-semibold text-sm">
				{m.ch_broadcast_other_boards()}
			</h2>
			<ul className="flex max-h-[24rem] flex-col overflow-y-auto">
				{rest.map((board) => (
					<li key={board.id} className="ch-hairline">
						<Link
							{...chaalLinks.broadcast(tourId, { round: roundId, board: board.id })}
							className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-1.5 text-sm hover:bg-ch-plate"
						>
							<span className="flex min-w-0 flex-col">
								<span className="truncate">{board.white.name}</span>
								<span className="truncate">{board.black.name}</span>
							</span>
							<span className="ch-figures text-ch-muted text-xs">{board.result === "*" ? "*" : board.result}</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
