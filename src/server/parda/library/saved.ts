import "@tanstack/react-start/server-only";
import { withinCap } from "@/features/parda/kids";
import { progressShare } from "@/features/parda/library/progress";
import type {
	FavouritePerson,
	ForYouData,
	HistoryData,
	HistoryEntry,
	LibraryFavouritesData,
	LibraryListData,
	LibraryListSort,
	LibraryListType,
	LibraryTitle,
	SavedState,
} from "@/features/parda/library/types";
import { titleSlug } from "@/features/parda/slug";
import { AppError, isAppError } from "@/lib/errors";
import { addDays, startOfDayInZone, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import type { PardaListKind, PardaMedia, PardaRatingValue } from "@/server/db/schema";
import { errorFields, log } from "@/server/log";
import { catalogScope, type PardaCatalog } from "../catalog/context";
import { toHubTitle } from "../catalog/hubs";
import { personDetails, titleDetails, usCertificate } from "../catalog/service";
import { titleKey } from "../controls";
import { newEpisodes } from "../notify/service";
import * as repo from "./saved-repository";
import type { PardaServices } from "./service";

/**
 * What a profile keeps (PLAN Task 67, decision 0240): My List, ♥ on titles and people,
 * Like and Not for me, History, and the home's personal rails. Every call acts on the
 * viewer's active profile only; takedowns and a kids' cap apply through the catalogue.
 */

type Locale = "en" | "ne";
type TitleRef = { media: PardaMedia; id: number };

/** The buttons read at most this many of each (the latest). */
const SAVED_MAX = 2_000;
const PAGE_SIZE = 24;
/** History reads this many movies and episodes a page, then groups them by day and title. */
const HISTORY_PAGE = 60;

const catalogOf = (ctx: PardaServices): PardaCatalog => {
	if (!ctx.catalog) throw new AppError("UPSTREAM_UNAVAILABLE", "Catalogue not configured");
	return ctx.catalog;
};

const notFoundOrUpstream = (error: unknown) =>
	isAppError(error) && (error.code === "UPSTREAM_UNAVAILABLE" || error.code === "NOT_FOUND");

export async function savedState(ctx: PardaServices): Promise<SavedState> {
	const profileId = ctx.viewer.profile.id;
	const keys = (rows: ReadonlyArray<{ media: PardaMedia; id: number }>) =>
		rows.map((row) => titleKey(row.media, row.id));
	const [watchlist, favourite, people, likes, dislikes] = await Promise.all([
		repo.listKeys(ctx.db, profileId, "watchlist", SAVED_MAX),
		repo.listKeys(ctx.db, profileId, "favourite", SAVED_MAX),
		repo.favouritePeople(ctx.db, profileId, SAVED_MAX),
		repo.ratings(ctx.db, profileId, "like", SAVED_MAX),
		repo.ratings(ctx.db, profileId, "dislike", SAVED_MAX),
	]);
	return {
		watchlist: keys(watchlist),
		favourite: keys(favourite),
		people: people.map((row) => row.personId),
		likes: keys(likes),
		dislikes: keys(dislikes),
	};
}

/**
 * Reads a title through the catalogue (takedowns and the cap apply, so a kids' profile
 * can't save what it can't open) and keeps its snapshot in `pd_title`, so the list is
 * named and sorted without asking TMDB again.
 */
async function rememberTitle(ctx: PardaServices, ref: TitleRef) {
	const catalog = catalogOf(ctx);
	const [english, nepali] = await Promise.all([
		titleDetails(catalog.services, catalogScope(catalog, "en"), ref.media, ref.id),
		titleDetails(catalog.services, catalogScope(catalog, "ne"), ref.media, ref.id),
	]);
	await repo.rememberTitle(ctx.db, {
		media: ref.media,
		tmdbId: ref.id,
		title: { en: english.title, ne: nepali.title || english.title },
		poster: english.poster,
		backdrop: english.backdrop,
		year: english.year,
		genres: english.genres,
		runtime: english.runtime,
		certification: usCertificate(english),
		certificationCheckedAt: new Date(),
	});
}

/** + My List or ♥ on a title, or taking it off. Adding checks the title is there to add. */
export async function setListed(
	ctx: PardaServices,
	input: TitleRef & { kind: PardaListKind; on: boolean },
): Promise<void> {
	const profileId = ctx.viewer.profile.id;
	if (!input.on) {
		await repo.removeFromList(ctx.db, profileId, input.kind, input.media, input.id);
		return;
	}
	await rememberTitle(ctx, input);
	await repo.addToList(ctx.db, profileId, input.kind, input.media, input.id);
}

/** ♥ on a person, named and pictured as TMDB has them now. */
export async function setPersonFavourite(ctx: PardaServices, input: { id: number; on: boolean }): Promise<void> {
	const profileId = ctx.viewer.profile.id;
	if (!input.on) {
		await repo.unfavouritePerson(ctx.db, profileId, input.id);
		return;
	}
	const catalog = catalogOf(ctx);
	const person = await personDetails(catalog.services, catalogScope(catalog, "en"), input.id);
	await repo.favouritePerson(ctx.db, profileId, { id: person.id, name: person.name, portrait: person.profile });
}

/** Like, Not for me, or neither. Refused for a title the profile can't open. */
export async function rate(ctx: PardaServices, input: TitleRef & { value: PardaRatingValue | null }): Promise<void> {
	if (input.value !== null) {
		const catalog = catalogOf(ctx);
		await titleDetails(catalog.services, catalogScope(catalog, "en"), input.media, input.id);
	}
	await repo.setRating(ctx.db, ctx.viewer.profile.id, input.media, input.id, input.value);
}

const pageCount = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));

