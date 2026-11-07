import { z } from "zod";
import type { Localized } from "@/lib/i18n/localized";
import type { Paged } from "@/lib/list/paging";
import { localizedText, optionalText, required, slug } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { locales } from "@/paraglide/runtime";
import type { RailLabel } from "../home/types";
import { KIDS_CAPS } from "../kids";
import type { PardaSourceAdapter, PlayerTarget } from "../player/adapters/types";
import type { PardaReportKind, PardaReportStatus } from "../player/playback";
import type { PardaPage } from "../search";
import { PARDA_PAGES, type PardaOverviewRange } from "./search";

/**
 * Parda's admin (PLAN Task 65, decision 0237): one schema per write, shared by the form
 * and the server function, and the DTOs its pages read. Versions travel as `updatedAt`,
 * the row's integer `version` as a string, as every admin form sends it.
 */

/** A row's version as the form sends it back. */
const version = () => z.string().regex(/^[1-9][0-9]*$/);

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export const SOURCE_ADAPTERS = ["viduki", "parda", "none"] as const satisfies ReadonlyArray<PardaSourceAdapter>;
export const SOURCE_SANDBOXES = ["none", "popups", "strict"] as const;
export type LabSandbox = (typeof SOURCE_SANDBOXES)[number];
/** The admin's word on an adaptive stream, or the probe's (decision 0238). */
export const SOURCE_ADAPTIVE = ["probe", "yes", "no"] as const;
/** The admin's top quality (picture height), or the probe's. */
export const SOURCE_QUALITIES = ["probe", "2160", "1440", "1080", "720", "480", "360"] as const;

/** Every field of a source but its place in the order (PLAN 12.5): new rows go last, the order is its own write. */
export const sourceInput = z.strictObject({
	name: localizedText({ max: 60 }),
	movieTemplate: required({ max: 500 }),
	tvTemplate: required({ max: 500 }),
	/** Each an https origin; checked with the templates on the server (`sourceFieldProblems`). */
	origins: z.array(z.string().trim().min(1).max(200)).max(10),
	adapter: z.enum(SOURCE_ADAPTERS),
	sandbox: z.enum(SOURCE_SANDBOXES),
	adaptive: z.enum(SOURCE_ADAPTIVE),
	quality: z.enum(SOURCE_QUALITIES),
	needsClick: z.boolean(),
	/** Empty: a group of its own. */
	cdnGroup: optionalText({ max: 40 }),
	autoFallback: z.boolean(),
	enabled: z.boolean(),
	pinned: z.boolean(),
});
export type SourceInput = z.output<typeof sourceInput>;
export type SourceFormValues = z.input<typeof sourceInput>;
export const sourceUpdateInput = sourceInput.extend({ id: z.uuid(), updatedAt: version() });

/** Enabling or pinning from the list: last write wins, and an open form stays current. */
export const sourceStateInput = z.strictObject({
	id: z.uuid(),
	enabled: z.boolean().optional(),
	pinned: z.boolean().optional(),
});
export type SourceStateInput = z.output<typeof sourceStateInput>;

/** The whole order, every source once. */
export const sourceOrderInput = z.strictObject({ ids: z.array(z.uuid()).min(1).max(100) });

/** A source's latest daily rollup (decision 0238), as the sources page shows it. */
export type AdminSourceStanding = {
	/** The UTC day the rollup ran; its window is the 7 days before. */
	day: string;
	/** Null: no data, so the source keeps its seed position. */
	score: number | null;
	/** `viewers`: 20 plays or more; `probe`: the probe's numbers and neutral values. */
	from: "viewers" | "probe" | null;
	plays: number;
	failureRate: number | null;
	startMedianMs: number | null;
	/** Stall seconds per watched minute. */
	stallPerMinute: number | null;
	popupsPerClick: number | null;
	probeRuns: number;
	probedAt: string | null;
};

export type AdminSource = SourceInput & {
	id: string;
	position: number;
	/** Where an enabled source starts in today's order (an ordinary connection); null when disabled. */
	rank: number | null;
	updatedAt: string;
	/** Reports still open about this source, and how many of them are about ads (PLAN 12.5). */
	openReports: number;
	adsReports: number;
	/** The quality and adaptive flag in use: the admin's, else the probe's. */
	height: number | null;
	heightFrom: "admin" | "probe" | null;
	adaptiveNow: boolean;
	standing: AdminSourceStanding | null;
};

export type LabSource = {
	id: string;
	name: Localized;
	adapter: PardaSourceAdapter;
	enabled: boolean;
	sandbox: LabSandbox;
};

// ---------------------------------------------------------------------------
// Player lab
// ---------------------------------------------------------------------------

