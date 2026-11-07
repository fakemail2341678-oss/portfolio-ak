import "@tanstack/react-start/server-only";
import type {
	BillboardSlide,
	HubPageData,
	HubRailData,
	HubRailHead,
	HubRailTitles,
	HubSlide,
	HubTitle,
} from "@/features/parda/home/types";
import type { PardaPage } from "@/features/parda/search";
import { AppError, isAppError } from "@/lib/errors";
import { type Localized, localizedValue } from "@/lib/i18n/localized";
import { errorFields, log } from "@/server/log";
import {
	type BillboardRow,
	type CuratedCollection,
	collectionRailKey,
	liveBillboards,
	type PageRail,
	visibleRails,
} from "../curation";
import type { TitleDetails, TitleSummary } from "../tmdb/mappers";
import { discoverOfRail } from "./discover-requests";
import { isPlayable } from "./playable";
import { AWAITED_RAILS, BILLBOARD_SIZE, PAGE_LAYOUTS, type RailContext, type RailSpec, railContext } from "./rails";
import { type CatalogScope, type CatalogServices, listTitles, titleDetails } from "./service";

/**
 * The home and the hubs (PLAN Task 62, decision 0234): the billboard and the first
 * rails, awaited before the page is sent, and each later rail on its own call, so the
 * page streams them. A rail TMDB can't answer degrades to "couldn't load" in place
 * (PLAN 12.5); only a title page fails whole. The admin's slots lead the billboard, and
 * the admin's layout orders the rails (decision 0242).
 */

/** A rail shows at most this many titles: TMDB's first page. */
const RAIL_SIZE = 20;
/** The poster preview shows four lines of overview, so the page carries no more than that. */
const OVERVIEW_MAX = 280;

/** Text cut at a word before `max` characters, with an ellipsis. */
export const cut = (text: string, max = OVERVIEW_MAX) => {
	if (text.length <= max) return text;
	const space = text.lastIndexOf(" ", max);
	return `${text.slice(0, space > max / 2 ? space : max).trimEnd()}…`;
};

export const toHubTitle = (title: TitleSummary): HubTitle => ({
	media: title.media,
	id: title.id,
	slug: title.slug,
	title: title.title,
	year: title.year,
	poster: title.poster,
	backdrop: title.backdrop,
	overview: cut(title.overview),
	genres: title.genres,
	rating: title.rating,
});

/** TMDB failing (UPSTREAM_UNAVAILABLE) is logged and becomes null; anything else is a bug and throws. */
export async function degrade<T>(what: string, load: () => Promise<T>): Promise<T | null> {
	try {
		return await load();
	} catch (error) {
		if (!isAppError(error) || error.code !== "UPSTREAM_UNAVAILABLE") throw error;
		log("warn", "parda rail unavailable", { what, ...errorFields(error) });
		return null;
	}
}

const railTitles = (services: CatalogServices, scope: CatalogScope, spec: RailSpec, context: RailContext) =>
	degrade(spec.id, async () => {
		const list = await listTitles(services, scope, spec.request(context));
		return list.results.slice(0, RAIL_SIZE);
	});

/** A title's details, or null where it can't be shown here: blocked, or refused by a kids' cap. */
async function shownDetails(
	services: CatalogServices,
	scope: CatalogScope,
	media: "movie" | "tv",
	id: number,
): Promise<TitleDetails | null> {
	try {
		return await titleDetails(services, scope, media, id);
	} catch (error) {
		if (isAppError(error) && error.code === "NOT_FOUND") return null;
		throw error;
	}
}

/**
 * A title on the billboard, with the facts its lower mask shows and whether Play has a
 * source (0244); the admin's tagline wins when it has one.
 */
async function slideOf(
	services: CatalogServices,
	details: TitleDetails,
	locale: CatalogScope["locale"],
	tagline?: Localized | null,
): Promise<BillboardSlide> {
	const slide: HubSlide = {
		...toHubTitle(details),
		tagline: tagline?.en.trim() ? localizedValue(tagline, locale) : details.tagline,
		runtime: details.media === "movie" ? details.runtime : null,
		seasons: details.seasons,
		certification: details.certification,
	};
	return { ...slide, playable: await isPlayable(services, details, locale) };
}

/**
 * A page's billboard: the admin's slots showing today, in their order, then the first
 * titles with a backdrop in its rail, each once. A slot's title that can't be shown, or
 * has no backdrop, is left out, and the rail fills its place.
 */
