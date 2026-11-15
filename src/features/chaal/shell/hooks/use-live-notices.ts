import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { m } from "@/paraglide/messages";
import { playSound } from "../../board/lib/sounds";
import { chaalLinks } from "../../links";
import { useLive } from "../../live/hooks/use-live";
import { useLiveAccount } from "../../live/hooks/use-live-events";
import { newNotices } from "../../live/lib/notices";
import { incomingChallenges, type LiveStore, liveStore, myTurnGames } from "../../live/store";
import { challengePace, eventPlayerName } from "../../play/labels";
import { useChaalPreferences } from "../../settings/hooks/use-preferences";

/** How many things wait for the player: challenges to them and games on their move. */
export function useWaiting(store: LiveStore = liveStore) {
	const live = useLive(store);
	const me = useLiveAccount();
	const challenges = incomingChallenges(live, me);
	const games = myTurnGames(live, Date.now());
	return { challenges, games, count: challenges.length + games.length };
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
					toast(m.chaal_notices_challenge({ name: eventPlayerName(notice.challenge.challenger) }), {
						description: challengePace(notice.challenge),
						action: { label: m.chaal_notices_answer(), onClick: () => void navigate(chaalLinks.play()) },
					});
				} else {
					const id = notice.game.id;
					const name = eventPlayerName(notice.game.opponent);
					toast(notice.kind === "turn" ? m.chaal_notices_turn({ name }) : m.chaal_notices_started({ name }), {
						action: { label: m.chaal_notices_open(), onClick: () => void navigate(chaalLinks.game(id)) },
					});
				}
			}
			playSound("notify", sound);
		});
	}, [me, store, navigate, sound]);
}
