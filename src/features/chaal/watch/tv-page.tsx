import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { MiniBoard } from "../board/mini-board";
import { formatClock } from "../chess/clock";
import { chaalLinks } from "../links";
import type { ChaalColor } from "../live/events";
import { gameKind } from "../players/labels";
import { chaalStatusQueryOptions } from "../queries";
import { useChaalPreferences } from "../settings/use-preferences";
import { CHANNEL_NAMES } from "./labels";
import { applyTvLine, sideToMove, squaresOfMove, type TvPlayer, type TvState, tvFeedUrl, tvStateOf } from "./live";
import { broadcastsQueryOptions, streamersQueryOptions, tvQueryOptions } from "./queries";
import type { BroadcastTourSummary, ChaalStreamer, ChaalTvGame } from "./schema";
import { useOnScreen, usePageVisible, usePublicStream } from "./use-live";
import { WatchHeader, WatchOff } from "./watch-header";

/**
 * /app/chaal/watch (Task 82, decision 0272; indexable): Lichess's TV, a diagram per channel,
 * drawn on the server from the games' last positions, then live from each channel's feed,
 * which the browser reads from Lichess while the card is on screen. Beside it, what's being
 * broadcast now and the streamers live (links out).
 */
export function ChaalWatchPage() {
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const tv = useQuery(tvQueryOptions());
	const off = status?.features.watch === false;

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-watch">
			<div className="mx-auto grid w-full max-w-7xl gap-x-12 gap-y-8 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-8 lg:pt-12">
				<div className="flex min-w-0 flex-col gap-6">
					<WatchHeader current="tv" title={m.ch_watch_title()} intro={m.ch_watch_intro()} />
					{off ? (
						<WatchOff />
					) : tv.data ? (
						tv.data.games.length === 0 ? (
							<p className="text-ch-muted">{m.ch_watch_tv_empty()}</p>
						) : (
							<TvGrid games={tv.data.games} live={status?.live ?? null} />
						)
					) : tv.isError ? (
						<div className="flex flex-col items-start gap-3" data-testid="chaal-watch-error">
							<p className="text-ch-muted">{errorMessage(tv.error)}</p>
							<Button type="button" variant="outline" onClick={() => void tv.refetch()}>
								{m.error_retry()}
							</Button>
						</div>
					) : (
						<Skeleton className="aspect-[4/3] w-full rounded-none" />
					)}
				</div>
				{off ? null : (
					<aside className="flex flex-col gap-8">
						<BroadcastsNow />
						{status?.watch.streamers === false ? null : <Streamers />}
					</aside>
				)}
			</div>
		</main>
	);
}

/** The channels' games, two to a row on a phone, four on a laptop. */
export function TvGrid({ games, live }: { games: ReadonlyArray<ChaalTvGame>; live: string | null }) {
	return (
		<ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4" data-testid="chaal-tv-grid">
			{games.map((game) => (
				<TvCard key={game.channel} game={game} live={live} />
			))}
		</ul>
	);
}

/** "Rated · Blitz · 3+2": a TV game is never correspondence. */
export const tvKind = (game: ChaalTvGame) => gameKind({ ...game, daysPerTurn: null });

/** A player's name as the TV shows it: the Lichess AI by its level. */
export const tvName = (player: TvPlayer) =>
	player.aiLevel !== null ? m.ch_live_ai_name({ level: String(player.aiLevel) }) : player.name;

/** One channel: its name and pace, the players with their clocks, and the game's diagram. The card opens the channel. */
function TvCard({ game, live }: { game: ChaalTvGame; live: string | null }) {
	const { preferences } = useChaalPreferences();
	const ref = useRef<HTMLLIElement>(null);
	const onScreen = useOnScreen(ref);
	const visible = usePageVisible();
	const [state, setState] = useState<TvState>(() => tvStateOf(game));
	usePublicStream(live && onScreen && visible ? tvFeedUrl(live, game.channel) : null, (value) =>
		setState((current) => applyTvLine(current, value, performance.now()) ?? current),
	);
	const bottom = state.orientation;
	const top: ChaalColor = bottom === "white" ? "black" : "white";
	const turn = state.fen ? sideToMove(state.fen) : null;
	const channel = CHANNEL_NAMES[game.channel]();
	return (
		<li
			ref={ref}
			data-testid="chaal-tv-card"
			data-channel={game.channel}
			data-game={state.id}
			data-fen={state.fen ?? undefined}
		>
			<Link
				{...chaalLinks.channel(game.channel)}
				className="group flex flex-col gap-1.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				<span className="ch-rule flex min-w-0 flex-col pt-2">
					<span className="truncate font-semibold group-hover:underline group-hover:underline-offset-4">{channel}</span>
					<span className="truncate text-ch-muted text-xs">{tvKind(game)}</span>
				</span>
				<SideLine player={state[top]} clock={state.clocks?.[top]} at={state.at} running={turn === top} />
				{state.fen ? (
					<MiniBoard
						fen={state.fen}
						orientation={bottom}
						marks={squaresOfMove(state.lastMove)}
						theme={preferences.board}
						pieces={preferences.pieces}
						coordinates={false}
						label={m.ch_tv_card_label({ channel, white: tvName(state.white), black: tvName(state.black) })}
						className="w-full"
					/>
				) : (
					<Skeleton className="aspect-square w-full rounded-none" />
				)}
				<SideLine player={state[bottom]} clock={state.clocks?.[bottom]} at={state.at} running={turn === bottom} />
			</Link>
		</li>
	);
}

