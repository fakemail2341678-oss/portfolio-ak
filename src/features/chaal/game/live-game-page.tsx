import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import {
	BanIcon,
	ChartSplineIcon,
	ExternalLinkIcon,
	FlagIcon,
	HandshakeIcon,
	RotateCcwIcon,
	SwordIcon,
	TrophyIcon,
	Undo2Icon,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionQueryOptions } from "@/features/auth/queries";
import { isAppError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { Board } from "../board/board";
import { Clock } from "../board/clock";
import { GameControls, type Step, useBoardKeys } from "../board/game-controls";
import { Material } from "../board/material";
import { MoveList } from "../board/move-list";
import { PlayerStrip } from "../board/player-strip";
import { ResultBanner } from "../board/result-banner";
import { formatTimeControl } from "../chess/clock";
import { type Color, opposite, START_FEN } from "../chess/rules";
import { canConnect, useConnectLichess } from "../connect/use-connect";
import { chaalLinks } from "../links";
import type { ChaalGamePlayer } from "../live/events";
import type { KeepOptions } from "../live/reader";
import { useLive } from "../live/store";
import { treeOf } from "../local/game";
import { paceKey } from "../play/controls";
import { liveGameQueryOptions, playCalls } from "../play/queries";
import type { ChaalLiveGame } from "../play/schema";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";
import { useChaalPreferences } from "../settings/use-preferences";
import { LAND_BOARD, LAND_SIDE, PLACE, PLAY_COLUMN, playGrid, STRIP, ZenExit } from "../shell/play-layout";
import { useZen } from "../shell/zen";
import { LiveChat } from "./live-chat";
import {
	againstAi,
	analysisLineOfLive,
	canAbort,
	canBerserk,
	canTakeBack,
	clockOf,
	endingOf,
	fenOf,
	isOver,
	type LiveGame,
	liveGameOf,
	offersOf,
	opponentOf,
	shownMoves,
	turnIn,
} from "./live-game";
import { type LiveCalls, type LiveGameView, useLiveGame } from "./use-live-game";

const route = getRouteApi("/_chaal/app/chaal/game/$id");

/** The Lichess page of a game, for every state of this one. */
export const lichessGameUrl = (id: string) => `https://lichess.org/${id}`;

/**
 * /app/chaal/game/$id (PLAN Task 77; noindex): a game the player plays on Lichess. The
 * loader read its first state with the player's token, so it renders on the server; its
 * stream keeps it live after that. Every other case is said where the board would be:
 * not signed in or not connected (connect), online play off, not one of the player's games
 * (a link to Lichess), or Lichess unreachable.
 */
export function ChaalLiveGamePage() {
	const { id } = route.useParams();
	const { data: session } = useQuery(sessionQueryOptions());
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { data: connection } = useQuery({ ...chaalConnectionQueryOptions(), enabled: Boolean(session) });
	const connected = Boolean(connection && !connection.revoked && !connection.needsScopesFor.includes("play"));
	const off = status?.features.play === false;
	const game = useQuery({ ...liveGameQueryOptions(id), enabled: Boolean(session) && connected && !off });

	let body: ReactNode;
	if (off) body = <Said testId="chaal-game-off" title={m.ch_online_off_title()} text={m.ch_online_off_body()} />;
	else if (!session || !connected) body = <ConnectHere id={id} />;
	else if (game.data) return <LiveGameBoard key={id} initial={game.data} />;
	else if (game.isError) {
		const missing = isAppError(game.error) && game.error.code === "NOT_FOUND";
		body = missing ? (
			<Said testId="chaal-game-missing" title={m.ch_game_missing_title()} text={m.ch_game_missing_body()}>
				<LichessLink id={id} />
			</Said>
		) : (
			<Said testId="chaal-game-error" title={m.ch_game_error_title()} text={errorMessage(game.error)}>
				<Button type="button" onClick={() => void game.refetch()}>
					{m.error_retry()}
				</Button>
			</Said>
		);
	} else body = <BoardPlace busy />;

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-game">
			<h1 className="sr-only">{m.ch_game_title()}</h1>
			{body}
		</main>
	);
}

/** The board's place: the same grid and square as the game, so nothing moves when it arrives. */
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

