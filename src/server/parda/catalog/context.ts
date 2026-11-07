import "@tanstack/react-start/server-only";
import { getCookie, getRequest, getRequestHeader } from "@tanstack/react-start/server";
import { isTmdbRegion } from "@/features/parda/profiles/options";
import { isAppError } from "@/lib/errors";
import { todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import type { Localized } from "@/lib/i18n/localized";
import type { Session } from "@/lib/session";
import { clientIpHash, trustedClientIp } from "@/server/auth/client-ip";
import { db } from "@/server/db/client";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { browsingProfile, PROFILE_COOKIE } from "../profiles/service";
import { pardaCache, pardaControls, pardaTmdb } from "../tmdb/store";
import type { CatalogScope, CatalogServices } from "./service";

/**
 * What `withPardaCatalog` hands a catalogue function (PLAN 12.5): the services, and the
 * scope's region and cap, and the profile's players' language. Null when TMDB_READ_TOKEN
 * is unset: the page then says the catalogue isn't configured.
 */
export type PardaCatalog = {
	services: CatalogServices;
	region: string;
	cap: string | null;
	/** The profile's audio language for players (`{lang}`), when it chose one. */
	audioLanguage?: string | null;
};

/**
 * The region (decision 0240): the profile's, else the visitor's country (Vercel's
 * `x-vercel-ip-country`) when TMDB has data for it, else the admin's.
 */
export function regionFor(profileRegion: string | null | undefined, country: string | undefined, fallback: string) {
	if (profileRegion) return profileRegion;
	const upper = country?.trim().toUpperCase();
	return isTmdbRegion(upper) ? upper : fallback;
}

/**
 * Calls over HTTP without a session, per IP (decision 0234). A page load reads the
 * catalogue inside its own request, through the cache, so only direct calls count:
 * client-side navigation stays far below this, and a script walking the catalogue doesn't.
 */
const ANONYMOUS_LIMIT = { max: 300, windowSeconds: 300 } as const;

const isServerFunctionCall = (request: Request) => new URL(request.url).pathname.startsWith("/_serverFn/");

export async function pardaCatalog(session: Session | null): Promise<PardaCatalog | null> {
	if (!pardaTmdb) return null;
	if (!session) {
		const request = getRequest();
		if (isServerFunctionCall(request)) {
			const ip = clientIpHash(trustedClientIp(request));
			await enforceRateLimit(db, `parda-catalog:${ip ?? "unknown"}`, ANONYMOUS_LIMIT);
		}
	}
	const [settings, profile] = await Promise.all([
		pardaControls.settings(),
		browsingProfile(db, session, getCookie(PROFILE_COOKIE)),
	]);
	return {
		services: { tmdb: pardaTmdb, cache: pardaCache, controls: pardaControls },
		region: regionFor(profile?.region, getRequestHeader("x-vercel-ip-country"), settings.region),
		// A kids' profile browses under its cap, or the admin's (decisions 0236 and 0240).
		cap: profile?.kids ? (profile.cap ?? ("kidsCap" in settings ? settings.kidsCap : "PG")) : null,
		audioLanguage: profile?.audioLanguage ?? null,
	};
}

const isTimeZone = (zone: string | undefined): zone is string => {
	if (!zone) return false;
	try {
		new Intl.DateTimeFormat("en", { timeZone: zone });
		return true;
	} catch {
		return false;
	}
};

/**
 * The viewer's time zone (decision 0241): Vercel's `x-vercel-ip-timezone` when it names a
 * real zone, else Parda's (`APP_TIME_ZONE`). The schedule's "today" is the viewer's.
 */
export function viewerZone(header: string | undefined): string {
	return isTimeZone(header) ? header : APP_TIME_ZONE;
}

/** Today in the viewer's zone, as "YYYY-MM-DD". Inside a request only. */
export const viewerToday = (now = new Date()) => todayInZone(viewerZone(getRequestHeader("x-vercel-ip-timezone")), now);

export const catalogScope = (catalog: PardaCatalog, locale: CatalogScope["locale"]): CatalogScope => ({
	locale,
	region: catalog.region,
	cap: catalog.cap,
});

/** The admin's banner (decision 0237), null when its English is empty. Read from the controls' 30 s cache. */
export async function pardaBanner(): Promise<Localized | null> {
	const settings = await pardaControls.settings();
	const banner = "banner" in settings ? settings.banner : null;
	return banner?.en.trim() ? banner : null;
}

/**
 * Searches without a session, per IP (Task 66, decision 0239): each one is a TMDB call
 * the cache rarely answers, so they have their own limit, page loads included. About
 * one search every two seconds for five minutes; the overlay waits for a pause in typing.
 */
const SEARCH_LIMIT = { max: 150, windowSeconds: 300 } as const;

export async function limitAnonymousSearch(session: Session | null): Promise<void> {
	if (session) return;
	const ip = clientIpHash(trustedClientIp(getRequest()));
	await enforceRateLimit(db, `parda-search:${ip ?? "unknown"}`, SEARCH_LIMIT);
}

/** Whether a search may go ahead: false once an anonymous caller is over the limit. */
export async function withinSearchLimit(session: Session | null): Promise<boolean> {
	try {
		await limitAnonymousSearch(session);
		return true;
	} catch (error) {
		if (isAppError(error) && error.code === "RATE_LIMITED") return false;
		throw error;
	}
}
