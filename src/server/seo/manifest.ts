import "@tanstack/react-start/server-only";
import { clientEnv } from "@/lib/env/client";
import { m } from "@/paraglide/messages";
import { getTextDirection, type Locale, localizeHref } from "@/paraglide/runtime";

/**
 * The web app manifest in one language (/manifest.webmanifest and
 * /ne/manifest.webmanifest; the root head links the current one). Colours match
 * the light theme's --background and the icon tile.
 */
export function webManifest(locale: Locale) {
	return {
		name: clientEnv.VITE_APP_TITLE,
		short_name: clientEnv.VITE_APP_TITLE,
		description: m.site_description({}, { locale }),
		lang: locale,
		dir: getTextDirection(locale),
		start_url: localizeHref("/", { locale }),
		scope: "/",
		display: "standalone",
		background_color: "#ffffff",
		theme_color: "#18181b",
		icons: [
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/icon-512.png", sizes: "512x512", type: "image/png" },
			{ src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
			{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
		],
	};
}
