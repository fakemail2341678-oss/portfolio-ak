import type { Localized } from "@/lib/i18n/localized";

/**
 * Chaal's curated home (PLAN Task 84, decision 0274): what the admin features, and the
 * sections under the hero in the admin's order. Isomorphic: the home, the admin and the
 * server share these names.
 */

/** What can be featured: a broadcast (its tour), an arena or a Swiss, a study, a puzzle theme. */
export const CHAAL_FEATURED_KINDS = ["broadcast", "arena", "swiss", "study", "theme"] as const;
export type ChaalFeaturedKind = (typeof CHAAL_FEATURED_KINDS)[number];

/** The home's featured sections, each holding one or two kinds. */
export const CHAAL_FEATURED_SECTIONS = ["broadcasts", "tournaments", "studies", "themes"] as const;
export type ChaalFeaturedSection = (typeof CHAAL_FEATURED_SECTIONS)[number];

export const SECTION_KINDS: Readonly<Record<ChaalFeaturedSection, ReadonlyArray<ChaalFeaturedKind>>> = {
	broadcasts: ["broadcast"],
	tournaments: ["arena", "swiss"],
	studies: ["study"],
	themes: ["theme"],
};

export const sectionOf = (kind: ChaalFeaturedKind): ChaalFeaturedSection =>
	kind === "broadcast" ? "broadcasts" : kind === "study" ? "studies" : kind === "theme" ? "themes" : "tournaments";

/** The home's sections under the hero, in their default order: the announcement, the ways in, then what's featured. */
export const CHAAL_HOME_SECTIONS = ["announcement", "start", ...CHAAL_FEATURED_SECTIONS] as const;
export type ChaalHomeSectionKey = (typeof CHAAL_HOME_SECTIONS)[number];

export const isHomeSection = (key: string): key is ChaalHomeSectionKey =>
	(CHAAL_HOME_SECTIONS as ReadonlyArray<string>).includes(key);

/** Stored rows over the default order: the stored ones first in their order, then any the rows don't name. */
export function mergedSections(
	rows: ReadonlyArray<{ key: string; position: number; visible: boolean }>,
): Array<{ key: ChaalHomeSectionKey; visible: boolean }> {
	const stored = [...rows]
		.sort((a, b) => a.position - b.position)
		.flatMap((row) => (isHomeSection(row.key) ? [{ key: row.key, visible: row.visible }] : []));
	const named = new Set(stored.map((row) => row.key));
	return [...stored, ...CHAAL_HOME_SECTIONS.filter((key) => !named.has(key)).map((key) => ({ key, visible: true }))];
}

export type FeaturedState = "live" | "scheduled" | "ended";

/** Whether a featured item shows on `today` (an ISO date in Kathmandu's zone). */
export function featuredState(item: { startsOn: string | null; endsOn: string | null }, today: string): FeaturedState {
	if (item.startsOn && item.startsOn > today) return "scheduled";
	if (item.endsOn && item.endsOn < today) return "ended";
	return "live";
}

/** One featured item as the home shows it. */
export type ChaalFeaturedItem = { id: string; kind: ChaalFeaturedKind; ref: string; title: Localized };

/** What the home reads: its sections in order (hidden ones gone), each featured section's live items, the announcement. */
export type ChaalHome = {
	sections: ChaalHomeSectionKey[];
	featured: Record<ChaalFeaturedSection, ChaalFeaturedItem[]>;
	announcement: Localized | null;
};

/** Lichess's ids: eight letters and digits. A theme's key is Chaal's (checked on the server). */
const LICHESS_ID = /^[A-Za-z0-9]{8}$/;

/** The path segment before the id in a Lichess address. */
const URL_SEGMENT: Readonly<Record<Exclude<ChaalFeaturedKind, "theme" | "broadcast">, string>> = {
	arena: "tournament",
	swiss: "swiss",
	study: "study",
};

/**
 * The id in what the admin typed: the id itself, or the item's Lichess address
 * (`/tournament/{id}`, `/swiss/{id}`, `/study/{id}[/{chapter}]`, `/broadcast/{slug}/{id}`).
 * Null when it reads as neither. A theme's key comes back as typed.
 */
export function parseFeaturedRef(kind: ChaalFeaturedKind, input: string): string | null {
	const value = input.trim();
	if (kind === "theme") return /^[A-Za-z0-9]{1,40}$/.test(value) ? value : null;
	if (LICHESS_ID.test(value)) return value;
	let path: string[];
	try {
		const url = new URL(value);
		if (!/(^|\.)lichess\.org$/.test(url.hostname)) return null;
		path = url.pathname.split("/").filter(Boolean);
	} catch {
		return null;
	}
	let found: string | undefined;
	if (kind === "broadcast") {
		// A tour's address is /broadcast/{slug}/{id}; a round's has one segment more, and its id isn't the tour's.
		found = path[0] === "broadcast" && path.length === 3 ? path[2] : undefined;
	} else {
		const at = path.indexOf(URL_SEGMENT[kind]);
		found = at >= 0 ? path[at + 1] : undefined;
	}
	return found && LICHESS_ID.test(found) ? found : null;
}
