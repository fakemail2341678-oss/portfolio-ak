import { localizedUrl, seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { CHAAL_NAME } from "../brand";
import { CHAAL_PATHS } from "../links";

/**
 * The play hub's head (a route option, so in every page's JavaScript: keep this module
 * small). Indexable, in the sitemap, as a WebApplication (PLAN 13.5, "SEO").
 */
export function chaalPlayHead() {
	const url = localizedUrl(CHAAL_PATHS.play, getLocale());
	const description = m.ch_play_description();
	return seo({
		title: m.ch_play_title(),
		siteName: CHAAL_NAME,
		description,
		path: CHAAL_PATHS.play,
		jsonLd: {
			"@type": "WebApplication",
			"@id": `${url}#app`,
			name: `${CHAAL_NAME}: ${m.ch_play_title()}`,
			url,
			description,
			applicationCategory: "GameApplication",
			operatingSystem: "Any",
			browserRequirements: "Requires JavaScript",
			offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
			inLanguage: getLocale(),
		},
	});
}
