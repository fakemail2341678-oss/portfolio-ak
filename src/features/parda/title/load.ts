import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { loadDetailOr404 } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { type JsonLd, localizedUrl, type SeoImage } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { getLocale, type Locale } from "@/paraglide/runtime";
import { GENRE_LABELS } from "../genres";
import type { HubTitle } from "../home/types";
import { tmdbImage } from "../kit/image";
import { PARDA_PATHS, pardaLinks } from "../links";
import {
	pardaCollectionQueryOptions,
	pardaCreditsQueryOptions,
	pardaCuratedQueryOptions,
	pardaPersonQueryOptions,
	pardaSeasonQueryOptions,
	pardaTitleQueryOptions,
} from "../queries";
import { PARDA_TYPES, type PardaPage, type PardaType } from "../search";
import type { ContentHead } from "./head";
import type { TitleFacts } from "./types";

/**
 * The loaders of a title's pages, a person's and a collection's (routes import this
 * with `await import()`, 0194). Each awaits its data, answers a wrong slug with a 301,
 * and returns only what the head needs (`ContentHead`): the title, description,
 * canonical path, the backdrop for previews and JSON-LD.
 */

type TitleParams = { type: PardaType; id: number; slug: string };

const DESCRIPTION_MAX = 160;

const describe = (text: string, fallback: string) => {
	const clean = text.replace(/\s+/g, " ").trim();
	if (!clean) return fallback;
	if (clean.length <= DESCRIPTION_MAX) return clean;
	const space = clean.lastIndexOf(" ", DESCRIPTION_MAX - 1);
	return `${clean.slice(0, space > 80 ? space : DESCRIPTION_MAX - 1)}…`;
};

/** The largest backdrop TMDB keeps ready, as the social preview (PLAN Task 63: "og = backdrop"). */
const preview = (imageBase: string, path: string | null, alt: string): SeoImage | null =>
	path ? { url: `${imageBase.replace(/\/$/, "")}/w1280${path}`, width: 1280, height: 720, alt } : null;

