import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { authErrorMessage } from "@/features/auth/errors";
import { refreshAuth, sessionQueryOptions } from "@/features/auth/queries";
import { setGuestScope } from "@/lib/guests";
import { m } from "@/paraglide/messages";
import { clearLocalProgress, hasLocalProgress, readLocalProgress } from "./local";
import { refreshLibrary } from "./queries";

/**
 * Parda's sessions (PLAN 12.5, "Guests"; decision 0236). Watching needs none: progress
 * stays in the browser. A library action (a mark, *Remove*, *Rewatch*) needs one, so it
 * starts a guest first, scoped to Parda (`guest_scope`), and the browser's progress is
 * brought in once a session exists, however it started.
 */

/** Brings the browser's progress into the session's profile, once, then forgets it. */
async function importLocal(): Promise<void> {
	const entries = readLocalProgress();
	if (entries.length === 0) {
		clearLocalProgress();
		return;
	}
	const { importPardaProgress } = await import("@/functions/parda/library");
	await importPardaProgress({
		data: {
			entries: entries.map((entry) => ({
				media: entry.media,
				id: entry.id,
				...(entry.media === "tv" ? { season: entry.season ?? 1, episode: entry.episode ?? 1 } : {}),
				watched: entry.watched,
				duration: entry.duration,
				updatedAt: Math.round(entry.updatedAt),
			})),
		},
	});
	clearLocalProgress();
}

/** In the frame: a session that appears (sign-in, sign-up, a guest) takes this browser's progress. */
export function useImportLocalProgress() {
	const { data: session } = useQuery(sessionQueryOptions());
	const queryClient = useQueryClient();
	const running = useRef(false);
	const signedIn = Boolean(session);
	useEffect(() => {
		if (!signedIn || running.current || !hasLocalProgress()) return;
		running.current = true;
		importLocal()
			.then(() => refreshLibrary(queryClient))
			// Kept for the next page: nothing is lost by trying again.
			.catch(() => {})
			.finally(() => {
				running.current = false;
			});
	}, [signedIn, queryClient]);
}

/**
 * Returns a function that makes sure there's a session before a library write: true
 * when there is one (a guest started if needed). While a player is on the page, only the
 * auth queries refresh, so the iframe isn't remounted (PLAN 12.5, "Auth refresh").
 */
export function useEnsureViewer({ playerMounted = false }: { playerMounted?: boolean } = {}) {
	const queryClient = useQueryClient();
	const router = useRouter();
	const { data: session } = useQuery(sessionQueryOptions());
	return async (): Promise<boolean> => {
		if (session) return true;
		const { authClient } = await import("@/lib/auth-client");
		setGuestScope("parda");
		const { error } = await authClient.signIn.anonymous();
		if (error) {
			toast.error(error.status === 429 ? m.pd_guest_rate_limited() : authErrorMessage(error));
			return false;
		}
		try {
			await importLocal();
		} catch {
			// The frame's hook tries again on the next page.
		}
		await refreshAuth(queryClient);
		if (!playerMounted) await router.invalidate();
		return true;
	};
}
