import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { sessionQueryOptions } from "@/features/auth/queries";
import { chaalKeys } from "../keys";
import { forgetBrowserAttempts, readBrowserAttempts, subscribeBrowserAttempts, writeBrowserAttempt } from "./browser";
import type { PuzzleAttempt } from "./schema";

const NONE: PuzzleAttempt[] = [];
const noAttempts = () => NONE;

/** This browser's attempts (none on the server and while hydrating, then the stored ones). */
export const useBrowserAttempts = () => useSyncExternalStore(subscribeBrowserAttempts, readBrowserAttempts, noAttempts);

/**
 * Records a finished puzzle where the player is (decision 0269): on the account with a
 * session (the progress panel reads again), else in this browser. An account write that
 * fails keeps it in the browser, which a later page imports.
 */
export function useRecordAttempt() {
	const queryClient = useQueryClient();
	const { data: session } = useQuery(sessionQueryOptions());
	const signedIn = Boolean(session);
	return async (attempt: PuzzleAttempt) => {
		if (!signedIn) {
			writeBrowserAttempt(attempt);
			return;
		}
		try {
			const { recordAttemptOnAccount } = await import("./queries");
			await recordAttemptOnAccount(attempt);
			await queryClient.invalidateQueries({ queryKey: chaalKeys.puzzleProgress() });
		} catch {
			writeBrowserAttempt(attempt);
		}
	};
}

/**
 * In the frame: when a session appears, this browser's attempts go to it and are forgotten
 * here once the account has them (nothing is lost by trying again on the next page).
 */
export function useImportPuzzleAttempts() {
	const queryClient = useQueryClient();
	const { data: session } = useQuery(sessionQueryOptions());
	const signedIn = Boolean(session);
	const attempts = useBrowserAttempts();
	const running = useRef(false);
	useEffect(() => {
		if (!signedIn || attempts.length === 0 || running.current) return;
		running.current = true;
		import("./queries")
			.then(({ importAttemptsToAccount }) => importAttemptsToAccount([...attempts]))
			.then(async ({ imported }) => {
				forgetBrowserAttempts(imported);
				await queryClient.invalidateQueries({ queryKey: chaalKeys.puzzleProgress() });
			})
			.catch(() => {})
			.finally(() => {
				running.current = false;
			});
	}, [signedIn, attempts, queryClient]);
}
