import type { SeoImage } from "@/lib/seo";

/**
 * The portfolio's social image when a page has none of its own: the range at
 * dawn, rendered once from the art (public/himal/og.png, decision 0179). The
 * app's own og-default.png stays the template's, outside the portfolio layer.
 */
export const himalOgImage = (alt: string): SeoImage => ({ url: "/himal/og.png", width: 1200, height: 630, alt });
