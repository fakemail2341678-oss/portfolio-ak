import { localizedUrl, seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { CHAAL_NAME } from "../brand";
import { CHAAL_PATHS } from "../links";

/**
 * The home's head (a route option, so in every page's JavaScript: keep this module small).
 * Indexable, in the sitemap, with Chaal as a WebApplication (PLAN 13.5, "SEO").
 */
export function chaalHomeHead() {
	const url = localizedUrl(CHAAL_PATHS.home, getLocale());
	const description = m.ch_description();
	return seo({
		title: m.ch_home_title(),
		siteName: CHAAL_NAME,
		description,
		path: CHAAL_PATHS.home,
		jsonLd: {
			"@type": "WebApplication",
			"@id": `${url}#app`,
			name: CHAAL_NAME,
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
