import "@tanstack/react-start/server-only";
import { EPISODES_PER_PAGE } from "@/features/parda/search";
import type { CreditsPageData, SeasonData, TitlePageData } from "@/features/parda/title/types";
import { isAppError } from "@/lib/errors";
import type { PardaMedia } from "@/server/db/schema";
import { errorFields, log } from "@/server/log";
import { cut, toHubTitle } from "./hubs";
import { firstSeason, isPlayable } from "./playable";
import { type CatalogScope, type CatalogServices, titleCredits, titleDetails, titleSeason } from "./service";

/**
 * A title's pages (PLAN Task 63, decision 0235): the title page, a page of a season's
 * episodes, and the full credits. A blocked or unknown title is NOT_FOUND; TMDB failing
 * is UPSTREAM_UNAVAILABLE, and the page answers 503 (PLAN 12.5: only a title page
 * throws). A season TMDB can't answer degrades to "couldn't load" in its own block.
 */

type Locale = CatalogScope["locale"];

const today = () => new Date().toISOString().slice(0, 10);

/** Country and language names in the page's language, made on the server so the browser's ICU data can't differ. */
export function namer(locale: Locale, type: "region" | "language") {
	let names: Intl.DisplayNames | null = null;
	try {
		names = new Intl.DisplayNames([locale], { type, fallback: "code" });
	} catch {
		names = null;
	}
	return (code: string) => {
		try {
			return names?.of(code) ?? code;
		} catch {
			return code;
		}
	};
}

export async function titlePage(
	services: CatalogServices,
	scope: CatalogScope,
	media: PardaMedia,
	id: number,
): Promise<Extract<TitlePageData, { configured: true }>> {
	const details = await titleDetails(services, scope, media, id);
	const country = namer(scope.locale, "region");
	const language = namer(scope.locale, "language");
	return {
		configured: true,
		imageBase: services.tmdb.config.imageBase,
		title: {
			...toHubTitle(details),
			// The page has room for the whole overview; the hubs cut theirs.
			overview: details.overview,
			tagline: details.tagline,
			runtime: media === "movie" ? details.runtime : null,
			seasons: details.seasons,
			certification: details.certification,
			originalTitle: details.originalTitle,
			originalLanguage: details.originalLanguage ? language(details.originalLanguage) : null,
			logo: details.logo,
			votes: details.votes,
			status: details.status,
			releaseDate: details.releaseDate,
			lastAirDate: details.lastAirDate,
			episodes: details.episodes,
			next: details.next,
			latest: details.latest,
			spokenLanguages: details.spokenLanguages.map(language),
			networks: details.networks,
			companies: details.companies,
			countries: details.countries.map(country),
			budget: details.budget,
			revenue: details.revenue,
			ratings: details.ratings.map((row) => ({ ...row, country: country(row.country) })),
			alternativeTitles: details.alternativeTitles.map((row) => ({ ...row, country: country(row.country) })),
			keywords: details.keywords,
			links: details.links,
			collection: details.collection,
		},
		seasons: details.seasonList.filter((season) => season.episodes > 0),
		cast: details.cast,
		crew: details.crew,
		providers: details.providers,
		videos: details.videos,
		gallery: details.gallery,
		recommendations: details.recommendations.map(toHubTitle),
		similar: details.similar.map(toHubTitle),
		reviews: details.reviews,
		playable: await isPlayable(services, details, scope.locale),
		today: today(),
	};
}

/** The overview an episode row shows: the sheet has the rest of the facts, so this stays short. */
const EPISODE_OVERVIEW = 400;

/**
 * One page of a season's episodes. `season` null opens the first season; a season the
 * series doesn't have is NOT_FOUND. TMDB failing gives `episodes: null`.
 */
export async function seasonPage(
	services: CatalogServices,
	scope: CatalogScope,
	id: number,
	requested: { season?: number | undefined; page?: number | undefined },
): Promise<Extract<SeasonData, { configured: true }>> {
	const details = await titleDetails(services, scope, "tv", id);
	const known = details.seasonList.find((season) => season.number === (requested.season ?? firstSeason(details)));
	const imageBase = services.tmdb.config.imageBase;
	if (!known) {
		return {
			configured: true,
			imageBase,
			number: requested.season ?? 0,
			name: "",
			overview: "",
			total: 0,
			page: 1,
			pageCount: 0,
			episodes: [],
			today: today(),
		};
	}
	try {
		const season = await titleSeason(services, scope, id, known.number);
		const pageCount = Math.max(1, Math.ceil(season.episodes.length / EPISODES_PER_PAGE));
		const page = Math.min(Math.max(1, requested.page ?? 1), pageCount);
		return {
			configured: true,
			imageBase,
			number: season.number,
			name: season.name || known.name,
			overview: season.overview,
			total: season.episodes.length,
			page,
			pageCount,
			episodes: season.episodes
				.slice((page - 1) * EPISODES_PER_PAGE, page * EPISODES_PER_PAGE)
				.map((episode) => ({ ...episode, overview: cut(episode.overview, EPISODE_OVERVIEW) })),
			today: today(),
		};
	} catch (error) {
		// TMDB failing, or a season it lists but can't find, stays inside the episodes block.
		if (!isAppError(error) || (error.code !== "UPSTREAM_UNAVAILABLE" && error.code !== "NOT_FOUND")) throw error;
		log("warn", "parda season unavailable", { id, season: known.number, ...errorFields(error) });
		return {
			configured: true,
			imageBase,
			number: known.number,
			name: known.name,
			overview: "",
			total: known.episodes,
			page: 1,
			pageCount: 1,
			episodes: null,
			today: today(),
		};
	}
}

/** A long-running series credits thousands: the page lists the first of each list (TMDB orders them by billing). */
const CREDITS_MAX = 300;

/** The full cast and crew page: the title's facts for its header, then everyone. */
export async function creditsPage(
	services: CatalogServices,
	scope: CatalogScope,
	media: PardaMedia,
	id: number,
): Promise<Extract<CreditsPageData, { configured: true }>> {
	const [details, credits] = await Promise.all([
		titleDetails(services, scope, media, id),
		titleCredits(services, scope, media, id),
	]);
	return {
		configured: true,
		imageBase: services.tmdb.config.imageBase,
		title: {
			media: details.media,
			id: details.id,
			slug: details.slug,
			title: details.title,
			year: details.year,
			poster: details.poster,
			backdrop: details.backdrop,
		},
		cast: credits.cast.slice(0, CREDITS_MAX),
		crew: credits.crew.map((department) => ({ ...department, people: department.people.slice(0, CREDITS_MAX) })),
	};
}
