import type { SectionBrand } from "@/lib/section-brand";
import { NOINDEX } from "@/lib/seo";
import { localizeHref } from "@/paraglide/runtime";

/**
 * Taskline's brand (decision 0208): a product of its own inside the app, with its
 * name, accent, icons, manifest and title suffix. The name is a brand, the same in
 * every language (as VITE_APP_TITLE).
 */
export const TASKLINE_NAME = "Taskline";

/** Title template inside Taskline: "Page · Taskline". */
export const tasklineTitle = (page?: string): string => (page ? `${page} · ${TASKLINE_NAME}` : TASKLINE_NAME);

/** A private Taskline page's head: its title (the layout makes every page noindex; this repeats it for the pages that render alone). */
export const tasklineHead = (page?: string) => ({ meta: [{ title: tasklineTitle(page) }, NOINDEX] });

/** On the `_taskline` layout: the root puts the accent on <html> and links these instead of the app's icons. */
export const TASKLINE_BRAND: SectionBrand = {
	id: "taskline",
	accent: "emerald",
	links: () => [
		{ rel: "icon", type: "image/svg+xml", href: "/taskline/icon.svg" },
		{ rel: "icon", type: "image/png", sizes: "32x32", href: "/taskline/favicon-32.png" },
		{ rel: "apple-touch-icon", href: "/taskline/apple-touch-icon.png" },
		{ rel: "manifest", href: localizeHref("/app/taskline/manifest.webmanifest") },
	],
};
