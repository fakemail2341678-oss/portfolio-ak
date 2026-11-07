/**
 * The kids' cap (PLAN 12.5, "Kids"; decision 0240): a certification on TMDB's US ladder,
 * the admin's default (`pd_settings.kids_cap`) or a profile's own. Pure, so the server's
 * catalogue, the recorder and the profile form share it.
 *
 * A cap names the movie certificates it allows and their TV equivalents. Lists are asked
 * for with the exact certificates (`certification=G|PG`), never `certification.lte`:
 * TMDB counts NR (not rated, order 0) as below every rating, so `lte` lets unrated titles
 * in (checked 2026-11-05).
 */
export const KIDS_CAPS = ["G", "PG", "PG-13", "R"] as const;
export type KidsCap = (typeof KIDS_CAPS)[number];

/** TMDB's US certificates, mildest first (`certification/{movie,tv}/list`, checked 2026-11-05), without NR. */
const MOVIE_LADDER = ["G", "PG", "PG-13", "R", "NC-17"] as const;
/** Each movie certificate's TV counterparts: what a parent choosing "PG" would expect on TV too. */
const TV_FOR: Readonly<Record<KidsCap, ReadonlyArray<string>>> = {
	G: ["TV-Y", "TV-Y7", "TV-G"],
	PG: ["TV-Y", "TV-Y7", "TV-G", "TV-PG"],
	"PG-13": ["TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14"],
	R: ["TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA"],
};

export const isKidsCap = (value: string | null | undefined): value is KidsCap =>
	(KIDS_CAPS as ReadonlyArray<string>).includes(value ?? "");

/** The certificates a cap allows for a media type. An unknown cap allows the mildest only. */
export function allowedRatings(cap: string, media: "movie" | "tv"): ReadonlyArray<string> {
	const known: KidsCap = isKidsCap(cap) ? cap : "G";
	if (media === "tv") return TV_FOR[known];
	return MOVIE_LADDER.slice(0, MOVIE_LADDER.indexOf(known) + 1);
}

/** Whether a title's US certificate is within the cap. No certificate is never within one (fail closed). */
export const withinCap = (cap: string, media: "movie" | "tv", rating: string | null | undefined): boolean =>
	Boolean(rating) && allowedRatings(cap, media).includes(rating ?? "");
