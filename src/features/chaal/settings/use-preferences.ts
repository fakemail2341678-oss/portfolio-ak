import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { sessionQueryOptions } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { chaalKeys } from "../keys";
import { clearLocalPreferences, readLocalPreferences, subscribeLocal, writeLocalPreferences } from "./local";
import { type ChaalPreferences, DEFAULT_CHAAL_PREFERENCES } from "./preferences";
import { chaalPreferencesQueryOptions } from "./queries";

/** The server has no browser storage: it renders the session's preferences, else the defaults. */
const noLocal = () => null;

/** This browser's preferences (null on the server and during hydration, then the stored ones). */
const useLocalPreferences = () => useSyncExternalStore(subscribeLocal, readLocalPreferences, noLocal);

/**
 * The player's preferences and a way to change them (decision 0259). A session's are on
 * the server (the layout's loader read them, so the first paint is right); without a
 * session they're this browser's, read after hydration. `where` says which, for the
 * settings page.
 */
export function useChaalPreferences() {
	const queryClient = useQueryClient();
	const { data: session } = useQuery(sessionQueryOptions());
	const signedIn = Boolean(session);
	const { data: saved } = useQuery({ ...chaalPreferencesQueryOptions(), enabled: signedIn });
	const local = useLocalPreferences();
	const preferences = (signedIn ? (saved ?? local) : local) ?? DEFAULT_CHAAL_PREFERENCES;

	const save = async (change: Partial<ChaalPreferences>): Promise<boolean> => {
		const next = { ...preferences, ...change };
		if (!signedIn) {
			writeLocalPreferences(next);
			return true;
		}
		const key = chaalKeys.preferences();
		const before = queryClient.getQueryData<ChaalPreferences | null>(key);
		// Shown at once; put back if the server refuses.
		queryClient.setQueryData(key, next);
		try {
			const { saveChaalPreferences } = await import("@/functions/chaal/preferences");
			queryClient.setQueryData(key, await saveChaalPreferences({ data: { preferences: next } }));
			return true;
		} catch (error) {
			queryClient.setQueryData(key, before ?? null);
			toast.error(m.ch_settings_save_failed({ reason: errorMessage(error) }));
			return false;
		}
	};

	return { preferences, save, where: signedIn ? ("account" as const) : ("device" as const) };
}

/**
 * In the frame: when a session appears (sign-in, sign-up, a guest started to connect), this
 * browser's preferences go to it once, unless it already has its own, and the browser's copy
 * is forgotten.
 */
export function useImportLocalPreferences() {
	const queryClient = useQueryClient();
	const { data: session } = useQuery(sessionQueryOptions());
	const signedIn = Boolean(session);
	const { isSuccess } = useQuery({ ...chaalPreferencesQueryOptions(), enabled: signedIn });
	const local = useLocalPreferences();
	const running = useRef(false);
	useEffect(() => {
		if (!signedIn || !isSuccess || !local || running.current) return;
		running.current = true;
		import("@/functions/chaal/preferences")
			.then(({ importChaalPreferences }) => importChaalPreferences({ data: { preferences: local } }))
			.then((kept) => {
				queryClient.setQueryData(chaalKeys.preferences(), kept);
				clearLocalPreferences();
			})
			// Kept for the next page: nothing is lost by trying again.
			.catch(() => {})
			.finally(() => {
				running.current = false;
			});
	}, [signedIn, isSuccess, local, queryClient]);
}
