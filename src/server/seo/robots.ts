import "@tanstack/react-start/server-only";
import { absoluteUrl } from "@/lib/seo";
import { baseLocale, locales } from "@/paraglide/runtime";

/**
 * robots.txt: everything public is crawlable; the admin area and machine
 * endpoints aren't. Other private pages (sign-in, account, health, dev) stay
 * crawlable on purpose so crawlers can read their `noindex`.
 */
export function robotsTxt(): string {
	const prefixes = locales.filter((locale) => locale !== baseLocale).map((locale) => `/${locale}`);
	const disallow = ["/admin", ...prefixes.map((prefix) => `${prefix}/admin`), "/api/", "/_serverFn/"];
	return [
		"User-agent: *",
		"Allow: /",
		...disallow.map((path) => `Disallow: ${path}`),
		"",
		`Sitemap: ${absoluteUrl("/sitemap.xml")}`,
		"",
	].join("\n");
}
