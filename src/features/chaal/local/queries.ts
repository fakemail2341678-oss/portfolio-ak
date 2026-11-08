import { queryOptions } from "@tanstack/react-query";
import {
	deleteChaalLocalGame,
	getChaalLocalGame,
	importChaalLocalGames,
	listChaalLocalGames,
	saveChaalLocalGame,
} from "@/functions/chaal/local-games";
import { chaalKeys } from "../keys";
import type { LocalGameRecord } from "./types";

/**
 * Local games on the account (Task 76): the history and one game. The play hub's loader
 * ensures the history for a session, and a game's page its game; without a session both
 * come from this browser (`browser.ts`) instead.
 */
export const localGamesQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.localGames(), queryFn: () => listChaalLocalGames() });

export const localGameQueryOptions = (id: string) =>
	queryOptions({
		queryKey: chaalKeys.localGame(id),
		queryFn: () => getChaalLocalGame({ data: { id } }),
		// The page writes the game as it's played; a refetch would only bring back what it sent.
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});

export const saveLocalGameOnAccount = (game: LocalGameRecord) => saveChaalLocalGame({ data: { game } });
export const deleteLocalGameOnAccount = (id: string) => deleteChaalLocalGame({ data: { id } });
export const importLocalGamesToAccount = (games: LocalGameRecord[]) => importChaalLocalGames({ data: { games } });