async function billboard(
	services: CatalogServices,
	scope: CatalogScope,
	slots: ReadonlyArray<BillboardRow>,
	spec: RailSpec,
	context: RailContext,
): Promise<BillboardSlide[]> {
	const curated = await Promise.all(
		slots.slice(0, BILLBOARD_SIZE).map((slot) =>
			degrade(`billboard ${slot.media}/${slot.tmdbId}`, async (): Promise<BillboardSlide | null> => {
				const details = await shownDetails(services, scope, slot.media, slot.tmdbId);
				return details?.backdrop ? slideOf(services, details, scope.locale, slot.tagline) : null;
			}),
		),
	);
	const chosen = curated.filter((slide): slide is BillboardSlide => slide !== null);
	const room = BILLBOARD_SIZE - chosen.length;
	if (room <= 0) return chosen;
	const taken = new Set(chosen.map((slide) => `${slide.media}:${slide.id}`));
	const titles = (await railTitles(services, scope, spec, context)) ?? [];
	const picked = titles.filter((title) => title.backdrop && !taken.has(`${title.media}:${title.id}`)).slice(0, room);
	const slides = await Promise.all(
		picked.map((title) =>
			degrade(`${title.media}/${title.id}`, async (): Promise<BillboardSlide | null> => {
				// A title a kids' cap refuses (its US certificate disagrees with the list's) is left out.
				const details = await shownDetails(services, scope, title.media, title.id);
				return details ? slideOf(services, details, scope.locale) : null;
			}),
		),
	);
	return [...chosen, ...slides.filter((slide): slide is BillboardSlide => slide !== null)];
}

/** A curated collection's titles in the admin's order, minus any that can't be shown here (the service decides). */
export async function curatedTitles(
	services: CatalogServices,
	scope: CatalogScope,
	collection: CuratedCollection,
): Promise<TitleDetails[]> {
	const found = await Promise.all(collection.items.map((item) => shownDetails(services, scope, item.media, item.id)));
	return found.filter((title): title is TitleDetails => title !== null);
}

/** The titles of a rail on a page: TMDB's list, or a curated collection's first. */
const titlesOf = (services: CatalogServices, scope: CatalogScope, rail: PageRail, context: RailContext) =>
	rail.collection
		? degrade(rail.key, async () =>
				(await curatedTitles(services, scope, rail.collection)).slice(0, RAIL_SIZE).map(toHubTitle),
			)
		: railTitles(services, scope, rail.spec, context).then((titles) => titles?.map(toHubTitle) ?? null);

/** Discover's filters for a rail, when Discover can show the same titles. */
const withMore = (spec: RailSpec, context: RailContext) => {
	const more = discoverOfRail(spec.request(context));
	return more ? { more } : {};
};

const headOf = (rail: PageRail, scope: CatalogScope, context: RailContext): HubRailHead =>
	rail.collection
		? {
				id: rail.key,
				kind: "poster",
				label: { text: localizedValue(rail.collection.name, scope.locale) },
				collection: rail.collection.slug,
			}
		: { id: rail.key, kind: rail.spec.kind, label: rail.spec.label, ...withMore(rail.spec, context) };

export async function hubPage(
	services: CatalogServices,
	scope: CatalogScope,
	page: PardaPage,
	now: Date = new Date(),
): Promise<Extract<HubPageData, { configured: true }>> {
	const layout = PAGE_LAYOUTS[page];
	const context = railContext(scope.region, now);
	const from = layout.rails.find((spec) => spec.id === layout.billboardFrom);
	if (!from) throw new Error(`Parda: ${page}'s billboard rail "${layout.billboardFrom}" isn't in its layout`);
	const curation = await services.controls.curation();
	const rails = visibleRails(page, curation);
	// The billboard's rail is usually one of these, and the cache gives both one TMDB call.
	const [awaited, slides] = await Promise.all([
		Promise.all(
			rails.slice(0, AWAITED_RAILS).map((rail): Promise<HubRailTitles> => titlesOf(services, scope, rail, context)),
		),
		billboard(services, scope, liveBillboards(page, curation, now), from, context),
	]);
	return {
		configured: true,
		page,
		imageBase: services.tmdb.config.imageBase,
		billboard: slides,
		rails: rails.map((rail, index) => ({
			...headOf(rail, scope, context),
			...(index < AWAITED_RAILS ? { titles: awaited[index] ?? null } : {}),
		})),
	};
}

/** One streamed rail of a page, by its id. */
export async function hubRail(
	services: CatalogServices,
	scope: CatalogScope,
	page: PardaPage,
	railId: string,
	now: Date = new Date(),
): Promise<HubRailData> {
	const imageBase = services.tmdb.config.imageBase;
	const context = railContext(scope.region, now);
	const spec = PAGE_LAYOUTS[page].rails.find((rail) => rail.id === railId);
	if (spec) {
		const titles = await titlesOf(services, scope, { key: spec.id, visible: true, spec }, context);
		return { imageBase, titles };
	}
	const { collections } = await services.controls.curation();
	const collection = collections.find((each) => each.published && collectionRailKey(each.id) === railId);
	if (!collection) throw new AppError("NOT_FOUND", `Parda: no rail "${railId}" on ${page}`);
	return { imageBase, titles: await titlesOf(services, scope, { key: railId, visible: true, collection }, context) };
}
