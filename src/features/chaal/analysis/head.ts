import { localizedUrl, seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { CHAAL_NAME } from "../brand";
import { CHAAL_PATHS } from "../links";

/**
 * The analysis board's head (a route option, so in every page's JavaScript: keep this
 * module small). Indexable, in the sitemap, as a WebApplication (PLAN 13.5, "SEO"); a link
 * to a position shares the canonical address without its search.
 */
export function chaalAnalysisHead() {
	const url = localizedUrl(CHAAL_PATHS.analysis, getLocale());
	const description = m.ch_analysis_description();
	return seo({
		title: m.ch_analysis_title(),
		siteName: CHAAL_NAME,
		description,
		path: CHAAL_PATHS.analysis,
		jsonLd: {
			"@type": "WebApplication",
			"@id": `${url}#app`,
			name: `${CHAAL_NAME}: ${m.ch_analysis_title()}`,
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
