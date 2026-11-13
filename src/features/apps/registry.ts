import { CalendarCheckIcon, ClipboardListIcon, Link2Icon, type LucideIcon, NotebookTextIcon } from "lucide-react";
import { m } from "@/paraglide/messages";

/**
 * The showcase apps (decision 0187), what pages show of them: the /apps gallery, the
 * app switcher, the sitemap and /admin/apps read this list. The server half
 * (src/server/apps/registry.ts) holds each app's guest data and usage.
 *
 * An app lives at /apps/<slug>: a landing there (indexable) that becomes the app once
 * the visitor has a session, its inner pages private. A portfolio project links to it
 * by naming the slug in its "App" field. (Expenses moved into Kharcha, decision 0289.)
 */
export const APP_SLUGS = ["notes", "links", "habits", "forms"] as const;
export type AppSlug = (typeof APP_SLUGS)[number];

export type AppEntry = {
	slug: AppSlug;
	name: () => string;
	/** One line, for cards and menus. */
	tagline: () => string;
	/** A paragraph, for the landing page and its description. */
	description: () => string;
	icon: LucideIcon;
	/** Labels of the row counts in /admin/apps (the keys of its usage `rows`). */
	rows: Record<string, () => string>;
};

export const APPS: ReadonlyArray<AppEntry> = [
	{
		slug: "notes",
		name: m.notes_name,
		tagline: m.notes_tagline,
		description: m.notes_description,
		icon: NotebookTextIcon,
		rows: { notes: m.notes_usage_notes, shared: m.notes_usage_shared, images: m.notes_usage_images },
	},
	{
		slug: "links",
		name: m.links_name,
		tagline: m.links_tagline,
		description: m.links_description,
		icon: Link2Icon,
		rows: { links: m.links_usage_links, clicks: m.links_usage_clicks },
	},
	{
		slug: "habits",
		name: m.habits_name,
		tagline: m.habits_tagline,
		description: m.habits_description,
		icon: CalendarCheckIcon,
		rows: { habits: m.habits_usage_habits, checkins: m.habits_usage_checkins },
	},
	{
		slug: "forms",
		name: m.forms_name,
		tagline: m.forms_tagline,
		description: m.forms_description,
		icon: ClipboardListIcon,
		rows: { forms: m.forms_usage_forms, published: m.forms_usage_published, responses: m.forms_usage_responses },
	},
];

/** An app's landing: /apps/<slug>. */
export const appPath = <S extends AppSlug>(slug: S) => `/apps/${slug}` as const;

export const isAppSlug = (value: string | null | undefined): value is AppSlug =>
	APP_SLUGS.some((slug) => slug === value);

export const appBySlug = (slug: AppSlug): AppEntry => {
	const app = APPS.find((entry) => entry.slug === slug);
	if (!app) throw new Error(`Unknown app: ${slug}`);
	return app;
};
