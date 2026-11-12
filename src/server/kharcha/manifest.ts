import "@tanstack/react-start/server-only";
import { KHARCHA_NAME } from "@/features/kharcha/brand";
import { m } from "@/paraglide/messages";
import { getTextDirection, type Locale, localizeHref } from "@/paraglide/runtime";

/**
 * Kharcha's web app manifest in one language (/app/kharcha/manifest.webmanifest and
 * the /ne one; the `_kharcha` layout links it, decision 0282): installed, it opens on
 * Kharcha's Home and stays inside /app/kharcha. Colours: the light theme's
 * background and the bookcloth red of the icon tile.
 */
export function kharchaManifest(locale: Locale) {
	return {
		id: "/app/kharcha",
		name: KHARCHA_NAME,
		short_name: KHARCHA_NAME,
		description: m.kharcha_landing_description({}, { locale }),
		lang: locale,
		dir: getTextDirection(locale),
		start_url: localizeHref("/app/kharcha/home", { locale }),
		scope: localizeHref("/app/kharcha", { locale }),
		display: "standalone",
		background_color: "#ffffff",
		theme_color: "#9e1f1a",
		icons: [
			{ src: "/kharcha/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/kharcha/icon-512.png", sizes: "512x512", type: "image/png" },
			{ src: "/kharcha/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
			{ src: "/kharcha/icon.svg", sizes: "any", type: "image/svg+xml" },
		],
	};
}