/** Leaves out what a takedown removed, and under a cap what isn't known to be within it. */
async function shownTitles(ctx: PardaServices, titles: LibraryTitle[]): Promise<LibraryTitle[]> {
	if (!ctx.catalog) return titles;
	const blocked = await ctx.catalog.services.controls.blocked();
	const cap = ctx.catalog.cap;
	const certificates = cap ? await ctx.catalog.services.controls.certifications() : null;
	return titles.filter((title) => {
		const key = titleKey(title.media, title.id);
		return !blocked.has(key) && (!cap || withinCap(cap, title.media, certificates?.get(key)));
	});
}

async function titlesPage(
	ctx: PardaServices,
	kind: PardaListKind,
	query: { type: LibraryListType; sort: LibraryListSort; page: number },
	locale: Locale,
): Promise<LibraryListData> {
	const { rows, total } = await repo.listPage(ctx.db, ctx.viewer.profile.id, {
		kind,
		media: query.type === "all" ? null : query.type,
		sort: query.sort,
		locale,
		page: query.page,
		pageSize: PAGE_SIZE,
	});
	const titles = await shownTitles(
		ctx,
		rows.map((row) => ({
			media: row.media,
			id: row.id,
			slug: titleSlug(row.title.en),
			title: (locale === "ne" ? row.title.ne : "") || row.title.en,
			year: row.year,
			poster: row.poster,
			backdrop: row.backdrop,
			overview: "",
			genres: row.genres,
			rating: 0,
		})),
	);
	return {
		imageBase: ctx.catalog?.services.tmdb.config.imageBase ?? "",
		titles,
		page: query.page,
		pageCount: pageCount(total),
		total,
	};
}

export const listPage = (
	ctx: PardaServices,
	query: { type: LibraryListType; sort: LibraryListSort; page: number },
	locale: Locale,
) => titlesPage(ctx, "watchlist", query, locale);

/** ♥: the titles a page at a time, and every favourite person (at most 100). */
export async function favouritesPage(
	ctx: PardaServices,
	query: { type: LibraryListType; sort: LibraryListSort; page: number },
	locale: Locale,
): Promise<LibraryFavouritesData> {
	const [titles, people] = await Promise.all([
		titlesPage(ctx, "favourite", query, locale),
		repo.favouritePeople(ctx.db, ctx.viewer.profile.id, 100),
	]);
	return {
		...titles,
		people: people.map((row): FavouritePerson => ({ id: row.personId, name: row.name, portrait: row.portrait })),
	};
}

/** History: movies and episodes by day in Parda's time zone, latest first; each title once a day. */
export async function history(ctx: PardaServices, page: number, locale: Locale): Promise<HistoryData> {
	const rows = await repo.historyRows(ctx.db, ctx.viewer.profile.id, HISTORY_PAGE + 1, (page - 1) * HISTORY_PAGE);
	const hasMore = rows.length > HISTORY_PAGE;
	const groups = new Map<string, { day: string; media: PardaMedia; id: number; rows: typeof rows }>();
	for (const row of rows.slice(0, HISTORY_PAGE)) {
		const day = todayInZone(APP_TIME_ZONE, row.updatedAt);
		const key = `${day}|${row.media}:${row.tmdbId}`;
		const group = groups.get(key) ?? { day, media: row.media, id: row.tmdbId, rows: [] };
		group.rows.push(row);
		groups.set(key, group);
	}
	const catalog = ctx.catalog;
	const imageBase = catalog?.services.tmdb.config.imageBase ?? "";
	if (!catalog) return { imageBase, days: [], page, hasMore: false };
	const scope = catalogScope(catalog, locale);
	const entries = await Promise.all(
		[...groups.values()].map(async (group): Promise<{ day: string; entry: HistoryEntry } | null> => {
			try {
				const details = await titleDetails(catalog.services, scope, group.media, group.id);
				const latest = group.rows[0];
				if (!latest) return null;
				return {
					day: group.day,
					entry: {
						media: group.media,
						id: group.id,
						slug: details.slug,
						title: details.title,
						poster: details.poster,
						backdrop: details.backdrop,
						episodes: group.rows.flatMap((row) =>
							row.season === null || row.episode === null ? [] : [{ season: row.season, episode: row.episode }],
						),
						share: progressShare(latest),
						at: latest.updatedAt.toISOString(),
					},
				};
			} catch (error) {
				// A title taken down, over the cap or gone from TMDB isn't listed.
				if (notFoundOrUpstream(error)) return null;
				throw error;
			}
		}),
	);
	const days = new Map<string, HistoryEntry[]>();
	for (const item of entries) {
		if (!item) continue;
		days.set(item.day, [...(days.get(item.day) ?? []), item.entry]);
	}
	return { imageBase, days: [...days].map(([day, list]) => ({ day, entries: list })), page, hasMore };
}

