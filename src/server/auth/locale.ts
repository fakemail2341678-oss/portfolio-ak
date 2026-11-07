import { LOCALE_HEADER } from "@/lib/i18n/locale-header";
import { extractLocaleFromUrl, getLocale, type Locale, toLocale } from "@/paraglide/runtime";

/**
 * The language to send an auth email in, from most to least specific:
 * 1. The x-paraglide-locale header the auth client sends (the page the user is on).
 * 2. The locale of the request's callbackURL (/ne/... is Nepali, unprefixed is
 *    English). Email links are opened by the browser without our header, but
 *    carry the localized callback the user started from.
 * 3. getLocale() for the current request (Paraglide middleware; English by default).
 */
export const resolveEmailLocale = (request: Request | undefined): Locale => {
	const fromHeader = toLocale(request?.headers.get(LOCALE_HEADER) ?? undefined);
	if (fromHeader) return fromHeader;

	const callbackURL = request ? new URL(request.url).searchParams.get("callbackURL") : null;
	if (callbackURL?.startsWith("/") && !callbackURL.startsWith("//")) {
		const fromCallback = extractLocaleFromUrl(new URL(callbackURL, "http://localhost"));
		if (fromCallback) return fromCallback;
	}

	return getLocale();
};
