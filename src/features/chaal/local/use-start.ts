import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { sessionQueryOptions } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { chaalKeys } from "../keys";
import { chaalLinks } from "../links";
import { writeBrowserGame } from "./browser";
import { newLocalGame, toRecord } from "./game";
import type { LocalSetup } from "./types";

/**
 * Starts a local game and opens its page (decision 0265): the id is made here, the game is
 * written where it will live (the account with a session, this browser without, or the
 * browser when the account can't be reached), then the page reads it from there.
 */
export function useStartLocalGame() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { data: session } = useQuery(sessionQueryOptions());
	const signedIn = Boolean(session);
	return async (setup: LocalSetup) => {
		const record = toRecord(newLocalGame(setup, crypto.randomUUID(), new Date()));
		if (signedIn) {
			try {
				const { saveLocalGameOnAccount } = await import("./queries");
				await saveLocalGameOnAccount(record);
				queryClient.setQueryData(chaalKeys.localGame(record.id), record);
				void queryClient.invalidateQueries({ queryKey: chaalKeys.localGames(), exact: true });
			} catch {
				if (!writeBrowserGame(record)) {
					toast.error(m.ch_local_not_started());
					return;
				}
			}
		} else if (!writeBrowserGame(record)) {
			toast.error(m.ch_local_not_started());
			return;
		}
		await navigate(chaalLinks.local(record.id));
	};
}
