import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import type { SearchPatch } from "./search-link";

/**
 * Closes a dialog that is a URL state of the page beneath it (a masked route such
 * as the admin edit dialog or the public quick view).
 *
 * Opening pushed a history entry, so closing goes back: the page beneath is
 * restored exactly (filters, scroll) and Back after closing doesn't reopen the
 * dialog. If there's nothing to go back to, the dialog's param is removed instead.
 * Unsaved-changes guards still apply: blockers see the back navigation.
 */
export function useCloseOverlay(remove: SearchPatch) {
	const router = useRouter();
	const canGoBack = useCanGoBack();
	const navigate = useNavigate();
	return () => {
		if (canGoBack) router.history.back();
		else void navigate({ to: ".", search: (prev: SearchPatch) => ({ ...prev, ...remove }), replace: true });
	};
}
