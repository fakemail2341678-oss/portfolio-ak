/**
 * What a profile can choose (PLAN Task 67, decision 0240): its picture, and the regions
 * TMDB has data for. Imports nothing, so the form, the server and tests share it.
 */

/** Pictures are drawn, not uploaded: an icon on a tile, so a profile never needs a file. */
export const PROFILE_AVATARS = ["sun", "moon", "star", "leaf", "wave", "flame", "cloud", "bolt"] as const;
export type ProfileAvatar = (typeof PROFILE_AVATARS)[number];

export const isProfileAvatar = (value: string | null | undefined): value is ProfileAvatar =>
	(PROFILE_AVATARS as ReadonlyArray<string>).includes(value ?? "");

/** An owner's profiles, at most: a household, not a list of everyone they know. */
export const MAX_PROFILES = 5;

/** A profile lock: four digits. */
export const PIN_PATTERN = /^\d{4}$/;

/**
 * TMDB's watch-provider regions (`watch/providers/regions`, 139 on 2026-11-05). A region
 * outside it gets no "where to watch", so a visitor's country is used only when it's here;
 * Nepal (NP) isn't, so it falls back to the admin's region (PLAN 12.4).
 */
export const TMDB_REGIONS: ReadonlyArray<string> = [
	"AD AE AG AL AO AR AT AU AZ BA BB BE BF BG BH BM BO BR BS BY",
	"BZ CA CD CH CI CL CM CO CR CU CV CY CZ DE DK DO DZ EC EE EG",
	"ES FI FJ FR GB GF GH GI GP GQ GR GT GY HK HN HR HU ID IE IL",
	"IN IQ IS IT JM JO JP KE KR KW LB LC LI LT LU LV LY MA MC MD",
	"ME MG MK ML MT MU MW MX MY MZ NE NG NI NL NO NZ OM PA PE PF",
	"PG PH PK PL PS PT PY QA RO RS RU SA SC SE SG SI SK SM SN SV",
	"TC TD TH TN TR TT TW TZ UA UG US UY VA VE XK YE ZA ZM ZW",
]
	.join(" ")
	.split(" ");

const REGIONS = new Set(TMDB_REGIONS);
export const isTmdbRegion = (value: string | null | undefined): value is string => REGIONS.has(value ?? "");
