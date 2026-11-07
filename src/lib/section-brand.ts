import { useMatches } from "@tanstack/react-router";
import type { AccentPreference, ThemePreference } from "@/lib/stores/preferences";

/**
 * A section that is its own product (Taskline, decision 0208) brands the whole
 * document, not just its frame:
 *
 *   staticData: { brand: TASKLINE_BRAND }
 *
 * The root then puts the section's id on `<html data-section>` and its accent on
 * `<html data-accent>` (so dialogs and menus, which portal to <body>, and the tokens
 * derived from `--primary` match it), resolves the theme with its default scheme,
 * and links the section's icons and manifest instead of the app's.
 */
export type SectionBrand = {
	/** Rendered as `<html data-section>`, so the section's stylesheet can scope itself to the whole document. */
	id: string;
	/** The section's accent, whatever accent the visitor picked for the admin area. */
	accent: AccentPreference;
	/** Its favicons, touch icon and manifest (the root's head links them in place of the app's). */
	links: () => Array<{ rel: string; href: string; type?: string; sizes?: string }>;
	/** What "system" means here; an explicit Light or Dark still wins (decision 0232). */
	defaultScheme?: "dark";
	/** The browser UI's colours, when the section's ground isn't Graphite's. */
	themeColors?: { light: string; dark: string };
};

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		/** This section's brand: accent, icons and manifest. */
		brand?: SectionBrand;
	}
}

type Match = { staticData: { brand?: SectionBrand | undefined } };

/** The deepest matched section's brand, if any. `matches` is undefined where a head is computed without them (tests). */
export const sectionBrandOf = (matches: ReadonlyArray<Match> | undefined): SectionBrand | undefined => {
	for (const match of [...(matches ?? [])].reverse()) if (match.staticData.brand) return match.staticData.brand;
	return undefined;
};

/** What the document needs of the deepest matched section's brand (a selection can't carry its `links` function). */
export const useSectionBrand = () =>
	useMatches({
		select: (matches) => {
			const brand = sectionBrandOf(matches);
			if (!brand) return undefined;
			const { id, accent, defaultScheme, themeColors } = brand;
			return { id, accent, defaultScheme, themeColors };
		},
		structuralSharing: true,
	});

/**
 * The theme in force: the preference, with "system" resolved to the section's default
 * scheme. It's known on the server, so the first byte is right, with nothing to flash.
 */
export const sectionTheme = (
	theme: ThemePreference,
	brand: { defaultScheme?: "dark" | undefined } | undefined,
): ThemePreference => (theme === "system" && brand?.defaultScheme ? brand.defaultScheme : theme);
