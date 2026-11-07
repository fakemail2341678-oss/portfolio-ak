import type { WebSite } from "schema-dts";
import { getLocale, localizeHref } from "@/paraglide/runtime";
import { clientEnv } from "./env/client";
import { absoluteUrl } from "./seo";

/**
 * schema.org objects for seo({ jsonLd }). Types come from schema-dts, so a
 * misspelt property or a wrong value type fails typecheck. BreadcrumbList is
 * built by <Breadcrumbs jsonLd> (src/lib/breadcrumbs.ts); the portfolio's
 * Person, case studies and articles are in src/features/portfolio/lib/structured-data.ts.
 */

/** The site itself, in the current language (home page). `publisher` is the @id of who runs it. */
export const websiteJsonLd = (description: string, publisher?: string): Exclude<WebSite, string> => ({
	"@type": "WebSite",
	"@id": absoluteUrl(`${localizeHref("/")}#website`),
	name: clientEnv.VITE_APP_TITLE,
	description,
	url: absoluteUrl(localizeHref("/")),
	inLanguage: getLocale(),
	...(publisher ? { publisher: { "@id": publisher } } : {}),
});