/** Something said in the board's place: a title, a line, and what to do. */
function Said({
	title,
	text,
	children,
	testId,
}: {
	title: string;
	text: string;
	children?: ReactNode;
	testId: string;
}) {
	return (
		<BoardPlace>
			<div
				className={`ch-frame flex aspect-square flex-col items-start justify-center gap-4 bg-ch-plate p-6 sm:p-10 ${PLACE}`}
				data-testid={testId}
			>
				<p className="ch-display text-ch-head">{title}</p>
				<p className="max-w-prose text-ch-muted">{text}</p>
				<div className="flex flex-wrap gap-2">
					{children}
					<Button asChild variant="outline">
						<Link {...chaalLinks.play()}>{m.ch_local_to_play()}</Link>
					</Button>
				</div>
			</div>
		</BoardPlace>
	);
}

function LichessLink({ id }: { id: string }) {
	return (
		<Button asChild variant="outline">
			<a href={lichessGameUrl(id)} rel="noopener" target="_blank">
				<ExternalLinkIcon aria-hidden />
				{m.ch_game_on_lichess()}
			</a>
		</Button>
	);
}

/** Not signed in, or Lichess not connected for play: connect (or reconnect) here. */
function ConnectHere({ id }: { id: string }) {
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { connect, pending } = useConnectLichess();
	return (
		<Said testId="chaal-game-connect" title={m.ch_game_connect_title()} text={m.ch_game_connect_body()}>
			{canConnect(status) ? (
				<Button type="button" onClick={() => void connect()} disabled={pending}>
					{m.ch_connect()}
				</Button>
			) : null}
			<LichessLink id={id} />
		</Said>
	);
}

/** A player's name as the strip shows it: the Lichess AI by its level. */
export const playerLabel = (player: ChaalGamePlayer) =>
	player.aiLevel !== null ? m.ch_live_ai_name({ level: String(player.aiLevel) }) : player.name;

/** "Rated · 10+5 · Rapid", or "Casual · 3 days a move". */
export function paceLabel(full: LiveGame["full"]): string {
	const parts: string[] = [full.rated ? m.ch_online_rated() : m.ch_online_casual()];
	if (full.clock)
		parts.push(formatTimeControl({ initial: full.clock.initial / 1000, increment: full.clock.increment / 1000 }));
	else if (full.daysPerTurn) parts.push(m.ch_online_days({ days: String(full.daysPerTurn) }));
	return parts.join(" · ");
}

