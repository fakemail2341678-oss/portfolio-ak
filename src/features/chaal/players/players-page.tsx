import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionQueryOptions } from "@/features/auth/queries";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { chaalLinks } from "../links";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";
import { PERF_NAMES } from "./labels";
import { OnlineDot } from "./online-dot";
import { DEFAULT_LEADERBOARD, followingQueryOptions, leaderboardQueryOptions } from "./queries";
import { type ChaalLeaderboard, type FollowedPlayer, LEADERBOARD_PERFS } from "./schema";

const route = getRouteApi("/_chaal/app/chaal/players/");

/**
 * /app/chaal/players (Task 81, decision 0271): Lichess's best players by rating, a tab per
 * rating (links in the URL), and beside them the players a connected viewer follows. Every
 * name opens the player's page here; their Lichess pages are a link away there.
 */
export function ChaalPlayersPage() {
	const { perf = DEFAULT_LEADERBOARD } = route.useSearch();
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const board = useQuery(leaderboardQueryOptions(perf));
	const off = status?.features.players === false;

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-players">
			<div className="mx-auto grid w-full max-w-7xl gap-x-12 gap-y-8 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-8 lg:pt-12">
				<div className="flex min-w-0 flex-col gap-6">
					<header className="flex flex-col gap-2">
						<h1 className="ch-display text-ch-title">{m.ch_players_title()}</h1>
						<p className="max-w-prose text-ch-muted">{m.ch_players_intro()}</p>
					</header>
					{off ? (
						<p className="ch-rule pt-3 text-ch-muted" data-testid="chaal-players-off">
							{m.ch_players_off_body()}
						</p>
					) : (
						<>
							<nav aria-label={m.ch_players_ratings()} className="ch-rule -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
								<ul className="flex gap-1">
									{LEADERBOARD_PERFS.map((each) => (
										<li key={each}>
											<Link
												{...chaalLinks.players(each === DEFAULT_LEADERBOARD ? {} : { perf: each })}
												aria-current={each === perf ? "page" : undefined}
												className="block whitespace-nowrap px-3 py-2.5 text-ch-muted text-sm transition-colors hover:text-ch-ink aria-[current=page]:text-ch-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--ch-ink)]"
												data-testid={`chaal-players-perf-${each}`}
											>
												{PERF_NAMES[each]()}
											</Link>
										</li>
									))}
								</ul>
							</nav>
							{board.data ? (
								<Leaderboard board={board.data} />
							) : board.isError ? (
								<div className="flex flex-col items-start gap-3" data-testid="chaal-players-error">
									<p className="text-ch-muted">{errorMessage(board.error)}</p>
									<Button type="button" variant="outline" onClick={() => void board.refetch()}>
										{m.error_retry()}
									</Button>
								</div>
							) : (
								<Skeleton className="h-[40rem] w-full rounded-none" />
							)}
						</>
					)}
				</div>
				<aside className="flex flex-col gap-4">{off ? null : <Following />}</aside>
			</div>
		</main>
	);
}

/** Progress over the latest games: up, down, or nothing said. */
export function Progress({ value }: { value: number }) {
	if (value === 0) return null;
	const up = value > 0;
	const Icon = up ? ArrowUpIcon : ArrowDownIcon;
	return (
		<span className="ch-figures inline-flex items-center gap-0.5 text-ch-muted text-xs">
			<Icon aria-hidden className="size-3" />
			<span className="sr-only">{up ? m.ch_players_up() : m.ch_players_down()}</span>
			{formatNumber(Math.abs(value))}
		</span>
	);
}

export function Leaderboard({ board }: { board: ChaalLeaderboard }) {
	if (board.players.length === 0) return <p className="text-ch-muted">{m.ch_players_empty()}</p>;
	return (
		<table className="w-full text-sm" data-testid="chaal-leaderboard">
			<caption className="sr-only">{m.ch_players_caption({ rating: PERF_NAMES[board.perf]() })}</caption>
			<thead>
				<tr className="text-ch-muted text-xs">
					<th scope="col" className="w-10 py-2 text-start font-normal">
						#
					</th>
					<th scope="col" className="py-2 text-start font-normal">
						{m.ch_players_player()}
					</th>
					<th scope="col" className="py-2 text-end font-normal">
						{m.ch_players_rating()}
					</th>
					<th scope="col" className="w-16 py-2 text-end font-normal">
						<span className="sr-only">{m.ch_players_progress()}</span>
					</th>
				</tr>
			</thead>
			<tbody>
				{board.players.map((player, index) => (
					<tr key={player.id} className="ch-hairline">
						<td className="ch-figures py-2 text-ch-muted">{formatNumber(index + 1)}</td>
						<td className="py-2">
							<PlayerName username={player.username} title={player.title} online={player.online} />
						</td>
						<td className="ch-figures py-2 text-end font-semibold">{formatNumber(player.rating)}</td>
						<td className="py-2 text-end">
							<Progress value={player.progress} />
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

/** A player's name as Chaal lists it: the title, the name (to their page), and whether they're online. */
export function PlayerName({
	username,
	title,
	online,
	children,
}: {
	username: string;
	title: string | null;
	online?: boolean;
	children?: ReactNode;
}) {
	return (
		<span className="inline-flex min-w-0 items-center gap-1.5">
			{online !== undefined ? <OnlineDot online={online} /> : null}
			{title ? <span className="font-bold text-xs">{title}</span> : null}
			<Link {...chaalLinks.player(username)} className="truncate font-medium underline-offset-4 hover:underline">
				{username}
			</Link>
			{children}
		</span>
	);
}

/** The players a connected viewer follows on Lichess; nothing for anyone else. */
function Following() {
	const { data: session } = useQuery(sessionQueryOptions());
	const { data: connection } = useQuery({ ...chaalConnectionQueryOptions(), enabled: Boolean(session) });
	const allowed = Boolean(connection && !connection.revoked && !connection.needsScopesFor.includes("social"));
	const list = useQuery({ ...followingQueryOptions(), enabled: allowed });
	if (!allowed) return null;
	return (
		<section aria-labelledby="chaal-following" className="flex flex-col gap-2" data-testid="chaal-following">
			<h2 id="chaal-following" className="ch-rule pt-3 font-semibold">
				{m.ch_players_following()}
			</h2>
			{list.data ? (
				list.data.length === 0 ? (
					<p className="text-ch-muted text-sm">{m.ch_players_following_none()}</p>
				) : (
					<FollowingList players={list.data} />
				)
			) : list.isError ? (
				<p className="text-ch-muted text-sm">{errorMessage(list.error)}</p>
			) : (
				<Skeleton className="h-40 w-full rounded-none" />
			)}
		</section>
	);
}

function FollowingList({ players }: { players: ReadonlyArray<FollowedPlayer> }) {
	return (
		<ul className="flex flex-col">
			{players.map((player) => (
				<li key={player.id} className="ch-hairline py-1.5 text-sm">
					<PlayerName username={player.username} title={player.title} online={player.online} />
				</li>
			))}
		</ul>
	);
}
