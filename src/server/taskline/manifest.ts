import "@tanstack/react-start/server-only";
import { TASKLINE_NAME } from "@/features/taskline/brand";
import { m } from "@/paraglide/messages";
import { getTextDirection, type Locale, localizeHref } from "@/paraglide/runtime";

/**
 * Taskline's web app manifest in one language (/app/taskline/manifest.webmanifest and
 * the /ne one; the `_taskline` layout links it, decision 0208): installed, it opens on
 * Taskline's Home and stays inside /app/taskline. Colours: the light theme's
 * background and the emerald accent of the icon tile.
 */
export function tasklineManifest(locale: Locale) {
	return {
		id: "/app/taskline",
		name: TASKLINE_NAME,
		short_name: TASKLINE_NAME,
		description: m.taskline_landing_description({}, { locale }),
		lang: locale,
		dir: getTextDirection(locale),
		start_url: localizeHref("/app/taskline/home", { locale }),
		scope: localizeHref("/app/taskline", { locale }),
		display: "standalone",
		background_color: "#fdfdfe",
		theme_color: "#0b7a5a",
		icons: [
			{ src: "/taskline/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/taskline/icon-512.png", sizes: "512x512", type: "image/png" },
			{ src: "/taskline/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
			{ src: "/taskline/icon.svg", sizes: "any", type: "image/svg+xml" },
		],
	};
}