/** The game itself: the board between the players, the actions, offers, the moves, the chat, and the ending. */
export function LiveGameBoard({
	initial,
	calls = playCalls,
	stream,
}: {
	initial: ChaalLiveGame;
	/** Stories and tests pass their own calls and stream. */
	calls?: LiveCalls & Pick<typeof playCalls, "challengeAi">;
	stream?: (url: string, options: KeepOptions) => { stop: () => void };
}) {
	const [start] = useState(() =>
		liveGameOf(initial.game, initial.color, typeof performance === "undefined" ? 0 : performance.now()),
	);
	const view = useLiveGame({ initial: start, calls, ...(stream ? { stream } : {}) });
	const { game } = view;
	const { preferences } = useChaalPreferences();
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const live = useLive();
	const confirm = useConfirm();
	const [flipped, setFlipped] = useState(false);
	const [viewing, setViewing] = useState<number | null>(null);

	const moves = shownMoves(game);
	const last = moves.length;
	const shownPly = viewing === null ? last : Math.min(viewing, last);
	const following = shownPly === last;
	const shownFen = shownPly === 0 ? game.startFen : (moves[shownPly - 1]?.fen ?? fenOf(game));
	const shownMove = shownPly > 0 ? moves[shownPly - 1] : null;
	const over = isOver(game.state.status);
	const turn = turnIn(game);
	const orientation: Color = flipped ? opposite(game.color) : game.color;
	const clock = clockOf(game);
	const ending = endingOf(game.state);
	const opponent = opponentOf(game);
	const ai = againstAi(game);
	const offers = offersOf(game);
	const { zen: zenOn, toggle: toggleZen } = useZen();
	// The game over asks for a choice (Analyse, Play again): zen gives the page back then.
	const zen = zenOn && !over;

	// Node ids in a line are its plies ("0" the start), as the local games' (local/game.ts).
	const tree = treeOf({ startFen: game.startFen, moves });
	const select = (id: string) => setViewing(Number(id) >= last ? null : Number(id));

	const step = (to: Step) => {
		const target = to === "first" ? 0 : to === "prev" ? shownPly - 1 : to === "next" ? shownPly + 1 : last;
		const clamped = Math.max(0, Math.min(last, target));
		setViewing(clamped === last ? null : clamped);
	};
	useBoardKeys({ onStep: step, onFlip: () => setFlipped((value) => !value) });

	const resign = async () => {
		const sure = await confirm({
			title: m.ch_local_resign_title(),
			description: m.ch_local_resign_you(),
			confirmLabel: m.ch_local_resign(),
			destructive: true,
		});
		if (sure) await view.act("resign");
	};

	const strip = (side: Color) => {
		const player = game.full[side];
		const diff =
			side === game.color ? myRatingDiff(game, live.finished[game.full.id]?.ratingDiff ?? null) : player.ratingDiff;
		return (
			<PlayerStrip
				name={playerLabel(player)}
				color={side}
				title={player.title}
				rating={player.rating}
				provisional={player.provisional}
				href={player.id ? `https://lichess.org/@/${player.id}` : undefined}
				active={!over && turn === side}
				note={stripNote(game, side, diff)}
				material={<Material fen={shownFen} color={side} pieces={preferences.pieces} />}
				className={PLACE}
			>
				{clock ? (
					<Clock
						ms={clock[side]}
						color={side}
						running={clock.running === side}
						since={clock.since}
						className="text-[2rem] sm:text-ch-clock"
					/>
				) : null}
			</PlayerStrip>
		);
	};

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-game">
			<h1 className="sr-only">
				{m.ch_game_title()}: {playerLabel(opponent)}
			</h1>
			<ReconnectBanner view={view} />
			{zen ? <ZenExit onExit={toggleZen} /> : null}
			<div className={playGrid(zen)}>
				<div className={`${PLAY_COLUMN} ${zen ? "lg:items-center" : "lg:items-end"}`}>
					<div className={`${STRIP} land:row-start-1`} data-testid="chaal-game-top">
						{strip(opposite(orientation))}
					</div>
					<div className={`${PLACE} ${LAND_BOARD}`} data-testid="chaal-game-board">
						<Board
							fen={shownFen}
							orientation={orientation}
							movable={following && !over ? game.color : "none"}
							lastMove={shownMove ? { uci: shownMove.uci, san: shownMove.san } : null}
							onMove={view.move}
							premove={view.premove}
							onPremove={preferences.premove ? view.setPremove : undefined}
							autoQueen={preferences.autoQueen}
							coordinates={preferences.coordinates}
							theme={preferences.board}
							pieces={preferences.pieces}
							sound={preferences.sounds ? preferences.volume : false}
							label={m.ch_live_board_label()}
						/>
					</div>
					<div className={`${STRIP} land:row-start-2`} data-testid="chaal-game-bottom">
						{strip(orientation)}
					</div>
					<div
						className={`flex w-full flex-col gap-2 px-4 sm:px-0 lg:max-w-[calc(100dvh-15rem)] ${LAND_SIDE} land:row-start-3`}
					>
						{zen ? null : (
							<GameControls
								onStep={step}
								canBack={shownPly > 0}
								canForward={!following}
								onFlip={() => setFlipped((value) => !value)}
							>
								{over ? null : (
									<GameActions
										game={game}
										ai={ai}
										onAct={(action) => void view.act(action)}
										onResign={() => void resign()}
									/>
								)}
							</GameControls>
						)}
						{!zen && canBerserk(game) && !view.berserked ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => void view.berserk()}
								className="self-start"
								data-testid="chaal-game-berserk"
							>
								<SwordIcon aria-hidden />
								{m.ch_live_berserk()}
							</Button>
						) : null}
						{/* What asks for an answer sits within reach, under the controls, on a phone too. */}
						{!over ? <Offers game={game} offers={offers} onAct={(action) => void view.act(action)} /> : null}
						{!over && game.gone ? <OpponentGone game={game} onAct={(action) => void view.act(action)} /> : null}
						{zen ? null : (
							<MoveList
								tree={tree}
								current={String(shownPly)}
								onSelect={select}
								layout="strip"
								notation={preferences.notation}
								className="lg:hidden"
							/>
						)}
					</div>
				</div>

				<div className={`flex min-w-0 flex-col gap-4 px-4 sm:px-0 ${zen ? "hidden" : ""}`}>
					<div className="ch-rule flex flex-col gap-1 pt-3">
						<p className="ch-display text-ch-head">{playerLabel(opponent)}</p>
						<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ch-muted text-sm">
							<span>{paceLabel(game.full)}</span>
							<LinkDot link={view.link} />
							<a
								href={lichessGameUrl(game.full.id)}
								rel="noopener"
								target="_blank"
								className="underline-offset-4 hover:underline"
							>
								{m.ch_game_on_lichess()}
							</a>
						</p>
					</div>
					{over ? null : <GameStatus game={game} />}
					{over && ending ? (
						<GameOver
							game={game}
							calls={calls}
							ratingDiff={myRatingDiff(game, live.finished[game.full.id]?.ratingDiff ?? null)}
						/>
					) : null}
					<MoveList
						tree={tree}
						current={String(shownPly)}
						onSelect={select}
						layout="table"
						notation={preferences.notation}
						className="max-h-[24rem] max-lg:hidden"
					/>
					{!ai && status?.features.chat !== false ? (
						<LiveChat id={game.full.id} lines={game.chat} onSend={view.sendChat} disabled={over} />
					) : null}
				</div>
			</div>
		</main>
	);
}

