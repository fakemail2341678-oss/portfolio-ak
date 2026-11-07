import "@tanstack/react-start/server-only";
import type { ScheduleEntry } from "@/features/parda/schedule/types";
import { isAppError } from "@/lib/errors";
import { addDays } from "@/lib/i18n/date-only";
import { errorFields, log } from "@/server/log";
import { catalogScope, type PardaCatalog } from "./context";
import { animeAiringRequest } from "./requests";
import { listTitles, titleDetails } from "./service";

/**
 * Anime airing this week (PLAN Task 68, decision 0241), the schedule's half for
 * everyone: TMDB's discover list of anime with an episode in the 7 days from `today`, then
 * each title's details (cached a day) for the day: the episode that aired today, or the
 * next one. Takedowns and a kids' cap apply through the catalogue service.
 */

export const ANIME_DAYS = 7;
/** The most popular this many: a week of anime is a few hundred series. */
const ANIME_MAX = 20;

const unavailable = (error: unknown) =>
	isAppError(error) && (error.code === "UPSTREAM_UNAVAILABLE" || error.code === "NOT_FOUND");

export async function animeWeek(
	catalog: PardaCatalog,
	locale: "en" | "ne",
	today: string,
): Promise<{ imageBase: string; entries: ScheduleEntry[]; failed: boolean }> {
	const imageBase = catalog.services.tmdb.config.imageBase;
	const scope = catalogScope(catalog, locale);
	const last = addDays(today, ANIME_DAYS - 1);
	const within = (date: string | null): date is string => date !== null && date >= today && date <= last;
	let titles: Awaited<ReturnType<typeof listTitles>>["results"];
	try {
		titles = (await listTitles(catalog.services, scope, animeAiringRequest(today, last))).results;
	} catch (error) {
		if (!unavailable(error)) throw error;
		log("warn", "parda anime week unavailable", errorFields(error));
		return { imageBase, entries: [], failed: true };
	}
	const entries = await Promise.all(
		titles.slice(0, ANIME_MAX).map(async (title): Promise<ScheduleEntry | null> => {
			try {
				const details = await titleDetails(catalog.services, scope, "tv", title.id);
				const episode = [details.latest, details.next].find((ref) => ref && within(ref.airDate));
				if (!episode?.airDate) return null;
				return {
					id: title.id,
					slug: details.slug,
					title: details.title,
					poster: details.poster,
					season: episode.season,
					episode: episode.episode,
					name: episode.name,
					airDate: episode.airDate,
					kind: "anime",
				};
			} catch (error) {
				if (!unavailable(error)) throw error;
				return null;
			}
		}),
	);
	return { imageBase, entries: entries.filter((entry): entry is ScheduleEntry => entry !== null), failed: false };
}
