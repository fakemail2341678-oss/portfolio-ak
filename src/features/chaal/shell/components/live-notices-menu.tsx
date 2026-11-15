import { Link } from "@tanstack/react-router";
import { BellIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { m } from "@/paraglide/messages";
import { chaalLinks } from "../../links";
import { useLiveAccount } from "../../live/hooks/use-live-events";
import type { LiveStore } from "../../live/store";
import { challengePace, eventPlayerName } from "../../play/labels";
import { useWaiting } from "../hooks/use-live-notices";

/**
 * Notifications (PLAN Task 78, decision 0267), from the event store every tab keeps: the
 * bell in the top bar (what waits for the player: challenges to answer, their move), the
 * count on Play, and a toast with a sound when something new arrives. They're drawn from
 * what the player has now; nothing is stored, so there's nothing to mark as read.
 */

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
			<span className="sr-only">{m.chaal_notices_your_move_count({ count: String(games.length) })}</span>
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
	const label = count > 0 ? m.chaal_notices_label_count({ count: String(count) }) : m.chaal_notices_label();
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
					{m.chaal_notices_title()}
				</p>
				{count === 0 ? (
					<p className="px-4 py-4 text-ch-muted text-sm">{m.chaal_notices_empty()}</p>
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
										{m.chaal_notices_challenge({ name: eventPlayerName(challenge.challenger) })}
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
									<span className="font-semibold">
										{m.chaal_notices_turn({ name: eventPlayerName(game.opponent) })}
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</PopoverContent>
		</Popover>
	);
}