function myRatingDiff(game: LiveGame, fromEvents: number | null): number | null {
	return fromEvents ?? game.full[game.color].ratingDiff;
}

function stripNote(game: LiveGame, side: Color, diff: number | null): string | undefined {
	if (isOver(game.state.status)) return diff === null ? undefined : diff >= 0 ? `+${diff}` : String(diff);
	if (side === game.color && turnIn(game) === side && !game.pending) return m.ch_local_your_move();
	if (side !== game.color && againstAi(game) && turnIn(game) === side) return m.ch_local_thinking();
	return undefined;
}

/** The stream's state as a small dot: ink when live, hollow while reconnecting. */
function LinkDot({ link }: { link: LiveGameView["link"] }) {
	const live = link === "open";
	return (
		<span className="inline-flex items-center gap-1.5" data-testid="chaal-game-link" data-link={link}>
			<span
				aria-hidden
				className={`inline-block size-2 rounded-full border border-ch-ink ${live ? "bg-ch-ink" : "bg-transparent"}`}
			/>
			{live ? m.ch_live_link_open() : link === "refused" ? m.ch_live_link_refused() : m.ch_live_link_connecting()}
		</span>
	);
}

/** After 3 s without the game's stream (PLAN 13.6, "Instant"): a quiet line under the top bar. */
function ReconnectBanner({ view }: { view: LiveGameView }) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (view.downSince === null) return;
		const timer = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(timer);
	}, [view.downSince]);
	const show = view.downSince !== null && view.link !== "refused" && now - view.downSince >= 3_000;
	return (
		<div aria-live="polite" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
			{show ? (
				<p className="ch-hairline py-2 text-ch-muted text-sm" data-testid="chaal-game-reconnecting">
					{m.ch_live_reconnecting()}
				</p>
			) : null}
		</div>
	);
}

/** What the game waits for: the player's first move before it's aborted, or nothing. */
function GameStatus({ game }: { game: LiveGame }) {
	const [now, setNow] = useState<number | null>(null);
	const expiration = game.state.expiration;
	useEffect(() => {
		if (!expiration) return;
		setNow(performance.now());
		const timer = setInterval(() => setNow(performance.now()), 500);
		return () => clearInterval(timer);
	}, [expiration]);
	let text: string | null = null;
	if (expiration && game.moves.length < 2 && now !== null) {
		const left = Math.max(0, expiration.millisToMove - expiration.idleMillis - (now - game.receivedAt));
		const side = turnIn(game);
		text =
			side === game.color
				? m.ch_live_first_move_you({ seconds: String(Math.ceil(left / 1000)) })
				: m.ch_live_first_move_them({ seconds: String(Math.ceil(left / 1000)) });
	}
	return (
		<p className="min-h-5 text-ch-muted text-sm" aria-live="polite" data-testid="chaal-game-status">
			{text}
		</p>
	);
}