/** Takes a title's day out of History (its rows that day go, so Continue watching forgets them too). */
export async function removeHistory(ctx: PardaServices, input: TitleRef & { day: string }): Promise<void> {
	const from = startOfDayInZone(input.day, APP_TIME_ZONE);
	const to = startOfDayInZone(addDays(input.day, 1), APP_TIME_ZONE);
	if (!from || !to) throw new AppError("BAD_REQUEST", "Not a day");
	await repo.deleteHistory(ctx.db, ctx.viewer.profile.id, input.media, input.id, from, to);
}

export const clearHistory = (ctx: PardaServices) => repo.clearHistory(ctx.db, ctx.viewer.profile.id);

/** How many favourite people "New from people you love" reads, and how far back "new" goes. */
const PEOPLE_READ = 8;
const NEW_YEARS = 2;
const RAIL_MAX = 20;

/**
 * The home's personal rails: TMDB's recommendations for the latest liked title (♥ when
 * nothing is liked), minus what the profile marked Not for me or already saved; and the
 * latest titles of its favourite people. Either is null when there's nothing to show.
 */
export async function forYou(ctx: PardaServices, locale: Locale, now = new Date()): Promise<ForYouData> {
	const catalog = ctx.catalog;
	if (!catalog) return { imageBase: "", because: null, people: null, episodes: null };
	const scope = catalogScope(catalog, locale);
	const profileId = ctx.viewer.profile.id;
	const [liked, hearted, disliked, listed, people] = await Promise.all([
		repo.ratings(ctx.db, profileId, "like", 1),
		repo.listKeys(ctx.db, profileId, "favourite", 1),
		repo.ratings(ctx.db, profileId, "dislike", SAVED_MAX),
		repo.listKeys(ctx.db, profileId, "watchlist", SAVED_MAX),
		repo.favouritePeople(ctx.db, profileId, PEOPLE_READ),
	]);
	const skip = new Set([...disliked, ...listed].map((row) => titleKey(row.media, row.id)));
	const seed = liked[0] ?? hearted[0];

	const because = async (): Promise<ForYouData["because"]> => {
		if (!seed) return null;
		try {
			const details = await titleDetails(catalog.services, scope, seed.media, seed.id);
			const titles = details.recommendations
				.filter((title) => !skip.has(titleKey(title.media, title.id)))
				.slice(0, RAIL_MAX)
				.map(toHubTitle);
			return titles.length ? { title: details.title, titles } : null;
		} catch (error) {
			if (notFoundOrUpstream(error)) return null;
			throw error;
		}
	};

	const fromPeople = async (): Promise<LibraryTitle[] | null> => {
		if (people.length === 0) return null;
		const since = String(now.getUTCFullYear() - NEW_YEARS);
		const credits = await Promise.all(
			people.map(async (person) => {
				try {
					return (await personDetails(catalog.services, scope, person.personId)).credits;
				} catch (error) {
					if (notFoundOrUpstream(error)) {
						log("warn", "parda favourite person unavailable", { id: person.personId, ...errorFields(error) });
						return [];
					}
					throw error;
				}
			}),
		);
		const seen = new Set<string>(skip);
		const titles = credits
			.flat()
			.filter((credit) => !credit.appearance && credit.date !== null && credit.date >= since)
			.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.votes - a.votes)
			.filter((credit) => {
				const key = titleKey(credit.media, credit.id);
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.slice(0, RAIL_MAX)
			.map(toHubTitle);
		return titles.length ? titles : null;
	};

	const [becauseRail, peopleRail, episodes] = await Promise.all([
		because(),
		fromPeople(),
		newEpisodes(ctx, locale, now),
	]);
	return {
		imageBase: catalog.services.tmdb.config.imageBase,
		because: becauseRail,
		people: peopleRail,
		episodes: episodes.length ? episodes : null,
	};
}
