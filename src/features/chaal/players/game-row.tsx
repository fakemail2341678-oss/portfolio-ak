import { Link } from "@tanstack/react-router";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { MiniBoard } from "../board/mini-board";
import { chaalLinks } from "../links";
import { gameKind, scoreOf } from "./labels";
import type { ChaalGameSummary, GamePlayerSummary } from "./schema";

const nameOf = (player: GamePlayerSummary) =>
	player.aiLevel !== null ? m.ch_live_ai_name({ level: String(player.aiLevel) }) : player.name;

/** One side of a game in a list: the title, the name, the rating and its change. */
function Side({ player, winner }: { player: GamePlayerSummary; winner: boolean }) {
	return (
		<span className={`flex min-w-0 items-baseline gap-1.5 ${winner ? "font-semibold" : ""}`}>
			{player.title ? <span className="font-bold text-xs">{player.title}</span> : null}
			<span className="truncate">{nameOf(player)}</span>
			{player.rating ? <span className="ch-figures shrink-0 text-ch-muted text-xs">{player.rating}</span> : null}
			{player.ratingDiff ? (
				<span className="ch-figures shrink-0 text-ch-muted text-xs">
					{player.ratingDiff > 0 ? `+${player.ratingDiff}` : `−${-player.ratingDiff}`}
				</span>
			) : null}
		</span>
	);
}

/**
 * A game in a player's list (Task 81): its last position, the two sides, the score, what
 * kind of game, the opening and the day. The whole row opens the game here; a game still
 * being played says so instead of a score.
 */
export function GameRow({ game, perspective }: { game: ChaalGameSummary; perspective?: string }) {
	const orientation = perspective && game.black.id === perspective ? "black" : "white";
	const moves = Math.ceil(game.plies / 2);
	return (
		<li className="ch-hairline" data-testid="chaal-game-row" data-game={game.id}>
			<Link
				{...chaalLinks.game(game.id)}
				className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2.5 hover:bg-ch-plate sm:grid-cols-[5rem_minmax(0,1fr)_auto]"
			>
				{game.lastFen ? (
					<MiniBoard fen={game.lastFen} orientation={orientation} coordinates={false} className="row-span-3 w-full" />
				) : (
					<span className="row-span-3" />
				)}
				<span className="flex min-w-0 flex-col text-sm">
					<Side player={game.white} winner={game.winner === "white"} />
					<Side player={game.black} winner={game.winner === "black"} />
				</span>
				<span className="ch-figures text-end font-semibold">
					{game.ongoing ? (
						<span className="font-normal text-ch-muted text-xs">{m.ch_players_playing()}</span>
					) : (
						scoreOf(game)
					)}
				</span>
				<span className="col-span-2 truncate text-ch-muted text-xs">
					{gameKind(game)}
					{game.plies > 0 ? ` · ${m.ch_history_moves({ count: formatNumber(moves) })}` : ""}
				</span>
				<span className="col-span-2 flex min-w-0 justify-between gap-2 text-ch-muted text-xs">
					<span className="truncate">{game.opening?.name ?? ""}</span>
					{game.createdAt ? (
						<time dateTime={new Date(game.createdAt).toISOString()} className="shrink-0">
							{formatDate(game.createdAt)}
						</time>
					) : null}
				</span>
			</Link>
		</li>
	);
}
