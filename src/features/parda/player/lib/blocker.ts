/**
 * The official store page of uBlock Origin Lite for each browser (PLAN 12.5, "Install
 * uBlock Origin Lite button"). A page can't install an extension, so these are links:
 * the viewer confirms in the store. The watch page's button picks one from the browser
 * (`blockerStore`) and otherwise links to the notice page's #ad-blocker section, which
 * lists all four.
 */
export const BLOCKER_STORES = [
	{
		browser: "Chrome",
		href: "https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh",
	},
	{
		browser: "Edge",
		href: "https://microsoftedge.microsoft.com/addons/detail/ublock-origin-lite/cimighlppcgcoapaliogpjjdehbnofhn",
	},
	{ browser: "Firefox", href: "https://addons.mozilla.org/firefox/addon/ublock-origin-lite/" },
	{ browser: "Safari", href: "https://apps.apple.com/app/ublock-origin-lite/id6745342698" },
] as const;

export type BlockerStore = (typeof BLOCKER_STORES)[number];

/** The section id the player's ad-blocker button links to without JavaScript. */
export const AD_BLOCKER_SECTION = "ad-blocker";

const store = (browser: BlockerStore["browser"]) =>
	BLOCKER_STORES.find((each) => each.browser === browser) as BlockerStore;

/**
 * The store for this browser, from its user agent; null where it can't take the
 * extension (phones and tablets, in-app browsers) or isn't recognised: the button then
 * keeps its link to the notice page. Order matters: Edge and Opera say "Chrome" too,
 * and every iOS browser is Safari underneath (and takes no Mac extension).
 */
export function blockerStore(userAgent: string): BlockerStore | null {
	const ua = userAgent;
	if (/Android|iPhone|iPad|iPod|Mobile|FBAN|FBAV|Instagram|; wv\)/i.test(ua)) return null;
	if (/Edg\//.test(ua)) return store("Edge");
	if (/Firefox\//.test(ua) && !/Seamonkey/i.test(ua)) return store("Firefox");
	if (/(Chrome|Chromium)\//.test(ua)) return store("Chrome");
	if (/Macintosh/.test(ua) && /Version\/[\d.]+.*Safari\//.test(ua)) return store("Safari");
	return null;
}
