import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CatchBoundary, getRouteApi, Link } from "@tanstack/react-router";
import { ExternalLinkIcon, SwordsIcon, UserCheckIcon, UserPlusIcon } from "lucide-react";
import { type ReactNode, Suspense } from "react";
import { toast } from "sonner";
import { LineChart } from "@/components/charts";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { MiniBoard } from "../board/mini-board";
import { lichessPlayerUrl, UGC_REL } from "../game/lichess-links";
import { chaalLinks } from "../links";
import { chaalStatusQueryOptions } from "../queries";
import type { PlayerSearch } from "../search";
import { GameRow } from "./game-row";
import { historyRows } from "./history";
import { PERF_NAMES } from "./labels";
import { OnlineDot } from "./online-dot";
import { PlayerGamesTab } from "./player-games";
import { Progress } from "./players-page";
import {
	activityQueryOptions,
	followCalls,
	latestGamesInput,
	mainPerf,
	perfStatsQueryOptions,
	playerGamesQueryOptions,
	playerQueryOptions,
	ratingHistoryQueryOptions,
} from "./queries";
import type { ChaalPlayer, ChaalPlayerPage as PlayerPageData, PlayerPerf, PlayerViewer } from "./schema";

const route = getRouteApi("/_chaal/app/chaal/players/$username");

/** A two-letter country code as its flag; Lichess's own regions (`_earth`, `GB-WLS`) aren't drawn. */
function flagOf(code: string | null): string | null {
	if (!code || !/^[A-Z]{2}$/.test(code)) return null;
	return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

/**
 * /app/chaal/players/$username (Task 81, decision 0271): a Lichess player. The header
 * (title, name, online or playing, what they wrote about themselves, as text; follow,
 * challenge, lichess.org), then the overview (ratings, the chosen one's history and
 * details, the current game, the score with the viewer, the latest games, the activity)
 * or the games with filters. The profile renders on the server; the rest streams in.
 */
export function ChaalPlayerPage() {
	const { username } = route.useParams();
	const search = route.useSearch();
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const page = useQuery(playerQueryOptions(username));

	let body: ReactNode;
	if (status?.features.players === false) body = <Note testId="chaal-player-off" text={m.ch_players_off_body()} />;
	else if (page.data) body = <PlayerBody page={page.data} search={search} />;
	else if (page.isError)
		body = (
			<Note testId="chaal-player-error" text={errorMessage(page.error)}>
				<Button type="button" variant="outline" onClick={() => void page.refetch()}>
					{m.error_retry()}
				</Button>
			</Note>
		);
	else body = <Skeleton className="h-64 w-full rounded-none" />;

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-player">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-12">
				{page.data ? null : <h1 className="ch-display text-ch-title">{username}</h1>}
				{body}
			</div>
		</main>
	);
}

function Note({ text, testId, children }: { text: string; testId: string; children?: ReactNode }) {
	return (
		<div className="ch-rule flex flex-col items-start gap-3 pt-3" data-testid={testId}>
			<p className="max-w-prose text-ch-muted">{text}</p>
			{children}
		</div>
	);
}

function PlayerBody({ page, search }: { page: PlayerPageData; search: PlayerSearch }) {
	const { player, viewer } = page;
	const games = search.tab === "games";
	return (
		<>
			<PlayerHeader player={player} viewer={viewer} />
			{player.closed ? (
				<Note testId="chaal-player-closed" text={m.ch_player_closed()} />
			) : (
				<>
					<nav aria-label={m.ch_player_sections()} className="ch-rule">
						<ul className="flex gap-1">
							<li>
								<Link
									{...chaalLinks.player(player.username)}
									aria-current={games ? undefined : "page"}
									className={TAB}
									data-testid="chaal-player-tab-overview"
								>
									{m.ch_player_overview()}
								</Link>
							</li>
							<li>
								<Link
									{...chaalLinks.player(player.username, { tab: "games" })}
									aria-current={games ? "page" : undefined}
									className={TAB}
									data-testid="chaal-player-tab-games"
								>
									{m.ch_player_games()}
								</Link>
							</li>
						</ul>
					</nav>
					{games ? (
						<PlayerGamesTab player={player} search={search} />
					) : (
						<Overview player={player} viewer={viewer} perf={search.perf ?? mainPerf(player)} />
					)}
				</>
			)}
		</>
	);
}

const TAB =
	"block whitespace-nowrap px-3 py-2.5 text-ch-muted text-sm transition-colors hover:text-ch-ink aria-[current=page]:text-ch-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--ch-ink)]";

