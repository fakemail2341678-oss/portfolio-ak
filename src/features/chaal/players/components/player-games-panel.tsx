import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { errorMessage } from "@/components/errors/error-page";
import { FilterBar } from "@/components/filters/filter-bar";
import { DateRangeFilter, SearchFilter, SelectFilter } from "@/components/filters/filters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";
import { chaalLinks } from "../../links";
import type { PlayerSearch } from "../../search";
import { PERF_NAMES } from "../labels";
import { gamesInputOf } from "../lib/games-input";
import { playerGamesQueryOptions } from "../queries";
import { type ChaalPlayer, PLAYER_PERFS } from "../schema";
import { GameRow } from "./game-row";

/**
 * A player's games (`?tab=games`, Task 81, decision 0271): filters in the URL (the rating, a
 * side, rated or casual, the result, an opponent, dates) in the kit's FilterBar, which works
 * without JavaScript, and pages by time over Lichess's export: "Older" carries the oldest
 * game's time as `before`, and any change of filter starts again from the newest.
 */
export function PlayerGamesTab({ player, search }: { player: ChaalPlayer; search: PlayerSearch }) {
	const input = gamesInputOf(player.username, search);
	const games = useQuery({ ...playerGamesQueryOptions(input), placeholderData: keepPreviousData });
	const any = { value: "", label: m.filters_any() };
	const filtered = Boolean(
		search.perf || search.color || search.mode || search.result || search.vs || search.since || search.until,
	);
	return (
		<div className="flex flex-col gap-4" data-testid="chaal-player-games">
			<FilterBar values={search} preserve={["tab"]} label={m.chaal_games_filters()}>
				{/* A change of filter starts from the newest game again. */}
				<input type="hidden" name="before" value="" />
				<SelectFilter
					name="perf"
					label={m.chaal_games_rating()}
					value={search.perf ?? ""}
					options={[any, ...PLAYER_PERFS.map((perf) => ({ value: perf, label: PERF_NAMES[perf]() }))]}
				/>
				<SelectFilter
					name="color"
					label={m.chaal_games_color()}
					value={search.color ?? ""}
					options={[any, { value: "white", label: m.chaal_white() }, { value: "black", label: m.chaal_black() }]}
				/>
				<SelectFilter
					name="mode"
					label={m.chaal_games_mode()}
					value={search.mode ?? ""}
					options={[
						any,
						{ value: "rated", label: m.chaal_online_rated() },
						{ value: "casual", label: m.chaal_online_casual() },
					]}
				/>
				<SelectFilter
					name="result"
					label={m.chaal_games_result()}
					value={search.result ?? ""}
					options={[
						any,
						{ value: "win", label: m.chaal_games_wins() },
						{ value: "loss", label: m.chaal_games_losses() },
						{ value: "draw", label: m.chaal_games_draws() },
					]}
				/>
				<SearchFilter name="vs" label={m.chaal_games_opponent()} value={search.vs ?? ""} className="w-40" />
				<DateRangeFilter
					label={m.chaal_games_dates()}
					names={["since", "until"]}
					value={[search.since, search.until]}
				/>
			</FilterBar>

			{games.data ? (
				<div className="flex flex-col gap-3" aria-busy={games.isPlaceholderData || undefined}>
					{games.data.games.length === 0 ? (
						<p className="ch-rule pt-3 text-ch-muted" data-testid="chaal-player-games-empty">
							{filtered || search.before ? m.chaal_games_none_filtered() : m.chaal_player_games_none()}
						</p>
					) : (
						<ul className={`ch-rule flex flex-col ${games.isPlaceholderData ? "opacity-60" : ""}`}>
							{games.data.games.map((game) => (
								<GameRow key={game.id} game={game} perspective={player.id} />
							))}
						</ul>
					)}
					<nav aria-label={m.chaal_games_pages()} className="flex justify-between gap-2">
						{search.before ? (
							<Button asChild variant="outline" size="sm">
								<Link {...chaalLinks.player(player.username, { ...search, before: undefined })}>
									<ChevronLeftIcon aria-hidden />
									{m.chaal_games_newest()}
								</Link>
							</Button>
						) : (
							<span />
						)}
						{games.data.next ? (
							<Button asChild variant="outline" size="sm">
								<Link
									{...chaalLinks.player(player.username, { ...search, before: games.data.next })}
									data-testid="chaal-player-games-older"
								>
									{m.chaal_games_older()}
									<ChevronRightIcon aria-hidden />
								</Link>
							</Button>
						) : null}
					</nav>
				</div>
			) : games.isError ? (
				<div className="flex flex-col items-start gap-3">
					<p className="text-ch-muted">{errorMessage(games.error)}</p>
					<Button type="button" variant="outline" onClick={() => void games.refetch()}>
						{m.error_retry()}
					</Button>
				</div>
			) : (
				<Skeleton className="h-[40rem] w-full rounded-none" />
			)}
		</div>
	);
}
