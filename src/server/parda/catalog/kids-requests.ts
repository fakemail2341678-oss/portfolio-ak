/**
 * A kids' profile's lists (PLAN 12.5, "Kids"; decision 0240). Pure and free of the app's
 * aliases at runtime, like rails.ts, so `pnpm tmdb:record` records the same requests.
 *
 * Under a cap, every list TMDB can filter becomes a discover query with the cap's US
 * certificates: discover queries gain them, and the popular, top rated and trending lists
 * of one media type are asked as discover queries in the same order. Anything else (a
 * list of both media types, upcoming, on the air) comes back as null: the catalogue
 * filters it through the certificates `pd_title` knows instead, and an unknown one stays out.
 */
import { allowedRatings } from "../../../features/parda/kids.ts";
import type { RailRequest } from "./rails";

/** Enough votes that a kids' "top rated" isn't led by a title three people rated (as the rails' own). */
const RATED_FLOOR = 200;
/** A popular list asked as discover keeps out titles almost nobody has seen. */
const POPULAR_FLOOR = 50;

const certificates = (cap: string, media: "movie" | "tv") => ({
	certification_country: "US",
	certification: allowedRatings(cap, media).join("|"),
});

/** The capped request, or null when TMDB can't filter this list by certificate. */
export function cappedRequest(request: RailRequest, cap: string): RailRequest | null {
	const { media, path, params } = request;
	if (media === "mixed") return null;
	if (path === `discover/${media}`) return { media, path, params: { ...params, ...certificates(cap, media) } };
	const discover = (sort: Record<string, string | number>) => ({
		media,
		path: `discover/${media}`,
		params: { ...sort, ...certificates(cap, media), ...(params.page === undefined ? {} : { page: params.page }) },
	});
	if (path === `${media}/popular` || path.startsWith(`trending/${media}/`)) {
		return discover({ sort_by: "popularity.desc", "vote_count.gte": POPULAR_FLOOR });
	}
	if (path === `${media}/top_rated`) return discover({ sort_by: "vote_average.desc", "vote_count.gte": RATED_FLOOR });
	return null;
}