/** ISO 8601 for a runtime in minutes: 152 → "PT2H32M". */
const duration = (minutes: number) =>
	`PT${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}H` : ""}${minutes % 60}M`;

const url = (path: string) => localizedUrl(path, getLocale());

const titleJsonLd = (
	title: TitleFacts,
	imageBase: string,
	people: { cast: Array<{ id: number; name: string }>; crew: Array<{ id: number; name: string; jobs: string[] }> },
): JsonLd => {
	const person = (each: { id: number; name: string }) => ({
		"@type": "Person" as const,
		name: each.name,
		url: url(PARDA_PATHS.person(each.id)),
	});
	const images = [
		preview(imageBase, title.backdrop, "")?.url,
		tmdbImage(imageBase, title.poster, "poster")?.src,
	].filter((each): each is string => Boolean(each));
	const shared = {
		name: title.title,
		url: url(PARDA_PATHS.title(title.media, title.id, title.slug)),
		...(images.length ? { image: images } : {}),
		...(title.overview ? { description: title.overview } : {}),
		...(title.genres.length
			? { genre: title.genres.flatMap((genre) => (GENRE_LABELS[genre] ? [GENRE_LABELS[genre]()] : [])) }
			: {}),
		...(title.votes > 0 && title.rating > 0
			? {
					aggregateRating: {
						"@type": "AggregateRating" as const,
						ratingValue: title.rating,
						ratingCount: title.votes,
						bestRating: 10,
						worstRating: 0,
					},
				}
			: {}),
		...(people.cast.length ? { actor: people.cast.slice(0, 10).map(person) } : {}),
		...(title.links.imdb ? { sameAs: [title.links.imdb] } : {}),
		inLanguage: getLocale(),
	};
	if (title.media === "movie") {
		const directors = people.crew.filter((each) => each.jobs.includes("Director"));
		return {
			"@type": "Movie",
			...shared,
			...(title.releaseDate ? { datePublished: title.releaseDate } : {}),
			...(title.runtime ? { duration: duration(title.runtime) } : {}),
			...(directors.length ? { director: directors.map(person) } : {}),
		};
	}
	const creators = people.crew.filter((each) => each.jobs.includes("Creator"));
	return {
		"@type": "TVSeries",
		...shared,
		...(title.releaseDate ? { startDate: title.releaseDate } : {}),
		...(title.status === "Ended" && title.lastAirDate ? { endDate: title.lastAirDate } : {}),
		...(title.seasons ? { numberOfSeasons: title.seasons } : {}),
		...(title.episodes ? { numberOfEpisodes: title.episodes } : {}),
		...(creators.length ? { creator: creators.map(person) } : {}),
	};
};

/** The canonical address differs (a wrong or missing slug): answer with it, for good. */
const toCanonical = (params: TitleParams, slug: string, credits: boolean) => {
	if (params.slug === slug) return;
	const media = PARDA_TYPES[params.type];
	throw redirect({
		...(credits ? pardaLinks.credits(media, params.id, slug) : pardaLinks.title(media, params.id, slug)),
		search: true,
		statusCode: 301,
	});
};

export async function loadTitlePage(
	queryClient: QueryClient,
	locale: Locale,
	params: TitleParams,
	deps: { season?: number | undefined; page?: number | undefined },
	signedIn = false,
): Promise<ContentHead | undefined> {
	const data = await loadDetailOr404(queryClient, pardaTitleQueryOptions(locale, params.type, params.id));
	if (!data.configured) return undefined;
	const { title, imageBase } = data;
	toCanonical(params, title.slug, false);
	// The season's episodes are part of the page: a failure there stays inside its block (`episodes: null`).
	if (title.media === "tv" && data.seasons.length) {
		await ensureQuery(queryClient, pardaSeasonQueryOptions(locale, title.id, deps.season, deps.page));
	}
	// The profile's progress is part of the page too: the main action and the bars render on the server.
	if (signedIn) {
		const { pardaTitleProgressQueryOptions } = await import("../library/queries");
		await ensureQuery(queryClient, pardaTitleProgressQueryOptions(locale, title.media, title.id)).catch(
			() => undefined,
		);
	}
	return {
		title: title.year ? `${title.title} (${title.year})` : title.title,
		description: describe(title.overview, m.pd_title_description({ title: title.title })),
		path: PARDA_PATHS.title(title.media, title.id, title.slug),
		image: preview(imageBase, title.backdrop, title.title),
		jsonLd: titleJsonLd(title, imageBase, data),
		// The hero preloads its own picture, at the top of the head (`preloadHero`, decision 0245).
		preload: null,
	};
}

export async function loadCreditsPage(
	queryClient: QueryClient,
	locale: Locale,
	params: TitleParams,
): Promise<ContentHead | undefined> {
	const data = await loadDetailOr404(queryClient, pardaCreditsQueryOptions(locale, params.type, params.id));
	if (!data.configured) return undefined;
	const { title, imageBase } = data;
	toCanonical(params, title.slug, true);
	const path = PARDA_PATHS.credits(title.media, title.id, title.slug);
	const name = m.pd_credits_title({ title: title.title });
	return {
		title: name,
		description: m.pd_credits_description({
			title: title.title,
			names: data.cast
				.slice(0, 3)
				.map((person) => person.name)
				.join(", "),
		}),
		path,
		image: preview(imageBase, title.backdrop, title.title),
		jsonLd: {
			"@type": "WebPage",
			name,
			url: url(path),
			inLanguage: getLocale(),
			about: {
				"@type": title.media === "movie" ? "Movie" : "TVSeries",
				name: title.title,
				url: url(PARDA_PATHS.title(title.media, title.id, title.slug)),
			},
		},
		preload: null,
	};
}

export async function loadPersonPage(
	queryClient: QueryClient,
	locale: Locale,
	id: number,
): Promise<ContentHead | undefined> {
	const data = await loadDetailOr404(queryClient, pardaPersonQueryOptions(locale, id));
	if (!data.configured) return undefined;
	const { person, imageBase } = data;
	const path = PARDA_PATHS.person(person.id);
	const portrait = tmdbImage(imageBase, person.profile, "profile");
	const known = data.knownFor
		.slice(0, 3)
		.map((title) => title.title)
		.join(", ");
	return {
		title: person.name,
		description: describe(person.biography, m.pd_person_description({ name: person.name, titles: known })),
		path,
		image: portrait ? { url: portrait.src, width: 185, height: 278, alt: person.name } : null,
		jsonLd: {
			"@type": "Person",
			name: person.name,
			url: url(path),
			...(portrait ? { image: portrait.src } : {}),
			...(person.biography ? { description: describe(person.biography, "") } : {}),
			...(person.birthday ? { birthDate: person.birthday } : {}),
			...(person.deathday ? { deathDate: person.deathday } : {}),
			...(person.placeOfBirth ? { birthPlace: person.placeOfBirth } : {}),
			...(person.links.imdb ? { sameAs: [person.links.imdb] } : {}),
		},
		preload: null,
	};
}

/** A list of titles as JSON-LD: a franchise's, or a curated collection's. */
const collectionJsonLd = (name: string, path: string, parts: ReadonlyArray<HubTitle>, ordered: boolean): JsonLd => ({
	"@type": "CollectionPage",
	name,
	url: url(path),
	inLanguage: getLocale(),
	mainEntity: {
		"@type": "ItemList",
		...(ordered ? { itemListOrder: "https://schema.org/ItemListOrderAscending" } : {}),
		numberOfItems: parts.length,
		itemListElement: parts.map((part, index) => ({
			"@type": "ListItem",
			position: index + 1,
			url: url(PARDA_PATHS.title(part.media, part.id, part.slug)),
			name: part.title,
		})),
	},
});

export async function loadCollectionPage(
	queryClient: QueryClient,
	locale: Locale,
	id: number,
): Promise<ContentHead | undefined> {
	const data = await loadDetailOr404(queryClient, pardaCollectionQueryOptions(locale, id));
	if (!data.configured) return undefined;
	const { collection, imageBase, parts } = data;
	const path = PARDA_PATHS.collection(collection.id);
	return {
		title: collection.name,
		description: describe(
			collection.overview,
			m.pd_collection_description({ name: collection.name, count: String(parts.length) }),
		),
		path,
		image: preview(imageBase, collection.backdrop, collection.name),
		jsonLd: collectionJsonLd(collection.name, path, parts, true),
		preload: tmdbImage(imageBase, collection.backdrop, "backdrop"),
	};
}

export async function loadCuratedPage(
	queryClient: QueryClient,
	locale: Locale,
	slug: string,
): Promise<ContentHead | undefined> {
	const data = await loadDetailOr404(queryClient, pardaCuratedQueryOptions(locale, slug));
	if (!data.configured) return undefined;
	const { collection, imageBase, parts } = data;
	const path = PARDA_PATHS.curated(collection.slug);
	return {
		title: collection.name,
		description: describe(
			collection.description,
			m.pd_curated_description({ name: collection.name, count: String(parts.length) }),
		),
		path,
		image: preview(imageBase, collection.backdrop, collection.name),
		jsonLd: collectionJsonLd(collection.name, path, parts, false),
		preload: tmdbImage(imageBase, collection.backdrop, "backdrop"),
	};
}

/** "Surprise me": always a fresh pick (a redirect is never cached), or back to the page it came from. */
export async function surpriseRedirect(from: PardaPage): Promise<never> {
	const { getPardaSurprise } = await import("@/functions/parda/catalog");
	const target = await getPardaSurprise({ data: { from, locale: getLocale() } });
	if (target) throw redirect(pardaLinks.title(target.media, target.id, target.slug));
	throw redirect(from === "home" ? pardaLinks.home() : pardaLinks.hub(from));
}
