import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ExternalLinkIcon, EyeIcon, FlipVerticalIcon } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";
import { Board } from "../board/board";
import { Clock } from "../board/clock";
import { MiniBoard } from "../board/mini-board";
import { PlayerStrip } from "../board/player-strip";
import { type Color, opposite, play } from "../chess/rules";
import { lichessGameUrl } from "../game/lichess-links";
import { chaalLinks } from "../links";
import { chaalStatusQueryOptions } from "../queries";
import { useChaalPreferences } from "../settings/use-preferences";
import { LAND_BOARD, LAND_SIDE, PLACE, PLAY_COLUMN, playGrid, STRIP } from "../shell/play-layout";
import { CHANNEL_NAMES } from "./labels";
import type { TvChannel } from "./limits";
import { applyTvLine, sideToMove, squaresOfMove, type TvPlayer, type TvState, tvFeedUrl, tvStateOf } from "./live";
import { tvQueryOptions } from "./queries";
import type { ChaalTvGame } from "./schema";
import { tvKind, tvName } from "./tv-page";
import { usePageVisible, usePublicStream } from "./use-live";
import { ClockPlace, LiveDot, WatchOff } from "./watch-header";

const route = getRouteApi("/_chaal/app/chaal/watch/$channel");

/**
 * /app/chaal/watch/$channel (Task 82, decision 0272; noindex): one TV channel on the big
 * board, live from its feed, moving on by itself when the channel does. Beside it the game's
 * kind, following the game itself (its moves, from the game's page), lichess.org, and the
 * other channels.
 */
export function ChaalChannelPage() {
	const { channel } = route.useParams();
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const tv = useQuery(tvQueryOptions());
	const off = status?.features.watch === false;
	const game = tv.data?.games.find((each) => each.channel === channel);

	if (game && !off)
		return <ChannelBoard key={channel} game={game} others={tv.data?.games ?? []} live={status?.live ?? null} />;
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-channel">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-12">
				<h1 className="ch-display text-ch-title">
					{m.ch_tv_channel_title({ channel: CHANNEL_NAMES[channel as TvChannel]() })}
				</h1>
				{off ? (
					<WatchOff />
				) : tv.isError ? (
					<div className="flex flex-col items-start gap-3" data-testid="chaal-watch-error">
						<p className="text-ch-muted">{errorMessage(tv.error)}</p>
						<Button type="button" variant="outline" onClick={() => void tv.refetch()}>
							{m.error_retry()}
						</Button>
					</div>
				) : tv.data ? (
					<>
						<p className="text-ch-muted" data-testid="chaal-channel-empty">
							{m.ch_tv_channel_empty()}
						</p>
						<OtherChannels games={tv.data.games} current={channel as TvChannel} />
					</>
				) : (
					<Skeleton className="aspect-square w-full max-w-xl rounded-none" />
				)}
			</div>
		</main>
	);
}

type ChannelView = TvState & { san: string | undefined };

/** A feed line applied, with the move's SAN when it follows the position shown (for the board's words and sound). */
function next(current: ChannelView, value: unknown, at: number): ChannelView {
	const applied = applyTvLine(current, value, at);
	if (!applied || applied === current) return current;
	const continues = applied.id === current.id && applied.lastMove && current.fen;
	const san = continues && current.fen && applied.lastMove ? play(current.fen, applied.lastMove)?.san : undefined;
	return { ...applied, san };
}

