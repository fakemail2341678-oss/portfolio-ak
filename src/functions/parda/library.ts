import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
	ContinueRailData,
	ForYouData,
	HistoryData,
	LibraryFavouritesData,
	LibraryListData,
	PardaViewerData,
	SavedState,
	TitleProgressData,
} from "@/features/parda/library/types";
import { zodInput } from "@/functions/_lib/validator";
import { isIsoDate } from "@/lib/i18n/date-only";
import { requirePardaViewer, withPardaServices } from "@/middleware/parda";
import { locales } from "@/paraglide/runtime";
import * as saved from "@/server/parda/library/saved";
import * as library from "@/server/parda/library/service";
import { guestDeletesAt, profilesOf } from "@/server/parda/profiles/service";

/**
 * Parda's library (PLAN 12.5, decisions 0236 and 0240): progress, Continue watching and
 * marks, My List, ♥, likes, History and the home's personal rails, for anyone with a
 * session (guests included). Each runs `requirePardaViewer` (the session
 * and the active profile) then `withPardaServices`; every service call acts on that
 * profile only (tests/server/parda-access.test.ts).
 */

const locale = z.enum(locales);
const media = z.enum(["movie", "tv"]);
const tmdbId = z.number().int().positive().max(2_147_483_647);
const season = z.number().int().min(0).max(9_999);
const episode = z.number().int().min(1).max(99_999);
const seconds = z.number().min(0).max(86_400);
const titleInput = z.strictObject({ media, id: tmdbId });

const progressFields = {
	media,
	id: tmdbId,
	season: season.optional(),
	episode: episode.optional(),
	watched: seconds,
	duration: seconds.positive().nullable(),
};
const progressInput = z.strictObject({ ...progressFields, sourceId: z.uuid().nullable() });
const markInput = z.strictObject({
	media,
	id: tmdbId,
	scope: z.enum(["title", "season", "episode"]),
	season: season.optional(),
	episode: episode.optional(),
	watched: z.boolean(),
	locale,
});
const listQuery = {
	type: z.enum(["all", "movie", "tv"]),
	sort: z.enum(["added", "title", "year"]),
	page: z.number().int().min(1).max(500),
	locale,
};
const libraryInput = z.strictObject({ tab: z.enum(["list", "favourites"]), ...listQuery });
const listedInput = z.strictObject({ media, id: tmdbId, kind: z.enum(["watchlist", "favourite"]), on: z.boolean() });
const personInput = z.strictObject({ id: tmdbId, on: z.boolean() });
const rateInput = z.strictObject({ media, id: tmdbId, value: z.enum(["like", "dislike"]).nullable() });
const historyInput = z.strictObject({ page: z.number().int().min(1).max(1_000), locale });
const historyEntryInput = z.strictObject({
	media,
	id: tmdbId,
	day: z.string().refine(isIsoDate, "Not a day"),
});
const importInput = z.strictObject({
	entries: z.array(z.strictObject({ ...progressFields, updatedAt: z.number().int().positive() })).max(50),
});

export const getPardaViewer = createServerFn({ method: "GET" })
	.middleware([requirePardaViewer, withPardaServices])
	.handler(
		async ({ context }): Promise<PardaViewerData> => ({
			profile: {
				id: context.viewer.profile.id,
				name: context.viewer.profile.name,
				avatar: context.viewer.profile.avatar,
				kids: context.viewer.profile.kids,
				autoplay: context.viewer.profile.autoplay,
			},
			profiles: (await profilesOf(context.db, context.viewer.userId)).length,
			isGuest: context.viewer.isGuest,
			guestDeletesAt: context.viewer.isGuest ? await guestDeletesAt(context.db, context.viewer.userId) : null,
		}),
	);

export const getPardaContinue = createServerFn({ method: "GET" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ locale })))
	.handler(({ data, context }): Promise<ContinueRailData> => library.continueWatching(context, data.locale));

export const getPardaTitleProgress = createServerFn({ method: "GET" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(titleInput.extend({ locale }).strict()))
	.handler(
		({ data, context }): Promise<TitleProgressData> =>
			library.titleProgress(context, { media: data.media, id: data.id }, data.locale),
	);

export const savePardaProgress = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(progressInput))
	.handler(({ data, context }) => library.saveProgress(context, data));

export const markPardaWatched = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(markInput))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await library.mark(context, data, data.locale);
		return { ok: true };
	});

export const removePardaContinue = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(titleInput))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await library.removeFromContinue(context, data);
		return { ok: true };
	});

export const rewatchPardaTitle = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(titleInput))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await library.rewatch(context, data);
		return { ok: true };
	});

/** The browser's progress from before the session, once. */
export const importPardaProgress = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(importInput))
	.handler(({ data, context }) =>
		library.importLocal(
			context,
			data.entries.map((entry) => ({ ...entry, sourceId: null })),
		),
	);

/** What the profile saved, for every page's buttons (the layout reads it for a session). */
export const getPardaSaved = createServerFn({ method: "GET" })
	.middleware([requirePardaViewer, withPardaServices])
	.handler(({ context }): Promise<SavedState> => saved.savedState(context));

/** + My List or ♥ on a title, or off. */
export const setPardaListed = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(listedInput))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await saved.setListed(context, data);
		return { ok: true };
	});

/** ♥ on a person, or off. */
export const setPardaPersonFavourite = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(personInput))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await saved.setPersonFavourite(context, data);
		return { ok: true };
	});

/** Like, Not for me, or neither (null). */
export const ratePardaTitle = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(rateInput))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await saved.rate(context, data);
		return { ok: true };
	});

/** My List or ♥, a page at a time (♥ also lists the favourite people). */
export const getPardaLibrary = createServerFn({ method: "GET" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(libraryInput))
	.handler(({ data, context }): Promise<LibraryListData | LibraryFavouritesData> => {
		const query = { type: data.type, sort: data.sort, page: data.page };
		return data.tab === "list"
			? saved.listPage(context, query, data.locale)
			: saved.favouritesPage(context, query, data.locale);
	});

export const getPardaHistory = createServerFn({ method: "GET" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(historyInput))
	.handler(({ data, context }): Promise<HistoryData> => saved.history(context, data.page, data.locale));

/** Takes one title's day out of History. */
export const removePardaHistory = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(historyEntryInput))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await saved.removeHistory(context, data);
		return { ok: true };
	});

/** Clears History, and with it Continue watching. */
export const clearPardaHistory = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.handler(async ({ context }): Promise<{ ok: true }> => {
		await saved.clearHistory(context);
		return { ok: true };
	});

/** The home's "Because you liked …" and "New from people you love". */
export const getPardaForYou = createServerFn({ method: "GET" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ locale })))
	.handler(({ data, context }): Promise<ForYouData> => saved.forYou(context, data.locale));
