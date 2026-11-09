import { useRouterState } from "@tanstack/react-router";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useChaalPreferences } from "../settings/use-preferences";

/** A page where a game is played: a game on Lichess or a local one (either language's path). */
export const PLAY_PAGE = /^(\/ne)?\/app\/chaal\/(game|local)\/[^/]+\/?$/;

/**
 * Zen mode (PLAN 13.6, "Calm"; Task 78): while a game is played, only the board, the clocks
 * and the names; the frame's bars, the footer, the move lists and the side column go. It's
 * the player's `zen` preference, so it's on the server's first paint (a session's) and stays
 * between games; `z` (or the page's button) turns it on and off on a game's page.
 */
export function useZen(): { zen: boolean; playing: boolean; toggle: () => void } {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const { preferences, save } = useChaalPreferences();
	const playing = PLAY_PAGE.test(pathname);
	return { zen: playing && preferences.zen, playing, toggle: () => save({ zen: !preferences.zen }) };
}

/** `z` on a game's page (the frame listens; the shortcuts list says it). */
export function useZenKey(): void {
	const { playing, toggle } = useZen();
	useHotkeys({ z: () => toggle() }, { enabled: playing });
}
