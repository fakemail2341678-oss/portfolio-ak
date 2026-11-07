import { m } from "@/paraglide/messages";

/**
 * The archival pictures of the design (decision 0183): public domain
 * photographs and a map of the Himalaya and Kathmandu, found on Wikimedia
 * Commons with taste-skill's assets tool, cropped (the books' printed
 * captions removed), greyed and saved as WebP in public/himal/ at two widths.
 * They show the world the site is about, never the owner's own work, and every
 * one is credited in the footer. The design owns them, not the content: the
 * portfolio layer (pnpm strip-demo) removes them.
 */

export type ArchivalPicture = {
	/** File stem in public/himal/: `${file}-${width}.webp`. */
	file: string;
	/** The widths saved, smallest first; the last is the intrinsic size. */
	widths: readonly [number, number];
	/** Intrinsic size of the largest file. */
	width: number;
	height: number;
	alt: () => string;
	caption: () => string;
	/** Who made it and when, as the credit line prints it. */
	credit: string;
	/** Its page on Wikimedia Commons (licence and provenance). */
	source: string;
};

export const ARCHIVE = {
	kangchenGlacier: {
		file: "kangchen-glacier-1899",
		widths: [1000, 2000],
		width: 2000,
		height: 355,
		alt: m.portfolio_archive_glacier_alt,
		caption: m.portfolio_archive_glacier_caption,
		credit: "Vittorio Sella, the Kangchen Glacier, 1899",
		source: "https://commons.wikimedia.org/wiki/File:Kangchen_Glacier_in_Nepal.png",
	},
	jonsongLa: {
		file: "jonsong-la-1899",
		widths: [800, 1400],
		width: 1400,
		height: 866,
		alt: m.portfolio_archive_jonsong_alt,
		caption: m.portfolio_archive_jonsong_caption,
		credit: "Vittorio Sella, below the Jonsong La, 1899",
		source:
			"https://commons.wikimedia.org/wiki/File:Round_Kangchenjunga;_a_narrative_of_mountain_travel_and_exploration_(1903)_(14587023698).jpg",
	},
	kangchenjungaDawn: {
		file: "kangchenjunga-dawn",
		widths: [800, 1600],
		width: 1600,
		height: 1058,
		alt: m.portfolio_archive_dawn_alt,
		caption: m.portfolio_archive_dawn_caption,
		credit: "Kangchenjunga at first light, Round Kangchenjunga, 1903",
		source:
			"https://commons.wikimedia.org/wiki/File:Round_Kangchenjunga;_a_narrative_of_mountain_travel_and_exploration_(1903)_(14587194067).jpg",
	},
	kathmandu1920: {
		file: "kathmandu-1920",
		widths: [750, 1500],
		width: 1500,
		height: 1050,
		alt: m.portfolio_archive_kathmandu_alt,
		caption: m.portfolio_archive_kathmandu_caption,
		credit: "Kathmandu and the Tundikhel, about 1920",
		source: "https://commons.wikimedia.org/wiki/File:Kathmandu_and_tundikhel_ca_1920.jpg",
	},
	valleyMap: {
		file: "valley-map-1928",
		widths: [700, 1200],
		width: 1200,
		height: 1000,
		alt: m.portfolio_archive_map_alt,
		caption: m.portfolio_archive_map_caption,
		credit: "Perceval Landon, Map of the Valley, 1928",
		source: "https://commons.wikimedia.org/wiki/File:The_map_of_Kathmandu_Valley,_Nepal_by_Landon_in_1928.jpg",
	},
} as const satisfies Record<string, ArchivalPicture>;

export type ArchiveKey = keyof typeof ARCHIVE;
