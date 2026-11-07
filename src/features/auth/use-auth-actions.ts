import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { localizeHref } from "@/paraglide/runtime";
import { refreshAuth } from "./queries";

/**
 * After Better Auth changes the session cookie (sign in/out), refresh cached
 * auth state and re-run route guards, then go to `to` (a validated same-site path).
 * `signedOutTo` is where signing out lands (de-localized): the home page, or a
 * section's own landing (Taskline's).
 */
export function useAuthNavigation({ signedOutTo = "/" }: { signedOutTo?: string } = {}) {
	const router = useRouter();
	const queryClient = useQueryClient();

	const refresh = async () => {
		await refreshAuth(queryClient);
		await router.invalidate();
	};

	return {
		refresh,
		/**
		 * After signing in (with two-factor too). `to` is de-localized (e.g. "/account"); the
		 * router re-prefixes it. A guest who signed in keeps their data (decision 0186).
		 */
		afterSignIn: async (to: string) => {
			await claimGuestDataQuietly();
			await refreshAuth(queryClient);
			await router.navigate({ href: localizeHref(to), replace: true });
		},
		signOut: async () => {
			// Loaded on demand: this hook is used by headers on every page, and the auth
			// client (about 11 kB gzip) is only needed once someone signs out.
			const { authClient } = await import("@/lib/auth-client");
			await authClient.signOut();
			await refreshAuth(queryClient);
			await router.navigate({ href: localizeHref(signedOutTo), replace: true });
		},
	};
}

/**
 * Moves this browser's guest data to the account just signed in to (src/functions/guests.ts).
 * Loaded on demand like the auth client. A failure never blocks signing in: the guest
 * stays until the next try or the weekly cleanup.
 */
export async function claimGuestDataQuietly(): Promise<void> {
	try {
		const { claimGuestData } = await import("@/functions/guests");
		await claimGuestData();
	} catch {
		// Nothing to undo: the sign-in itself succeeded.
	}
}

/** A localized absolute path for Better Auth callbackURL / redirectTo options. */
export const localizedPath = (path: string) => localizeHref(path);
