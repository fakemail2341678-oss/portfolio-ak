import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { sessionQueryOptions } from "@/features/auth/queries";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";

/**
 * The player's Lichess id when they follow their events: a session connected for play
 * (not revoked, with play's scopes) while play is on; null otherwise. Known on the server's
 * first paint (the layout's loader reads the status and the connection), so what depends on
 * it (the bell, Task 78) is drawn there too.
 */
export function useLiveAccount(): string | null {
	const { data: session } = useQuery(sessionQueryOptions());
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { data: connection } = useQuery({ ...chaalConnectionQueryOptions(), enabled: Boolean(session) });
	const ready =
		Boolean(session) &&
		status?.features.play !== false &&
		connection != null &&
		!connection.revoked &&
		!connection.needsScopesFor.includes("play");
	return ready ? (connection?.lichessId ?? null) : null;
}

/**
 * Follows the player's Lichess events from any Chaal page (decision 0266), for a session
 * connected for play while play is on: the challenges, the games in progress, and fair
 * play's lock. The client (the tab leader and its stream) loads only then, with
 * `await import()`, so the frame stays light for everyone else.
 */
export function useLiveEvents(): void {
	const account = useLiveAccount();

	useEffect(() => {
		if (!account) return;
		let stop: (() => void) | undefined;
		let gone = false;
		void import("./events-client").then(({ startLiveEvents }) => {
			if (!gone) stop = startLiveEvents();
		});
		return () => {
			gone = true;
			stop?.();
		};
	}, [account]);
}