/** Trouble the placeholder player can rehearse (src/server/parda/player/placeholder.ts). */
export const PLACEHOLDER_CUES = ["fail", "stall", "silent"] as const;
export type PlaceholderCue = (typeof PLACEHOLDER_CUES)[number];

export const labPlayerInput = z.strictObject({
	sourceId: z.uuid(),
	media: z.enum(["movie", "tv"]),
	id: z.number().int().positive().max(999_999_999),
	season: z.number().int().nonnegative().max(9_999),
	episode: z.number().int().positive().max(99_999),
	start: z.number().int().nonnegative().max(999_999),
	cue: z.enum(PLACEHOLDER_CUES).nullable(),
});
export type LabPlayerInput = z.infer<typeof labPlayerInput>;

/** One filled player. An empty `origins` with a path means this app itself. */
export type LabPlayer = {
	url: string;
	/** The title it shows, for a player that reports every title it remembers (`viduki`). */
	target: PlayerTarget;
	origins: string[];
	adapter: PardaSourceAdapter;
	sandbox: LabSandbox;
	name: Localized;
};

// ---------------------------------------------------------------------------
// Takedowns
// ---------------------------------------------------------------------------

export const PARDA_MEDIA = ["movie", "tv"] as const;
export type PardaAdminMedia = (typeof PARDA_MEDIA)[number];

export const takedownInput = z.strictObject({
	media: z.enum(PARDA_MEDIA),
	tmdbId: z.number().int().positive().max(999_999_999),
	reason: required({ max: 500 }),
});
export type TakedownInput = z.output<typeof takedownInput>;
export type TakedownFormValues = z.input<typeof takedownInput>;

export type AdminTakedown = {
	id: string;
	media: PardaAdminMedia;
	tmdbId: number;
	/** From the title snapshot (`pd_title`); null for a title Parda hasn't listed. */
	title: Localized | null;
	reason: string;
	blockedBy: string | null;
	createdAt: string;
};
export type AdminTakedownPage = Paged<AdminTakedown>;

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const satisfies ReadonlyArray<PardaReportStatus>;

export const reportStatusInput = z.strictObject({
	ids: z.array(z.uuid()).min(1).max(100),
	status: z.enum(REPORT_STATUSES),
});
export type ReportStatusInput = z.output<typeof reportStatusInput>;

export type AdminReport = {
	id: string;
	kind: PardaReportKind;
	media: PardaAdminMedia;
	tmdbId: number;
	season: number | null;
	episode: number | null;
	title: Localized | null;
	source: { id: string; name: Localized } | null;
	note: string;
	status: PardaReportStatus;
	reporter: string | null;
	resolvedBy: string | null;
	resolvedAt: string | null;
	createdAt: string;
};
export type AdminReportPage = Paged<AdminReport>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** The certifications a kids' profile may be capped at (TMDB's US ladder: NP has none, PLAN 12.4). */

export const settingsInput = z.strictObject({
	/** ISO 3166-1 alpha-2: TMDB's certifications and watch providers fall back to it. */
	region: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z]{2}$/),
	/** The languages players are asked for (`{lang}`): the page's when listed, else the first. */
	languages: z.array(z.enum(locales)).min(1).max(locales.length),
	kidsCap: z.enum(KIDS_CAPS),
	/** A notice under Parda's top mask on every page; empty English hides it. */
	banner: localizedText({ max: 200, optional: true }),
	updatedAt: version(),
});
export type SettingsInput = z.output<typeof settingsInput>;

export type AdminSettings = {
	region: string;
	languages: Array<(typeof locales)[number]>;
	kidsCap: string;
	banner: Localized;
	playbackEnabled: boolean;
	cacheEpoch: number;
	/** `auto`: by the daily scores; `manual`: the admin's order. Pinned rows lead in either. */
	sourceOrder: "auto" | "manual";
	updatedAt: string;
};

export const playbackInput = z.strictObject({ enabled: z.boolean() });

export const SOURCE_ORDER_MODES = ["auto", "manual"] as const;
export const sourceOrderModeInput = z.strictObject({ mode: z.enum(SOURCE_ORDER_MODES) });

// ---------------------------------------------------------------------------
// Curation (PLAN Task 69, decision 0242)
// ---------------------------------------------------------------------------

/** A title as the picker holds it: "movie:550". */
const titleRef = () => z.string().regex(/^(movie|tv):[1-9][0-9]{0,8}$/, { error: () => m.pd_admin_title_required() });

export const parseTitleRef = (ref: string): { media: PardaAdminMedia; id: number } => {
	const [media, id] = ref.split(":");
	return { media: media === "tv" ? "tv" : "movie", id: Number(id) };
};