/** The game's own actions beside the step buttons: abort or resign, a draw, a takeback. */
function GameActions({
	game,
	ai,
	onAct,
	onResign,
}: {
	game: LiveGame;
	ai: boolean;
	onAct: (action: "abort" | "draw-offer" | "takeback-offer") => void;
	onResign: () => void;
}) {
	const offers = offersOf(game);
	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={() => onAct("takeback-offer")}
				disabled={!canTakeBack(game) || offers.myTakeback}
				aria-label={m.ch_live_takeback()}
				title={m.ch_live_takeback()}
				className="ch-press"
				data-testid="chaal-game-takeback"
			>
				<Undo2Icon aria-hidden />
			</Button>
			{ai ? null : (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => onAct("draw-offer")}
					disabled={offers.myDraw || game.moves.length < 2}
					aria-label={m.ch_live_offer_draw()}
					title={m.ch_live_offer_draw()}
					className="ch-press"
					data-testid="chaal-game-draw"
				>
					<HandshakeIcon aria-hidden />
				</Button>
			)}
			{canAbort(game) ? (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => onAct("abort")}
					aria-label={m.ch_live_abort()}
					title={m.ch_live_abort()}
					className="ch-press"
					data-testid="chaal-game-abort"
				>
					<BanIcon aria-hidden />
				</Button>
			) : (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={onResign}
					aria-label={m.ch_local_resign()}
					title={m.ch_local_resign()}
					className="ch-press"
					data-testid="chaal-game-resign"
				>
					<FlagIcon aria-hidden />
				</Button>
			)}
		</>
	);
}

/** The opponent's offers to answer, and the player's own waiting. */
function Offers({
	game,
	offers,
	onAct,
}: {
	game: LiveGame;
	offers: ReturnType<typeof offersOf>;
	onAct: (action: "draw-offer" | "draw-decline" | "takeback-offer" | "takeback-decline") => void;
}) {
	const name = playerLabel(opponentOf(game));
	const ask = (
		text: string,
		yes: "draw-offer" | "takeback-offer",
		no: "draw-decline" | "takeback-decline",
		testId: string,
	) => (
		<div className="ch-hairline flex flex-col gap-2 py-3" aria-live="polite" data-testid={testId}>
			<p className="font-semibold">{text}</p>
			<div className="flex gap-2">
				<Button type="button" size="sm" onClick={() => onAct(yes)} data-testid={`${testId}-accept`}>
					{m.ch_live_accept()}
				</Button>
				<Button type="button" size="sm" variant="outline" onClick={() => onAct(no)} data-testid={`${testId}-decline`}>
					{m.ch_live_decline()}
				</Button>
			</div>
		</div>
	);
	return (
		<div className="flex flex-col">
			{offers.draw
				? ask(m.ch_live_draw_offered({ name }), "draw-offer", "draw-decline", "chaal-game-draw-offer")
				: null}
			{offers.takeback
				? ask(m.ch_live_takeback_asked({ name }), "takeback-offer", "takeback-decline", "chaal-game-takeback-offer")
				: null}
			{offers.myDraw || offers.myTakeback ? (
				<output className="block text-ch-muted text-sm" data-testid="chaal-game-my-offer">
					{offers.myDraw ? m.ch_live_my_draw() : m.ch_live_my_takeback()}
				</output>
			) : null}
		</div>
	);
}

