import { m } from "@/paraglide/messages";
import { GENRE_LABELS } from "../genres";
import type { AnimeKeyword, RailLabel, RailLabelKey } from "./types";

const LABELS: Readonly<Record<RailLabelKey, () => string>> = {
	top10: m.pd_rail_top10,
	trending: m.pd_rail_trending,
	popular: m.pd_rail_popular,
	popularMovies: m.pd_rail_popular_movies,
	popularSeries: m.pd_rail_popular_series,
	popularAnime: m.pd_rail_popular_anime,
	topRated: m.pd_rail_top_rated,
	topRatedMovies: m.pd_rail_top_rated_movies,
	topRatedSeries: m.pd_rail_top_rated_series,
	upcoming: m.pd_rail_upcoming,
	onTheAir: m.pd_rail_on_the_air,
	airingToday: m.pd_rail_airing_today,
	thisSeason: m.pd_rail_this_season,
	animeFilms: m.pd_rail_anime_films,
};

const KEYWORDS: Readonly<Record<AnimeKeyword, () => string>> = {
	isekai: m.pd_rail_isekai,
	shounen: m.pd_rail_shounen,
	mecha: m.pd_rail_mecha,
	sliceOfLife: m.pd_rail_slice_of_life,
};

/** A rail's heading in the page's language, at render time (the server sends only what it is). */
export function railLabel(label: RailLabel): string {
	if ("key" in label) return LABELS[label.key]();
	if ("keyword" in label) return KEYWORDS[label.keyword]();
	if ("text" in label) return label.text;
	const genre = GENRE_LABELS[label.genre]?.() ?? "";
	if (label.of === "movies") return m.pd_rail_genre_movies({ genre });
	if (label.of === "series") return m.pd_rail_genre_series({ genre });
	return genre;
}
