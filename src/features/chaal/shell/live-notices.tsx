import { Link, useNavigate } from "@tanstack/react-router";
import { BellIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { m } from "@/paraglide/messages";
import { playSound } from "../board/sounds";
import { chaalLinks } from "../links";
import { newNotices } from "../live/notices";
import { incomingChallenges, type LiveStore, liveStore, myTurnGames, useLive } from "../live/store";
import { useLiveAccount } from "../live/use-live-events";
import { challengePace, eventPlayerName } from "../play/labels";
import { useChaalPreferences } from "../settings/use-preferences";

/**
 * Notifications (PLAN Task 78, decision 0267), from the event store every tab keeps: the
 * bell in the top bar (what waits for the player: challenges to answer, their move), the
 * count on Play, and a toast with a sound when something new arrives. They're drawn from
 * what the player has now; nothing is stored, so there's nothing to mark as read.
 */

/** How many things wait for the player: challenges to them and games on their move. */
export function useWaiting(store: LiveStore = liveStore) {
	const live = useLive(store);
	const me = useLiveAccount();
	const challenges = incomingChallenges(live, me);
	const games = myTurnGames(live, Date.now());
	return { challenges, games, count: challenges.length + games.length };
}

/** The count of games on the player's move, on the Play link: a small ink badge, placed so nothing moves. */
export function PlayBadge({ store }: { store?: LiveStore }) {
	const { games } = useWaiting(store);
	if (games.length === 0) return null;
	return (
		<span
			className="ch-figures -translate-y-1/2 pointer-events-none absolute end-0 top-1/4 min-w-4 translate-x-1/2 rounded-full bg-ch-ink px-1 text-center font-semibold text-[0.625rem] text-ch-on-ink leading-4 rtl:-translate-x-1/2"
			data-testid="chaal-play-badge"
		>
			<span aria-hidden>{games.length}</span>
			<span className="sr-only">{m.ch_notices_your_move_count({ count: String(games.length) })}</span>
		</span>
	);
}

/**
 * The bell: for a player who follows their events (connected for play), drawn on the
 * server so the top bar doesn't move, with the count of what waits once the stream is open.
 */
export function NoticeBell({ store }: { store?: LiveStore }) {
	const account = useLiveAccount();
	const { challenges, games, count } = useWaiting(store);
	const [open, setOpen] = useState(false);
	const titleId = useId();
	if (!account) return null;
	const label = count > 0 ? m.ch_notices_label_count({ count: String(count) }) : m.ch_notices_label();
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative text-ch-muted"
					aria-label={label}
					title={label}
					data-testid="chaal-bell"
					data-count={count}
				>
					<BellIcon aria-hidden />
					{count > 0 ? (
						<span
							aria-hidden
							className="ch-figures absolute end-1 top-1 min-w-4 rounded-full bg-ch-ink px-1 text-center font-semibold text-[0.625rem] text-ch-on-ink leading-4"
						>
							{count}
						</span>
					) : null}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 p-0" aria-labelledby={titleId} data-testid="chaal-bell-panel">
				<p id={titleId} className="ch-display border-ch-ink border-b-2 px-4 py-3">
					{m.ch_notices_title()}
				</p>
				{count === 0 ? (
					<p className="px-4 py-4 text-ch-muted text-sm">{m.ch_notices_empty()}</p>
				) : (
					<ul className="flex max-h-[60dvh] flex-col overflow-y-auto">
						{challenges.map((challenge) => (
							<li key={challenge.id} className="ch-hairline last:border-b-0">
								<Link
									{...chaalLinks.play()}
									onClick={() => setOpen(false)}
									className="flex flex-col px-4 py-3 outline-none hover:bg-ch-plate focus-visible:bg-ch-plate"
									data-testid="chaal-bell-challenge"
								>
									<span className="font-semibold">
										{m.ch_notices_challenge({ name: eventPlayerName(challenge.challenger) })}
									</span>
									<span className="text-ch-muted text-xs">{challengePace(challenge)}</span>
								</Link>
							</li>
						))}
						{games.map((game) => (
							<li key={game.id} className="ch-hairline last:border-b-0">
								<Link
									{...chaalLinks.game(game.id)}
									onClick={() => setOpen(false)}
									className="flex flex-col px-4 py-3 outline-none hover:bg-ch-plate focus-visible:bg-ch-plate"
									data-testid="chaal-bell-game"
								>
									<span className="font-semibold">{m.ch_notices_turn({ name: eventPlayerName(game.opponent) })}</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</PopoverContent>
		</Popover>
	);
}

/**
 * Toasts what's new (a challenge, the player's move in a correspondence game, a game that
 * started) with the notify sound, in the tab the player is looking at. Every tab applies the
 * same events, so a hidden one stays quiet.
 */
export function useLiveNotices(store: LiveStore = liveStore): void {
	const me = useLiveAccount();
	const navigate = useNavigate();
	const { preferences } = useChaalPreferences();
	const sound = preferences.sounds ? preferences.volume : 0;

	useEffect(() => {
		if (!me) return;
		let before = store.get();
		return store.subscribe(() => {
			const after = store.get();
			const notices = newNotices(before, after, me);
			before = after;
			if (notices.length === 0 || document.visibilityState !== "visible") return;
			for (const notice of notices) {
				if (notice.kind === "challenge") {
					toast(m.ch_notices_challenge({ name: eventPlayerName(notice.challenge.challenger) }), {
						description: challengePace(notice.challenge),
						action: { label: m.ch_notices_answer(), onClick: () => void navigate(chaalLinks.play()) },
					});
				} else {
					const id = notice.game.id;
					const name = eventPlayerName(notice.game.opponent);
					toast(notice.kind === "turn" ? m.ch_notices_turn({ name }) : m.ch_notices_started({ name }), {
						action: { label: m.ch_notices_open(), onClick: () => void navigate(chaalLinks.game(id)) },
					});
				}
			}
			playSound("notify", sound);
		});
	}, [me, store, navigate, sound]);
}
