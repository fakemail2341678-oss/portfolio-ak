import { localizedUrl, seo } from "@/lib/seo";
import { getLocale } from "@/paraglide/runtime";
import { CHAAL_NAME } from "./brand";

/**
 * An indexable Chaal page's head (PLAN 13.5, "SEO"): `seo()` with Chaal's name and the page
 * as a WebApplication. A route option, so in every page's JavaScript: one helper for the
 * home, play, analysis and puzzles (Task 80 merged their four copies), kept small. A page's
 * search (a position, a training choice) shares the canonical address without it.
 */
export function chaalPageHead(path: string, title: string, description: string, name = `${CHAAL_NAME}: ${title}`) {
	const url = localizedUrl(path, getLocale());
	return seo({
		title,
		siteName: CHAAL_NAME,
		description,
		path,
		jsonLd: {
			"@type": "WebApplication",
			"@id": `${url}#app`,
			name,
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