function SideLine({
	player,
	clock,
	at,
	running,
}: {
	player: TvPlayer;
	clock: number | undefined;
	at: number;
	running: boolean;
}) {
	return (
		<span className="flex min-w-0 items-baseline justify-between gap-2 text-sm">
			<span className="flex min-w-0 items-baseline gap-1.5">
				{player.title ? <span className="font-bold text-xs">{player.title}</span> : null}
				<span className="truncate font-medium">{tvName(player)}</span>
				{player.rating ? (
					<span className="ch-figures shrink-0 text-ch-muted text-xs">{formatNumber(player.rating)}</span>
				) : null}
			</span>
			{clock === undefined ? null : <TimeLeft seconds={clock} at={at} running={running} />}
		</span>
	);
}

/** A clock in a list: small figures, counting down on the side to move. Its time is in the strip's text, so it's read once. */
export function TimeLeft({ seconds, at, running }: { seconds: number; at: number; running: boolean }) {
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		if (!running) {
			setNow(null);
			return;
		}
		setNow(performance.now());
		const timer = setInterval(() => setNow(performance.now()), 1_000);
		return () => clearInterval(timer);
	}, [running]);
	const ms = Math.max(0, seconds * 1_000 - (running && now !== null ? now - at : 0));
	return (
		<span
			className={`ch-figures shrink-0 text-xs ${running ? "font-semibold text-ch-ink" : "text-ch-muted"}`}
			dir="ltr"
		>
			{formatClock(ms)}
		</span>
	);
}

/** What's broadcast now, beside the TV: the first few live broadcasts, and the way to all of them. */
function BroadcastsNow() {
	const list = useQuery(broadcastsQueryOptions(1));
	const live = list.data?.active.filter((each) => each.round?.state === "ongoing").slice(0, 5) ?? [];
	return (
		<section
			aria-labelledby="chaal-watch-broadcasts"
			className="flex flex-col gap-2"
			data-testid="chaal-watch-broadcasts"
		>
			<h2 id="chaal-watch-broadcasts" className="ch-rule pt-3 font-semibold">
				{m.ch_watch_broadcasts_now()}
			</h2>
			{list.data ? (
				live.length === 0 ? (
					<p className="text-ch-muted text-sm">{m.ch_watch_broadcasts_none()}</p>
				) : (
					<ul className="flex flex-col">
						{live.map((tour) => (
							<BroadcastLine key={tour.id} tour={tour} />
						))}
					</ul>
				)
			) : list.isError ? (
				<p className="text-ch-muted text-sm">{errorMessage(list.error)}</p>
			) : (
				<Skeleton className="h-40 w-full rounded-none" />
			)}
			<Link {...chaalLinks.broadcasts()} className="self-start text-sm underline underline-offset-4">
				{m.ch_watch_broadcasts_all()}
			</Link>
		</section>
	);
}

function BroadcastLine({ tour }: { tour: BroadcastTourSummary }) {
	return (
		<li className="ch-hairline py-2 text-sm">
			<Link
				{...chaalLinks.broadcast(tour.id, tour.round ? { round: tour.round.id } : {})}
				className="flex flex-col gap-0.5 underline-offset-4 hover:underline"
			>
				<span className="font-medium">{tour.name}</span>
				{tour.round ? <span className="text-ch-muted text-xs">{tour.round.name}</span> : null}
			</Link>
		</li>
	);
}

/** The streamers live now on Lichess: each opens their stream (Twitch or YouTube) in a new tab. */
function Streamers() {
	const list = useQuery(streamersQueryOptions());
	return (
		<section
			aria-labelledby="chaal-watch-streamers"
			className="flex flex-col gap-2"
			data-testid="chaal-watch-streamers"
		>
			<h2 id="chaal-watch-streamers" className="ch-rule pt-3 font-semibold">
				{m.ch_watch_streamers()}
			</h2>
			{list.data ? (
				list.data.length === 0 ? (
					<p className="text-ch-muted text-sm">{m.ch_watch_streamers_none()}</p>
				) : (
					<StreamerList streamers={list.data.slice(0, 8)} />
				)
			) : list.isError ? (
				<p className="text-ch-muted text-sm">{errorMessage(list.error)}</p>
			) : (
				<Skeleton className="h-48 w-full rounded-none" />
			)}
		</section>
	);
}

const SERVICES: Readonly<Record<ChaalStreamer["service"], string>> = { twitch: "Twitch", youtube: "YouTube" };

export function StreamerList({ streamers }: { streamers: ReadonlyArray<ChaalStreamer> }) {
	return (
		<ul className="flex flex-col">
			{streamers.map((streamer) => (
				<li key={streamer.id} className="ch-hairline py-2 text-sm">
					<a
						href={streamer.url}
						rel="nofollow ugc noopener"
						target="_blank"
						className="flex flex-col gap-0.5 underline-offset-4 hover:underline"
						data-testid="chaal-streamer"
					>
						<span className="flex min-w-0 items-baseline gap-1.5">
							{streamer.title ? <span className="font-bold text-xs">{streamer.title}</span> : null}
							<span className="truncate font-medium">{streamer.name}</span>
							<ExternalLinkIcon aria-hidden className="size-3 shrink-0 text-ch-muted" />
						</span>
						{streamer.status ? <span className="line-clamp-2 text-ch-muted text-xs">{streamer.status}</span> : null}
						<span className="text-ch-muted text-xs">
							{SERVICES[streamer.service]}
							{streamer.lang ? ` · ${streamer.lang.toUpperCase()}` : ""}
							<span className="sr-only"> {m.ch_opens_new_tab()}</span>
						</span>
					</a>
				</li>
			))}
		</ul>
	);
}
