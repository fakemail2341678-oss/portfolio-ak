import { type ReactNode, useLayoutEffect } from "react";
import type { BillboardItem } from "../../src/features/parda/kit/billboard";
import type { EpisodeCardItem, PosterCardItem } from "../../src/features/parda/kit/cards";
import type { PardaImage } from "../../src/features/parda/kit/image";
import type { Session } from "../../src/lib/session";

/**
 * Parda's stories: the section on <html> (the root sets it from the brand in the app),
 * with the visitor picks most likely to show through, which the section must outrank.
 */
export function PardaSection({ children }: { children: ReactNode }) {
	useLayoutEffect(() => {
		const { dataset } = document.documentElement;
		const { accent, radius } = dataset;
		dataset.section = "parda";
		dataset.accent = "rose";
		dataset.radius = "round";
		return () => {
			delete dataset.section;
			if (accent) dataset.accent = accent;
			else delete dataset.accent;
			if (radius) dataset.radius = radius;
			else delete dataset.radius;
		};
	}, []);
	return children;
}

export const withParda = (Story: () => ReactNode) => (
	<PardaSection>
		<Story />
	</PardaSection>
);

/**
 * A stand-in picture, drawn rather than fetched: stories never call TMDB (its images
 * are real films' art, and the network makes runs flaky). Each seed is its own
 * colours, and the shapes are dark and light enough to test text beside them.
 */
export function samplePicture(seed: number, kind: "poster" | "backdrop"): PardaImage {
	const [width, height] = kind === "poster" ? [2, 3] : [16, 9];
	const hue = (seed * 67) % 360;
	const w = width * 100;
	const h = height * 100;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 38%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 12%)"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${w * 0.7}" cy="${h * 0.35}" r="${Math.min(w, h) * 0.22}" fill="hsl(${(hue + 180) % 360} 70% 70%)" opacity=".55"/><rect x="0" y="${h * 0.72}" width="${w}" height="${h * 0.28}" fill="hsl(${hue} 30% 8%)" opacity=".6"/></svg>`;
	const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
	return { src, srcSet: `${src} 780w`, width, height };
}

const TITLES = [
	["The Long Monsoon", 2024, "Some rivers only run one way."],
	["Glass Harbour", 2019, "Every light on the water belongs to someone."],
	["Seven Bridges North", 2022, ""],
	["Paper Kites", 2021, "Two brothers. One summer. No wind."],
	["A Quiet Hour in Patan", 2023, "The city keeps its own time."],
	["Night Shift at the Observatory", 2018, "Somebody has to watch the sky."],
	["Under the Old Pipal", 2020, ""],
	["Frontier Radio", 2025, "Broadcasting to nobody, for now."],
	["The Salt Road", 2017, "Seven hundred miles of nothing to lose."],
	["Lantern Season", 2024, "Light one for everyone who left."],
	["Echo Valley", 2016, ""],
	["The Cartographer's Daughter", 2022, "She drew the map. Now she has to walk it."],
] as const;

const GENRES = [
	["Drama", "Mystery"],
	["Thriller"],
	["Adventure", "Family"],
	["Comedy", "Drama"],
	["Documentary"],
	["Science fiction", "Drama"],
] as const;

const OVERVIEW =
	"When the last ferry stops running, a lighthouse keeper and a stranded surveyor have one winter to decide what the island is worth, and to whom.";

/** Twelve titles with pictures, one without a poster and one without a backdrop (the designed empty states). */
export const sampleTitles: Array<PosterCardItem & { key: string; tagline: string }> = TITLES.map(
	([title, year, tagline], index) => ({
		key: `movie-${index + 1}`,
		title,
		year,
		tagline,
		poster: index === 6 ? null : samplePicture(index + 1, "poster"),
		backdrop: index === 2 ? null : samplePicture(index + 1, "backdrop"),
		overview: OVERVIEW,
		genres: [...(GENRES[index % GENRES.length] ?? [])],
		rating: index === 4 ? null : 6 + ((index * 7) % 30) / 10,
	}),
);

export const sampleBillboard: BillboardItem[] = sampleTitles.slice(0, 5).map((item, index) => ({
	key: item.key,
	title: item.title,
	tagline: item.tagline,
	year: item.year,
	runtime: index === 3 ? null : 96 + index * 13,
	seasons: index === 3 ? 3 : null,
	certification: ["PG-13", "R", "U/A 13+", "TV-MA", "PG"][index] ?? null,
	rating: item.rating ?? null,
	backdrop: item.backdrop ?? null,
	poster: item.poster,
}));

export const sampleEpisodes: EpisodeCardItem[] = [
	"Low Water",
	"The Surveyor",
	"What the Gulls Know",
	"Ferry Timetable",
	"A House on the Point",
].map((name, index) => ({
	season: 1,
	episode: index + 1,
	name,
	still: index === 4 ? null : samplePicture(index + 20, "backdrop"),
	runtime: 44 + index,
	airDate: `2024-0${index + 1}-1${index}`,
	overview: OVERVIEW,
}));

export const samplePeople = [
	["Asha Gurung", "Mira"],
	["Daniel Okafor", "The Surveyor"],
	["Pemba Sherpa", "Old Tenzing"],
	["Lucía Ferrer", "Harbour master"],
	["Rohan Mehta", null],
	["Sabina Karki", "Director"],
].map(([name, role], index) => ({
	key: `person-${index + 1}`,
	name: name ?? "",
	role: role ?? null,
	profile: index === 4 ? null : samplePicture(index + 40, "poster"),
}));

export const sampleParda = {
	viewer: {
		user: { id: "pd-1", email: "mira@example.com", name: "Mira Gurung", role: "user", twoFactorEnabled: false },
		permissions: [],
	} satisfies Session,
	guest: {
		user: { id: "guest-1", email: "guest-1@anonymous.invalid", name: "Guest", role: "user", twoFactorEnabled: false },
		permissions: [],
		isAnonymous: true,
	} satisfies Session,
};
