/**
 * Recipe (docs/guides/recipes.md, "Caching public pages"; decision 0147): the
 * Cache-Control value for a public page the CDN may keep. Browsers revalidate
 * every time (`max-age=0`); the CDN serves its copy for `sMaxAge` seconds and,
 * for `staleWhileRevalidate` more, serves the old copy while it refetches.
 *
 * Only for pages that look the same to everyone: never a page that reads the
 * session, a cookie preference (theme, sidebar) or a per-request value. Note the
 * CSP nonce is per request, so a cached page reuses one nonce for every visitor
 * until it expires; that keeps working, but it is why only public, static pages qualify.
 */
export const publicCache = ({ sMaxAge, staleWhileRevalidate }: { sMaxAge: number; staleWhileRevalidate: number }) =>
	`public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
