import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authErrorMessage } from "@/features/auth/errors";
import { refreshAuth, sessionQueryOptions } from "@/features/auth/queries";
import { setGuestScope } from "@/lib/guests";
import { m } from "@/paraglide/messages";

/**
 * Makes sure there's a session before a personal write (saving an analysis, Task 75): true
 * when there is one, after starting a guest scoped to Chaal if needed (`guest_scope`, which
 * seeds nothing). A guest's saved work moves to the account it signs up or in as
 * (src/server/chaal/guest-data.ts).
 */
export function useEnsureChaalSession() {
	const queryClient = useQueryClient();
	const { data: session } = useQuery(sessionQueryOptions());
	return async (): Promise<boolean> => {
		if (session) return true;
		const { authClient } = await import("@/lib/auth-client");
		setGuestScope("chaal");
		const { error } = await authClient.signIn.anonymous();
		if (error) {
			toast.error(error.status === 429 ? m.ch_guest_rate_limited() : authErrorMessage(error));
			return false;
		}
		await refreshAuth(queryClient);
		return true;
	};
}
