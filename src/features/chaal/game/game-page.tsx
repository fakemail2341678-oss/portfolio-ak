import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionQueryOptions } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { canConnect, useConnectLichess } from "../connect/use-connect";
import { chaalLinks } from "../links";
import { liveGameQueryOptions } from "../play/queries";
import { replayQueryOptions } from "../players/queries";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";
import { PLACE } from "../shell/play-layout";
import { lichessGameUrl } from "./lichess-links";
import { LiveGameBoard } from "./live-game-page";
import { inProgress } from "./load";
import { ReplayBoard } from "./replay-page";

const route = getRouteApi("/_chaal/app/chaal/game/$id");

/**
 * /app/chaal/game/$id (noindex; decision 0271): a game the player plays on Lichess while
 * it's going on (Task 77), else the game's replay for anyone (Task 81). Every other case is
 * said where the board would be: the feature off, a game still being played that isn't the
 * player's (connect, or follow it on Lichess until Task 82's spectating), a variant, a game
 * Lichess doesn't have, or Lichess unreachable.
 */
export function ChaalGamePage() {
	const { id } = route.useParams();
	const { data: session } = useQuery(sessionQueryOptions());
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { data: connection } = useQuery({ ...chaalConnectionQueryOptions(), enabled: Boolean(session) });
	const connected = Boolean(connection && !connection.revoked && !connection.needsScopesFor.includes("play"));
	const playable = Boolean(session) && connected && status?.features.play !== false;
	const live = useQuery({ ...liveGameQueryOptions(id), enabled: playable });
	const liveGame = live.data && inProgress(live.data.game.state.status) ? live.data : null;
	const replay = useQuery({ ...replayQueryOptions(id), enabled: !liveGame && !(playable && live.isPending) });

	if (liveGame) return <LiveGameBoard key={id} initial={liveGame} />;

	let body: ReactNode;
	if (status?.features.players === false && !playable)
		body = <Said testId="chaal-game-off" title={m.ch_players_off_title()} text={m.ch_players_off_body()} />;
	else if (replay.data) {
		const game = replay.data;
		if (game.ongoing) body = <BeingPlayed id={id} canPlay={playable} />;
		else if (!game.standard)
			body = (
				<Said testId="chaal-game-variant" title={m.ch_replay_variant_title()} text={m.ch_replay_variant_body()}>
					<LichessLink id={id} />
				</Said>
			);
		else return <ReplayBoard key={id} game={game} />;
	} else if (replay.data === null)
		body = (
			<Said testId="chaal-game-missing" title={m.ch_replay_missing_title()} text={m.ch_replay_missing_body()}>
				<LichessLink id={id} />
			</Said>
		);
	else if (replay.isError)
		body = (
			<Said testId="chaal-game-error" title={m.ch_game_error_title()} text={errorMessage(replay.error)}>
				<Button type="button" onClick={() => void replay.refetch()}>
					{m.error_retry()}
				</Button>
			</Said>
		);
	else body = <BoardPlace busy />;

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-game">
			<h1 className="sr-only">{m.ch_game_title()}</h1>
			{body}
		</main>
	);
}

/** The board's place: the same grid and square as the game, so nothing moves when it arrives. */
export function BoardPlace({ children, busy }: { children?: ReactNode; busy?: boolean }) {
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

/**
 * A game still being played that isn't shown live here: someone else's (follow it on
 * Lichess), or perhaps the player's own when they aren't connected for play (connect).
 */
function BeingPlayed({ id, canPlay }: { id: string; canPlay: boolean }) {
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { connect, pending } = useConnectLichess();
	return (
		<Said testId="chaal-game-playing" title={m.ch_replay_playing_title()} text={m.ch_replay_playing_body()}>
			{!canPlay && canConnect(status) ? (
				<Button type="button" onClick={() => void connect()} disabled={pending}>
					{m.ch_replay_playing_connect()}
				</Button>
			) : null}
			<LichessLink id={id} />
		</Said>
	);
}