/** The opponent left: a countdown, then the claims. */
function OpponentGone({ game, onAct }: { game: LiveGame; onAct: (action: "claim-victory" | "claim-draw") => void }) {
	const [now, setNow] = useState(() => (typeof performance === "undefined" ? 0 : performance.now()));
	useEffect(() => {
		const timer = setInterval(() => setNow(performance.now()), 500);
		return () => clearInterval(timer);
	}, []);
	if (!game.gone) return null;
	const left = Math.max(0, Math.ceil((game.gone.claimAt - now) / 1000));
	const name = playerLabel(opponentOf(game));
	return (
		<div className="ch-hairline flex flex-col gap-2 py-3" aria-live="polite" data-testid="chaal-game-gone">
			<p className="font-semibold">
				{left > 0 ? m.ch_live_gone_wait({ name, seconds: String(left) }) : m.ch_live_gone_claim({ name })}
			</p>
			{left === 0 ? (
				<div className="flex gap-2">
					<Button type="button" size="sm" onClick={() => onAct("claim-victory")} data-testid="chaal-game-claim-victory">
						<TrophyIcon aria-hidden />
						{m.ch_live_claim_victory()}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => onAct("claim-draw")}
						data-testid="chaal-game-claim-draw"
					>
						{m.ch_live_claim_draw()}
					</Button>
				</div>
			) : null}
		</div>
	);
}

/** The game is over: the result, the rating change, Analyse, and the same game again. */
function GameOver({
	game,
	calls,
	ratingDiff,
}: {
	game: LiveGame;
	calls: Pick<typeof playCalls, "challengeAi">;
	ratingDiff: number | null;
}) {
	const navigate = useNavigate();
	const [starting, setStarting] = useState(false);
	const ending = endingOf(game.state);
	if (!ending) return null;
	const opponent = opponentOf(game);
	const pace = paceOfGame(game);
	const again = async () => {
		if (opponent.aiLevel === null || !pace) return;
		setStarting(true);
		try {
			const started = await calls.challengeAi({ level: opponent.aiLevel, pace, color: game.color });
			await navigate(chaalLinks.game(started.id));
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setStarting(false);
		}
	};
	const analysis = chaalLinks.analysis({
		moves: analysisLineOfLive(game),
		...(game.startFen !== START_FEN ? { fen: game.startFen } : {}),
	});
	return (
		<div className="flex flex-col gap-3" data-testid="chaal-game-over">
			{ending.aborted || !ending.result ? (
				<output className="ch-rule block py-3 font-semibold" data-testid="chaal-result">
					{m.ch_live_aborted()}
				</output>
			) : (
				<ResultBanner result={ending.result} reason={ending.reason ?? undefined} />
			)}
			{ratingDiff !== null && game.full.rated ? (
				<p className="text-sm" data-testid="chaal-game-rating">
					{m.ch_live_rating_change({ change: ratingDiff >= 0 ? `+${ratingDiff}` : String(ratingDiff) })}
				</p>
			) : null}
			<div className="flex flex-wrap gap-2">
				{game.moves.length > 0 ? (
					<Button asChild data-testid="chaal-game-analyse">
						<Link {...analysis}>
							<ChartSplineIcon aria-hidden />
							{m.ch_local_analyse()}
						</Link>
					</Button>
				) : null}
				{opponent.aiLevel !== null && pace ? (
					<Button
						type="button"
						variant="outline"
						onClick={() => void again()}
						disabled={starting}
						data-testid="chaal-game-again"
					>
						<RotateCcwIcon aria-hidden />
						{m.ch_live_again()}
					</Button>
				) : opponent.id && pace ? (
					<Button asChild variant="outline" data-testid="chaal-game-again">
						<Link
							{...chaalLinks.play({
								with: "friend",
								opponent: opponent.name,
								pace: paceKey(pace),
								color: game.color,
								rated: game.full.rated,
							})}
						>
							<RotateCcwIcon aria-hidden />
							{m.ch_live_again()}
						</Link>
					</Button>
				) : null}
			</div>
		</div>
	);
}

/** The game's pace again, as a new challenge asks for it. */
function paceOfGame(game: LiveGame) {
	const { clock, daysPerTurn } = game.full;
	if (clock)
		return { kind: "clock" as const, clock: { initial: clock.initial / 1000, increment: clock.increment / 1000 } };
	if (daysPerTurn && [1, 2, 3, 5, 7, 10, 14].includes(daysPerTurn))
		return { kind: "days" as const, days: daysPerTurn as 1 | 2 | 3 | 5 | 7 | 10 | 14 };
	return null;
}
