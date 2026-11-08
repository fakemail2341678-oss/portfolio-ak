import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { sessionQueryOptions } from "@/features/auth/queries";
import { chaalKeys } from "../keys";
import { deleteBrowserGames, readBrowserGames, subscribeBrowserGames } from "./browser";
import type { LocalGameRecord } from "./types";

const NONE: LocalGameRecord[] = [];
const noGames = () => NONE;

const subscribeNothing = () => () => {};

/** False on the server and while hydrating, then true: what's in this browser can be read. */
export const useHydrated = () =>
	useSyncExternalStore(
		subscribeNothing,
		() => true,
		() => false,
	);

/** This browser's games (none on the server and during hydration, then the stored ones). */
export const useBrowserGames = () => useSyncExternalStore(subscribeBrowserGames, readBrowserGames, noGames);

/**
 * In the frame (decision 0265): when a session appears, this browser's games go to it and
 * are forgotten here once the account has them. A game the server refuses stays in the
 * browser (nothing is lost by trying again on the next page).
 */
export function useImportLocalGames() {
	const queryClient = useQueryClient();
	const { data: session } = useQuery(sessionQueryOptions());
	const signedIn = Boolean(session);
	const games = useBrowserGames();
	const running = useRef(false);
	useEffect(() => {
		if (!signedIn || games.length === 0 || running.current) return;
		running.current = true;
		import("./queries")
			.then(({ importLocalGamesToAccount }) => importLocalGamesToAccount([...games]))
			.then(async ({ imported }) => {
				deleteBrowserGames(imported);
				await queryClient.invalidateQueries({ queryKey: chaalKeys.localGames() });
			})
			// Kept for the next page: nothing is lost by trying again.
			.catch(() => {})
			.finally(() => {
				running.current = false;
			});
	}, [signedIn, games, queryClient]);
}