/** A title found by the picker. */
export type TitleOption = { ref: string; media: PardaAdminMedia; id: number; title: string; year: number | null };

export const titleSearchInput = z.strictObject({ q: z.string().trim().max(100) });

const dateField = () => z.iso.date().or(z.literal(""));

const billboardFields = z.strictObject({
	page: z.enum(PARDA_PAGES),
	title: titleRef(),
	/** Empty English keeps TMDB's tagline. */
	tagline: localizedText({ max: 120, optional: true }),
	startsOn: dateField(),
	endsOn: dateField(),
});

const datesInOrder = (value: { startsOn: string; endsOn: string }, context: z.RefinementCtx) => {
	if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
		context.addIssue({ code: "custom", path: ["endsOn"], message: m.pd_admin_billboard_dates_order() });
	}
};

export const billboardInput = billboardFields.superRefine(datesInOrder);
export type BillboardInput = z.output<typeof billboardInput>;
export type BillboardFormValues = z.input<typeof billboardInput>;
export const billboardUpdateInput = billboardFields
	.extend({ id: z.uuid(), updatedAt: version() })
	.superRefine(datesInOrder);

export const billboardOrderInput = z.strictObject({
	page: z.enum(PARDA_PAGES),
	ids: z.array(z.uuid()).min(1).max(100),
});

export type AdminBillboard = {
	id: string;
	page: PardaPage;
	media: PardaAdminMedia;
	tmdbId: number;
	title: Localized | null;
	tagline: Localized;
	startsOn: string;
	endsOn: string;
	state: "live" | "scheduled" | "ended";
	updatedAt: string;
};

/** A collection holds at most this many titles: each is a details call the first time it's read. */
export const COLLECTION_MAX_TITLES = 50;

const collectionFields = z.strictObject({
	name: localizedText({ max: 80 }),
	slug: slug(),
	description: localizedText({ max: 500, optional: true }),
	published: z.boolean(),
	items: z.array(titleRef()).max(COLLECTION_MAX_TITLES),
});

const publishedHasTitles = (value: { published: boolean; items: string[] }, context: z.RefinementCtx) => {
	if (value.published && value.items.length === 0) {
		context.addIssue({ code: "custom", path: ["items"], message: m.pd_admin_collection_needs_titles() });
	}
};

export const collectionInput = collectionFields.superRefine(publishedHasTitles);
export type CollectionInput = z.output<typeof collectionInput>;
export type CollectionFormValues = z.input<typeof collectionInput>;
export const collectionUpdateInput = collectionFields
	.extend({ id: z.uuid(), updatedAt: version() })
	.superRefine(publishedHasTitles);

export type AdminCollectionItem = { ref: string; media: PardaAdminMedia; tmdbId: number; title: Localized | null };

export type AdminCollection = {
	id: string;
	name: Localized;
	slug: string;
	description: Localized;
	published: boolean;
	count: number;
	items: AdminCollectionItem[];
	updatedAt: string;
	modifiedAt: string;
};

/** One rail on the layout page: named by its label (a rail in code) or its collection. */
export type AdminLayoutRail = {
	key: string;
	visible: boolean;
	label: RailLabel;
	/** A curated collection's rail, and whether viewers can see it yet. */
	collection: { name: Localized; published: boolean } | null;
};

export type AdminLayout = { page: PardaPage; saved: boolean; rails: AdminLayoutRail[] };

export const layoutInput = z.strictObject({
	page: z.enum(PARDA_PAGES),
	rails: z
		.array(z.strictObject({ key: z.string().regex(/^[a-z0-9-]{1,40}$/), visible: z.boolean() }))
		.min(1)
		.max(200),
});
export type LayoutInput = z.output<typeof layoutInput>;

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export type AdminOverviewDay = {
	day: string;
	account: number;
	guest: number;
	anonymous: number;
	viewers: number;
	watchedS: number;
};

export type AdminOverview = {
	range: PardaOverviewRange;
	today: string;
	/** Plays in each window, whichever range is chosen. */
	plays: { today: number; week: number; month: number };
	openReports: number;
	/** The chosen range. */
	viewersPerDay: number;
	watchedS: number;
	failureRate: number | null;
	byKind: { account: number; guest: number; anonymous: number };
	/** The last 30 days, oldest first, every day there. */
	days: AdminOverviewDay[];
	topTitles: Array<{
		media: PardaAdminMedia;
		tmdbId: number;
		title: Localized | null;
		plays: number;
		watchedS: number;
	}>;
	topSearches: Array<{ query: string; count: number }>;
	zeroSearches: Array<{ query: string; count: number }>;
	servers: Array<{ id: string; name: Localized; plays: number; failed: number; failureRate: number }>;
};
