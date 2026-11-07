import { localizedUrl, seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { PARDA_NAME } from "../brand";
import { PARDA_PATHS } from "../links";
import type { PardaHub, PardaPage } from "../search";

/**
 * The home's and the hubs' heads (route options, so in every page's JavaScript: keep
 * this module small). Indexable, in the sitemap. The billboard preloads its own first
 * picture (`preloadHero`, decision 0245).
 */

const HUB_TITLES: Readonly<Record<PardaHub, () => string>> = {
	movies: m.pd_hub_movies,
	series: m.pd_hub_series,
	anime: m.pd_hub_anime,
};

const DESCRIPTIONS: Readonly<Record<PardaPage, () => string>> = {
	home: m.pd_description,
	movies: m.pd_hub_movies_description,
	series: m.pd_hub_series_description,
	anime: m.pd_hub_anime_description,
};

export const hubTitle = (hub: PardaHub) => HUB_TITLES[hub]();

const pathOf = (page: PardaPage) => (page === "home" ? PARDA_PATHS.home : PARDA_PATHS.hub(page));

export function pardaPageHead(page: PardaPage) {
	const path = pathOf(page);
	const description = DESCRIPTIONS[page]();
	const title = page === "home" ? m.pd_home_title() : hubTitle(page);
	const home = localizedUrl(PARDA_PATHS.home, getLocale());
	const head = seo({
		title,
		siteName: PARDA_NAME,
		description,
		path,
		jsonLd:
			page === "home"
				? {
						"@type": "WebSite",
						"@id": `${home}#website`,
						name: PARDA_NAME,
						url: home,
						description,
						inLanguage: getLocale(),
					}
				: {
						"@type": "CollectionPage",
						name: title,
						description,
						url: localizedUrl(path, getLocale()),
						inLanguage: getLocale(),
						isPartOf: { "@id": `${home}#website` },
					},
	});
	return head;
}

/** Discover's head (Task 66): indexable; every filtered address names the bare page as canonical. */
export function pardaDiscoverHead() {
	const home = localizedUrl(PARDA_PATHS.home, getLocale());
	const title = m.pd_discover_title();
	const description = m.pd_discover_description();
	return seo({
		title,
		siteName: PARDA_NAME,
		description,
		path: PARDA_PATHS.discover,
		jsonLd: {
			"@type": "CollectionPage",
			name: title,
			description,
			url: localizedUrl(PARDA_PATHS.discover, getLocale()),
			inLanguage: getLocale(),
			isPartOf: { "@id": `${home}#website` },
		},
	});
}
