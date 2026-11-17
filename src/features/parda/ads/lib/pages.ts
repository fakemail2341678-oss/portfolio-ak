/**
 * Parda's pages that show ads (decision 0301): the ones a visitor browses, in both
 * languages. Not where they watch or sign in:
 * - the player and a watch party (a popunder or a vignette over a film is the worst place);
 * - signing in and up, the account and the profiles (forms).
 * A kids' profile sees none anywhere (`usePardaAds`).
 *
 * Plain data with no import: the CSP middleware and the browser read the same rule.
 */
const PARDA = /^\/app\/parda(?:\/|$)/;
const NO_ADS = /^\/app\/parda\/(?:watch|party|sign-in|sign-up|account|profiles)(?:\/|$)/;

/** Whether ads may show at `pathname` (`/ne/app/parda/search` and `/app/parda/search` alike). */
export const isPardaAdPath = (pathname: string): boolean => {
	const path = pathname.replace(/^\/ne(?=\/|$)/, "") || "/";
	return PARDA.test(path) && !NO_ADS.test(path);
};