function PlayerHeader({ player, viewer }: { player: ChaalPlayer; viewer: PlayerViewer | null }) {
	const flag = flagOf(player.profile.flag);
	const self = viewer?.lichessId === player.id;
	const facts = [
		player.profile.realName,
		player.profile.location,
		player.profile.fideRating ? m.ch_player_fide({ rating: formatNumber(player.profile.fideRating) }) : null,
	].filter((fact): fact is string => Boolean(fact));
	return (
		<header className="flex flex-col gap-4" data-testid="chaal-player-header">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="flex min-w-0 flex-col gap-1">
					<h1 className="ch-display flex min-w-0 items-baseline gap-2 text-ch-title">
						{player.title ? <span>{player.title}</span> : null}
						<span className="truncate">{player.username}</span>
						{flag ? (
							<span className="text-2xl" role="img" aria-label={player.profile.flag ?? ""}>
								{flag}
							</span>
						) : null}
					</h1>
					{player.closed ? null : (
						<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ch-muted text-sm">
							<span className="inline-flex items-center gap-1.5" data-testid="chaal-player-presence">
								<OnlineDot online={player.online || player.playingId !== null} />
								{player.playingId ? (
									<Link {...chaalLinks.game(player.playingId)} className="underline underline-offset-4">
										{m.ch_player_playing_now()}
									</Link>
								) : player.online ? (
									m.ch_players_online()
								) : player.seenAt ? (
									m.ch_player_seen({ date: formatDate(player.seenAt) })
								) : null}
							</span>
							{facts.map((fact) => (
								<span key={fact}>{fact}</span>
							))}
						</p>
					)}
				</div>
				<div className="flex flex-wrap gap-2">
					{viewer && viewer.following !== null && !self && !player.closed ? (
						<FollowButton username={player.username} following={viewer.following} />
					) : null}
					{!self && !player.closed ? (
						<Button asChild variant="outline">
							<Link
								{...chaalLinks.play({ with: "friend", opponent: player.username })}
								data-testid="chaal-player-challenge"
							>
								<SwordsIcon aria-hidden />
								{m.ch_player_challenge()}
							</Link>
						</Button>
					) : null}
					<Button asChild variant="outline">
						<a href={lichessPlayerUrl(player.username)} rel={UGC_REL} target="_blank">
							<ExternalLinkIcon aria-hidden />
							{m.ch_player_on_lichess()}
						</a>
					</Button>
				</div>
			</div>
			{player.profile.bio ? (
				<p className="max-w-prose whitespace-pre-line break-words" data-testid="chaal-player-bio">
					{player.profile.bio}
				</p>
			) : null}
			{player.profile.links.length > 0 ? (
				<ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
					{player.profile.links.map((link) => (
						<li key={link}>
							<a
								href={link.startsWith("http") ? link : `https://${link}`}
								rel={UGC_REL}
								target="_blank"
								className="break-all underline underline-offset-4"
							>
								{link.replace(/^https?:\/\//, "")}
							</a>
						</li>
					))}
				</ul>
			) : null}
			{player.closed ? null : (
				<p className="flex flex-wrap gap-x-4 gap-y-1 text-ch-muted text-sm">
					<span>{m.ch_player_games_count({ count: formatNumber(player.count.all) })}</span>
					<span>
						{m.ch_player_record({
							win: formatNumber(player.count.win),
							loss: formatNumber(player.count.loss),
							draw: formatNumber(player.count.draw),
						})}
					</span>
					{player.createdAt ? <span>{m.ch_player_since({ date: formatDate(player.createdAt) })}</span> : null}
				</p>
			)}
		</header>
	);
}

/** Follow or unfollow on Lichess, shown at once and put back if Lichess refuses. */
function FollowButton({ username, following }: { username: string; following: boolean }) {
	const queryClient = useQueryClient();
	const key = playerQueryOptions(username).queryKey;
	const mutation = useMutation({
		mutationFn: (follow: boolean) => followCalls.follow(username, follow),
		onMutate: (follow) => {
			const before = queryClient.getQueryData(key);
			queryClient.setQueryData(key, (page) =>
				page?.viewer ? { ...page, viewer: { ...page.viewer, following: follow } } : page,
			);
			return { before };
		},
		onError: (error, _follow, context) => {
			if (context?.before) queryClient.setQueryData(key, context.before);
			toast.error(errorMessage(error));
		},
	});
	const Icon = following ? UserCheckIcon : UserPlusIcon;
	return (
		<Button
			type="button"
			variant={following ? "outline" : "default"}
			aria-pressed={following}
			onClick={() => mutation.mutate(!following)}
			disabled={mutation.isPending}
			data-testid="chaal-player-follow"
		>
			<Icon aria-hidden />
			{following ? m.ch_player_following() : m.ch_player_follow()}
		</Button>
	);
}

function Overview({ player, viewer, perf }: { player: ChaalPlayer; viewer: PlayerViewer | null; perf: PlayerPerf }) {
	return (
		<div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div className="flex min-w-0 flex-col gap-6">
				<Ratings player={player} perf={perf} />
				<section aria-labelledby="chaal-player-rating" className="flex flex-col gap-4">
					<h2 id="chaal-player-rating" className="ch-rule pt-3 font-semibold">
						{m.ch_player_rating_of({ rating: PERF_NAMES[perf]() })}
					</h2>
					<Streamed
						resetKey={`history:${perf}`}
						fallback={<Skeleton className="aspect-[2/1] w-full rounded-none sm:aspect-[5/2]" />}
					>
						<RatingChart username={player.username} perf={perf} />
					</Streamed>
					<Streamed resetKey={`perf:${perf}`} fallback={<Skeleton className="h-56 w-full rounded-none" />}>
						<PerfDetails username={player.username} perf={perf} />
					</Streamed>
				</section>
			</div>
			<div className="flex min-w-0 flex-col gap-6">
				{viewer?.crosstable ? <Crosstable player={player} viewer={viewer} /> : null}
				<Streamed resetKey="latest" fallback={<Skeleton className="h-96 w-full rounded-none" />}>
					<LatestGames player={player} />
				</Streamed>
				<Streamed resetKey="activity" fallback={<Skeleton className="h-64 w-full rounded-none" />}>
					<Activity username={player.username} />
				</Streamed>
			</div>
		</div>
	);
}

/**
 * A part that streams in after the profile (the loader started it): a sized place until it
 * arrives, and a line instead if it fails, so the rest of the page stays.
 */
function Streamed({ resetKey, fallback, children }: { resetKey: string; fallback: ReactNode; children: ReactNode }) {
	return (
		<CatchBoundary
			getResetKey={() => resetKey}
			errorComponent={() => <p className="text-ch-muted text-sm">{m.ch_player_unavailable()}</p>}
		>
			<Suspense fallback={fallback}>{children}</Suspense>
		</CatchBoundary>
	);
}

/** A card per rating; choosing one shows its history and details below, kept in the URL. */
function Ratings({ player, perf }: { player: ChaalPlayer; perf: PlayerPerf }) {
	if (player.ratings.length === 0 && !player.puzzle) return <p className="text-ch-muted">{m.ch_player_no_ratings()}</p>;
	return (
		<ul className="grid grid-cols-2 gap-px sm:grid-cols-3" data-testid="chaal-player-ratings">
			{player.ratings.map((rating) => (
				<li key={rating.perf} className="bg-ch-ground ring-1 ring-ch-hair">
					<Link
						{...chaalLinks.player(player.username, { perf: rating.perf })}
						replace
						resetScroll={false}
						aria-current={rating.perf === perf ? "true" : undefined}
						className="flex h-full flex-col gap-0.5 p-3 transition-colors hover:bg-ch-plate aria-[current=true]:shadow-[inset_0_-2px_0_var(--ch-ink)]"
						data-testid={`chaal-player-perf-${rating.perf}`}
					>
						<span className="text-ch-muted text-xs">{PERF_NAMES[rating.perf]()}</span>
						<span className="flex items-baseline gap-2">
							<span className="ch-display ch-figures text-ch-head">
								{rating.rating}
								{rating.provisional ? "?" : ""}
							</span>
							<Progress value={rating.progress} />
						</span>
						<span className="text-ch-muted text-xs">
							{m.ch_player_games_count({ count: formatNumber(rating.games) })}
						</span>
					</Link>
				</li>
			))}
			{player.puzzle ? (
				<li className="flex flex-col gap-0.5 bg-ch-ground p-3 ring-1 ring-ch-hair">
					<span className="text-ch-muted text-xs">{m.ch_puzzle_rating()}</span>
					<span className="ch-display ch-figures text-ch-head">{player.puzzle.rating}</span>
					<span className="text-ch-muted text-xs">
						{m.ch_player_puzzles_count({ count: formatNumber(player.puzzle.games) })}
					</span>
				</li>
			) : null}
		</ul>
	);
}

function RatingChart({ username, perf }: { username: string; perf: PlayerPerf }) {
	const { data } = useSuspenseQuery(ratingHistoryQueryOptions(username));
	const rows = historyRows(data, perf).map((row) => ({
		day: formatDate(`${row.day}T12:00:00.000Z`),
		rating: row.rating,
	}));
	if (rows.length < 2)
		return <p className="flex aspect-[2/1] items-center text-ch-muted sm:aspect-[5/2]">{m.ch_player_history_none()}</p>;
	return (
		<LineChart
			label={m.ch_player_history_label({ rating: PERF_NAMES[perf]() })}
			data={rows}
			index="day"
			series={[{ key: "rating", label: m.ch_players_rating(), color: "var(--ch-ink)" }]}
			format={(value) => String(Math.round(value))}
		/>
	);
}

function Figure({ label, value, testId }: { label: string; value: ReactNode; testId?: string }) {
	return (
		<div className="flex flex-col gap-0.5 border-ch-hair border-t py-2" data-testid={testId}>
			<dt className="text-ch-muted text-xs">{label}</dt>
			<dd className="ch-figures font-semibold">{value}</dd>
		</div>
	);
}

/** One rating's details: where the player stands, their best and worst, their record and streaks. */
function PerfDetails({ username, perf }: { username: string; perf: PlayerPerf }) {
	const { data } = useSuspenseQuery(perfStatsQueryOptions(username, perf));
	if (!data) return <p className="min-h-56 text-ch-muted">{m.ch_player_perf_none()}</p>;
	const moment = (value: typeof data.highest) =>
		value ? (
			<>
				{value.rating} <span className="font-normal text-ch-muted text-xs">{formatDate(value.at)}</span>
			</>
		) : (
			"–"
		);
	return (
		<div className="flex min-h-56 flex-col gap-4" data-testid="chaal-player-perf">
			<dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
				<Figure
					label={m.ch_players_rating()}
					value={`${data.rating}${data.provisional ? "?" : ""} ± ${data.deviation}`}
				/>
				<Figure label={m.ch_player_rank()} value={data.rank ? `#${formatNumber(data.rank)}` : "–"} />
				<Figure
					label={m.ch_player_percentile()}
					value={data.percentile !== null ? m.ch_player_better_than({ share: formatNumber(data.percentile) }) : "–"}
				/>
				<Figure label={m.ch_player_opponents()} value={data.opponentAverage ?? "–"} />
				<Figure label={m.ch_player_highest()} value={moment(data.highest)} />
				<Figure label={m.ch_player_lowest()} value={moment(data.lowest)} />
				<Figure
					label={m.ch_player_record_label()}
					value={m.ch_player_record({
						win: formatNumber(data.count.win),
						loss: formatNumber(data.count.loss),
						draw: formatNumber(data.count.draw),
					})}
				/>
				<Figure label={m.ch_player_streak()} value={`${data.streak.win} / ${data.streak.winBest}`} />
			</dl>
			{data.bestWins.length > 0 ? (
				<div className="flex flex-col gap-1">
					<h3 className="font-semibold text-sm">{m.ch_player_best_wins()}</h3>
					<ul className="flex flex-col text-sm">
						{data.bestWins.map((win) => (
							<li key={`${win.gameId}-${win.at}`} className="ch-hairline flex justify-between gap-3 py-1">
								<Link {...chaalLinks.player(win.name)} className="truncate underline-offset-4 hover:underline">
									{win.name}
								</Link>
								<span className="ch-figures shrink-0 text-ch-muted">
									{win.gameId ? (
										<Link {...chaalLinks.game(win.gameId)} className="underline-offset-4 hover:underline">
											{win.rating}
										</Link>
									) : (
										win.rating
									)}
								</span>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	);
}

function Crosstable({ player, viewer }: { player: ChaalPlayer; viewer: PlayerViewer }) {
	const table = viewer.crosstable;
	if (!table) return null;
	const score = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });
	return (
		<section aria-labelledby="chaal-player-crosstable" className="flex flex-col gap-1" data-testid="chaal-crosstable">
			<h2 id="chaal-player-crosstable" className="ch-rule pt-3 font-semibold">
				{m.ch_player_crosstable()}
			</h2>
			{table.games === 0 ? (
				<p className="text-ch-muted text-sm">{m.ch_player_crosstable_none({ name: player.username })}</p>
			) : (
				<p className="flex items-baseline gap-3">
					<span className="ch-display ch-figures text-ch-head">
						{score(table.you)}–{score(table.them)}
					</span>
					<span className="text-ch-muted text-sm">
						{m.ch_player_crosstable_games({ count: formatNumber(table.games), you: viewer.username })}
					</span>
				</p>
			)}
		</section>
	);
}

/** The game in progress (its last position as Lichess exports it) and the latest finished ones. */
function LatestGames({ player }: { player: ChaalPlayer }) {
	const { data } = useSuspenseQuery(playerGamesQueryOptions(latestGamesInput(player.username)));
	const current = data.games.find((game) => game.ongoing);
	const finished = data.games.filter((game) => !game.ongoing).slice(0, 5);
	return (
		<>
			{current ? (
				<section
					aria-labelledby="chaal-player-current"
					className="flex flex-col gap-2"
					data-testid="chaal-player-current"
				>
					<h2 id="chaal-player-current" className="ch-rule pt-3 font-semibold">
						{m.ch_player_playing_now()}
					</h2>
					<Link {...chaalLinks.game(current.id)} className="flex items-center gap-3 hover:bg-ch-plate">
						{current.lastFen ? (
							<MiniBoard
								fen={current.lastFen}
								orientation={current.black.id === player.id ? "black" : "white"}
								className="w-28 shrink-0"
							/>
						) : null}
						<span className="flex min-w-0 flex-col text-sm">
							<span className="truncate">
								{current.white.name} – {current.black.name}
							</span>
							<span className="text-ch-muted text-xs">{m.ch_player_current_note()}</span>
						</span>
					</Link>
				</section>
			) : null}
			<section aria-labelledby="chaal-player-latest" className="flex flex-col gap-1" data-testid="chaal-player-latest">
				<h2 id="chaal-player-latest" className="ch-rule pt-3 font-semibold">
					{m.ch_player_latest()}
				</h2>
				{finished.length === 0 ? (
					<p className="text-ch-muted text-sm">{m.ch_player_games_none()}</p>
				) : (
					<ul className="flex flex-col">
						{finished.map((game) => (
							<GameRow key={game.id} game={game} perspective={player.id} />
						))}
					</ul>
				)}
				<Link
					{...chaalLinks.player(player.username, { tab: "games" })}
					className="self-start py-2 text-sm underline underline-offset-4"
				>
					{m.ch_player_all_games()}
				</Link>
			</section>
		</>
	);
}

/** What the player did on Lichess lately, a line per thing, by day. */
function Activity({ username }: { username: string }) {
	const { data } = useSuspenseQuery(activityQueryOptions(username));
	const days = data.filter(
		(day) =>
			day.games.length > 0 || day.puzzles || day.tournaments > 0 || day.followers > 0 || day.correspondenceMoves > 0,
	);
	return (
		<section
			aria-labelledby="chaal-player-activity"
			className="flex flex-col gap-1"
			data-testid="chaal-player-activity"
		>
			<h2 id="chaal-player-activity" className="ch-rule pt-3 font-semibold">
				{m.ch_player_activity()}
			</h2>
			{days.length === 0 ? (
				<p className="text-ch-muted text-sm">{m.ch_player_activity_none()}</p>
			) : (
				<ol className="flex flex-col">
					{days.map((day) => (
						<li key={day.start} className="ch-hairline flex flex-col gap-0.5 py-2 text-sm">
							<time dateTime={new Date(day.start).toISOString()} className="text-ch-muted text-xs">
								{formatDate(day.start)}
							</time>
							{day.games.map((games) => (
								<span key={games.perf}>
									{m.ch_activity_games({
										count: formatNumber(games.win + games.loss + games.draw),
										rating: PERF_NAMES[games.perf](),
										win: formatNumber(games.win),
										loss: formatNumber(games.loss),
										draw: formatNumber(games.draw),
									})}{" "}
									{games.after ? (
										<span className="ch-figures text-ch-muted">
											{games.before} → {games.after}
										</span>
									) : null}
								</span>
							))}
							{day.puzzles ? (
								<span>
									{m.ch_activity_puzzles({
										win: formatNumber(day.puzzles.win),
										loss: formatNumber(day.puzzles.loss),
									})}
								</span>
							) : null}
							{day.correspondenceMoves > 0 ? (
								<span>{m.ch_activity_correspondence({ count: formatNumber(day.correspondenceMoves) })}</span>
							) : null}
							{day.tournaments > 0 ? (
								<span>{m.ch_activity_tournaments({ count: formatNumber(day.tournaments) })}</span>
							) : null}
							{day.followers > 0 ? (
								<span className="text-ch-muted">{m.ch_activity_followers({ count: formatNumber(day.followers) })}</span>
							) : null}
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
