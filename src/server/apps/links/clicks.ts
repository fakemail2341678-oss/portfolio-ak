import "@tanstack/react-start/server-only";
import type { LinkDevice } from "@/features/apps/links/types";

/**
 * What a click records (decision 0191), from the redirect's request headers: no IP
 * and no user agent are kept, only a device class, the referrer's host and a country.
 */

const BOT =
	/bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl|wget|python|go-http|headless/i;
const TABLET = /ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i;
const MOBILE = /mobi|iphone|ipod|android|blackberry|opera mini|iemobile|windows phone/i;

/** "bot" for crawlers and link previews, else tablet, mobile or desktop (the default, also for no header). */
export function deviceClass(userAgent: string | null): LinkDevice {
	if (!userAgent) return "desktop";
	if (BOT.test(userAgent)) return "bot";
	if (TABLET.test(userAgent)) return "tablet";
	if (MOBILE.test(userAgent)) return "mobile";
	return "desktop";
}

/** The Referer's host ("news.ycombinator.com", without "www."), or null for none or an unreadable one. */
export function referrerHost(referer: string | null): string | null {
	if (!referer) return null;
	try {
		const { protocol, hostname } = new URL(referer);
		if (protocol !== "http:" && protocol !== "https:") return null;
		return (
			hostname
				.toLowerCase()
				.replace(/^www\./, "")
				.slice(0, 253) || null
		);
	} catch {
		return null;
	}
}

/** Vercel's `x-vercel-ip-country` when it's a two-letter code, else null (local runs, other hosts). */
export function countryCode(header: string | null): string | null {
	const code = header?.trim().toUpperCase() ?? "";
	return /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : null;
}

export type ClickFacts = { referrerHost: string | null; country: string | null; device: LinkDevice };

export const clickFacts = (headers: Headers): ClickFacts => ({
	referrerHost: referrerHost(headers.get("referer")),
	country: countryCode(headers.get("x-vercel-ip-country")),
	device: deviceClass(headers.get("user-agent")),
});