function ChannelBoard({
	game,
	others,
	live,
}: {
	game: ChaalTvGame;
	others: ReadonlyArray<ChaalTvGame>;
	live: string | null;
}) {
	const { preferences } = useChaalPreferences();
	const visible = usePageVisible();
	const [view, setView] = useState<ChannelView>(() => ({ ...tvStateOf(game), san: undefined }));
	const link = usePublicStream(live && visible ? tvFeedUrl(live, game.channel) : null, (value) =>
		setView((current) => next(current, value, performance.now())),
	);
	const [flipped, setFlipped] = useState(false);
	useHotkeys({ f: () => setFlipped((value) => !value) });
	const orientation: Color = flipped ? opposite(view.orientation) : view.orientation;
	const turn = view.fen ? sideToMove(view.fen) : null;
	const channel = CHANNEL_NAMES[game.channel]();

	const strip = (side: Color) => {
		const player: TvPlayer = view[side];
		const seconds = view.clocks?.[side];
		return (
			<PlayerStrip
				name={tvName(player)}
				color={side}
				title={player.title}
				rating={player.rating}
				href={
					player.aiLevel === null && player.name !== "?" ? localizeHref(`/app/chaal/players/${player.name}`) : undefined
				}
				active={turn === side}
				className={PLACE}
			>
				{seconds === undefined ? (
					<ClockPlace />
				) : (
					<Clock
						ms={seconds * 1_000}
						since={view.at}
						running={turn === side}
						color={side}
						className="text-[2rem] sm:text-ch-clock"
					/>
				)}
			</PlayerStrip>
		);
	};

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-channel">
			<h1 className="sr-only">{m.ch_tv_channel_title({ channel })}</h1>
			<div className={playGrid(false)}>
				<div className={`${PLAY_COLUMN} lg:items-end`}>
					<div className={`${STRIP} land:row-start-1`}>{strip(opposite(orientation))}</div>
					<div className={`${PLACE} ${LAND_BOARD}`} data-testid="chaal-channel-board" data-game={view.id}>
						{view.fen ? (
							<Board
								fen={view.fen}
								orientation={orientation}
								movable="none"
								lastMove={view.lastMove ? { uci: view.lastMove, san: view.san } : null}
								coordinates={preferences.coordinates}
								theme={preferences.board}
								pieces={preferences.pieces}
								sound={preferences.sounds ? preferences.volume : false}
								label={m.ch_tv_board_label({ channel })}
							/>
						) : (
							<Skeleton className="aspect-square w-full rounded-none" />
						)}
					</div>
					<div className={`${STRIP} land:row-start-2`}>{strip(orientation)}</div>
					<div className={`flex flex-wrap gap-2 px-4 sm:px-0 ${LAND_SIDE} land:row-start-3`}>
						<Button asChild size="sm">
							<Link {...chaalLinks.game(view.id)} data-testid="chaal-channel-follow">
								<EyeIcon aria-hidden />
								{m.ch_tv_follow()}
							</Link>
						</Button>
						<Button type="button" variant="outline" size="sm" onClick={() => setFlipped((value) => !value)}>
							<FlipVerticalIcon aria-hidden />
							{m.ch_control_flip()}
						</Button>
					</div>
				</div>

				<div className="flex min-w-0 flex-col gap-6 px-4 sm:px-0">
					<div className="ch-rule flex flex-col gap-1 pt-3">
						<p className="ch-display text-ch-head">{m.ch_tv_channel_title({ channel })}</p>
						<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ch-muted text-sm">
							<span>{tvKind(game)}</span>
							<LiveDot link={link} />
							<a
								href={lichessGameUrl(view.id)}
								rel="noopener"
								target="_blank"
								className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
							>
								<ExternalLinkIcon aria-hidden className="size-3.5" />
								{m.ch_game_on_lichess()}
								<span className="sr-only"> {m.ch_opens_new_tab()}</span>
							</a>
						</p>
						<p className="text-ch-muted text-sm">{m.ch_tv_channel_note()}</p>
					</div>
					<OtherChannels games={others} current={game.channel} />
				</div>
			</div>
		</main>
	);
}

/** The other channels, each as a small diagram and its name: the way to change channel. */
function OtherChannels({ games, current }: { games: ReadonlyArray<ChaalTvGame>; current: TvChannel }) {
	const { preferences } = useChaalPreferences();
	const rest = games.filter((game) => game.channel !== current);
	if (rest.length === 0) return null;
	return (
		<section aria-labelledby="chaal-channel-others" className="flex flex-col gap-2">
			<h2 id="chaal-channel-others" className="font-semibold text-sm">
				{m.ch_tv_other_channels()}
			</h2>
			<ul className="grid grid-cols-2 gap-x-3 gap-y-3 lg:grid-cols-1" data-testid="chaal-channel-others">
				{rest.map((game) => (
					<li key={game.channel}>
						<Link
							{...chaalLinks.channel(game.channel)}
							className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 text-sm hover:bg-ch-plate"
							data-testid="chaal-channel-link"
						>
							{game.fen ? (
								<MiniBoard
									fen={game.fen}
									orientation={game.orientation}
									marks={squaresOfMove(game.lastMove)}
									theme={preferences.board}
									pieces={preferences.pieces}
									coordinates={false}
									className="w-full"
								/>
							) : (
								<span className="aspect-square bg-ch-plate" />
							)}
							<span className="flex min-w-0 flex-col">
								<span className="font-medium">{CHANNEL_NAMES[game.channel]()}</span>
								<span className="truncate text-ch-muted text-xs">
									{tvName(game.white)} – {tvName(game.black)}
								</span>
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
