import { useQuery } from "@tanstack/react-query";
import { useBlocker, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { sessionQueryOptions } from "@/features/auth/queries";
import { adsConfigured, adsLoaded, loadAds, removeAds } from "@/lib/ads/monetag";
import { usePreferences } from "@/lib/stores/use-stores";
import { localizeHref } from "@/paraglide/runtime";
import { pardaViewerQueryOptions } from "../../library/queries";
import { isPardaAdPath } from "../lib/pages";

/**
 * Ads in Parda (decision 0301), from its layout:
 * - on the pages `isPardaAdPath` names, once the visitor has accepted the consent banner,
 *   and never for a kids' profile (switching to one takes them away, push included);
 * - leaving an ad page for one without ads (the player, a party, a form, another section)
 *   is a full page load, so no ad script follows the visitor there.
 */
export function usePardaAds() {
	const router = useRouter();
	const pathname = useLocation({ select: (location) => location.pathname });
	const consent = usePreferences((preferences) => preferences.analyticsConsent);
	const { data: session } = useQuery({ ...sessionQueryOptions(), enabled: adsConfigured });
	const { data: viewer } = useQuery({ ...pardaViewerQueryOptions(), enabled: adsConfigured && Boolean(session) });
	const kids = viewer?.profile?.kids === true;

	useEffect(() => {
		if (!adsConfigured) return;
		if (kids) {
			void removeAds();
			return;
		}
		if (consent === "granted" && isPardaAdPath(pathname)) loadAds();
	}, [consent, kids, pathname]);

	useBlocker({
		shouldBlockFn: ({ next }) => {
			if (!adsLoaded() || isPardaAdPath(next.pathname)) return false;
			const search = router.options.stringifySearch(next.search);
			window.location.assign(localizeHref(`${next.pathname}${search}`));
			return true;
		},
		enableBeforeUnload: false,
	});
}
