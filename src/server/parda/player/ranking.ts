import "@tanstack/react-start/server-only";
import type { PardaSourceAdapter } from "@/features/parda/player/adapters/types";
import type { PardaSourceOrder } from "@/server/db/schema";

/**
 * Source ranking (PLAN 12.5, "Source ranking"; decision 0238), pure so every rule is
 * unit-tested: each source's factors and score from the last 7 days, and the orders the
 * watch page starts from. The daily job scores; the watch page orders at each play from
 * the stored scores and the rows as they are now, so a pin or the mode applies at once.
 *
 *   score = availability × (0.4 × quality + 0.4 × smoothness + 0.2 × speed) − ads
 */

export const RANKING = {
	windowDays: 7,
	/** Fewer plays than this in the window: the probe's numbers and neutral values instead. */
	minPlays: 20,
	/** In automatic order, this share of plays starts on an eligible source short of data. */
	exploreRate: 0.05,
	weights: { quality: 0.4, smoothness: 0.4, speed: 0.2 },
	/** Score lost per popup per click. */
	adsPerPopup: 0.1,
	/** Stall seconds per watched minute at which smoothness reaches 0. */
	stallFloorSPerMin: 6,
	/** Median start at which speed reaches 0. */
	speedFloorMs: 20_000,
	/** A picture this tall or taller is full quality; shorter ones scale (720p 0.67, 480p 0.44). */
	fullHeight: 1080,
	/** What a factor is worth when nothing measured it. */
	neutral: 0.5,
} as const;

/** One source's window, as the rollup reads it. */
export type SourceMeasures = {
	adapter: PardaSourceAdapter;
	/** Viewers' plays (party plays never count). */
	plays: number;
	failed: number;
	startMedianMs: number | null;
	stallMs: number;
	watchedS: number;
	/** The probe's runs, how many played, and what it saw. */
	probeRuns: number;
	probeAlive: number;
	probeHeight: number | null;
	probePopups: number;
	probeClicks: number;
	/** The admin's top quality (height), which wins over the probe's. */
	quality: number | null;
};

export type Factors = {
	availability: number;
	quality: number;
	smoothness: number;
	speed: number;
	ads: number;
	/** `viewers`: enough plays; `probe`: the probe's numbers and neutral values. */
	from: "viewers" | "probe";
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number, places = 4) => Math.round(value * 10 ** places) / 10 ** places;

/** 1080p or more is 1, shorter scales with height; unknown is neutral. */
export const qualityFactor = (height: number | null): number =>
	height === null || height <= 0 ? RANKING.neutral : round(Math.min(1, height / RANKING.fullHeight), 2);

/** 1 − stall seconds per watched minute ÷ 6, floor 0; nothing watched is neutral. */
export const smoothnessFactor = (stallMs: number, watchedS: number): number =>
	watchedS <= 0 ? RANKING.neutral : clamp01(1 - stallMs / 1000 / (watchedS / 60) / RANKING.stallFloorSPerMin);

/** 1 − median start ÷ 20 s, floor 0; no start measured is neutral. */
export const speedFactor = (medianMs: number | null): number =>
	medianMs === null ? RANKING.neutral : clamp01(1 - medianMs / RANKING.speedFloorMs);

/** 0.1 × popups per click; no clicks, no ads seen. */
export const adsPenalty = (popups: number, clicks: number): number =>
	clicks <= 0 ? 0 : round(RANKING.adsPerPopup * (popups / clicks));

/**
 * A source's factors, or null when nothing measured it (it keeps its seed position).
 * A source that reports nothing (`none`) can't be measured by viewers, so it's never scored.
 */
export function factorsOf(measures: SourceMeasures): Factors | null {
	if (measures.adapter === "none") return null;
	const height = measures.quality ?? measures.probeHeight;
	const ads = adsPenalty(measures.probePopups, measures.probeClicks);
	if (measures.plays >= RANKING.minPlays) {
		return {
			// A probe failure alone never demotes a source viewers watch: availability is theirs.
			availability: clamp01(1 - measures.failed / measures.plays),
			quality: qualityFactor(height),
			smoothness: smoothnessFactor(measures.stallMs, measures.watchedS),
			speed: speedFactor(measures.startMedianMs),
			ads,
			from: "viewers",
		};
	}
	if (measures.probeRuns === 0) return null;
	return {
		availability: clamp01(measures.probeAlive / measures.probeRuns),
		quality: qualityFactor(height),
		// The probe's runners aren't where the viewers are: its speed and stalls aren't scored.
		smoothness: RANKING.neutral,
		speed: RANKING.neutral,
		ads,
		from: "probe",
	};
}

export function scoreOf(factors: Factors): number {
	const { weights } = RANKING;
	return round(
		factors.availability *
			(weights.quality * factors.quality + weights.smoothness * factors.smoothness + weights.speed * factors.speed) -
			factors.ads,
	);
}

export const scoreSource = (measures: SourceMeasures): number | null => {
	const factors = factorsOf(measures);
	return factors ? scoreOf(factors) : null;
};

/** One playable row, as the watch page orders it. */
export type RankRow = {
	id: string;
	position: number;
	pinned: boolean;
	adaptive: boolean;
	/** The latest daily score; null keeps the seed position. */
	score: number | null;
	/** Viewers' plays in the latest window. */
	plays: number;
	/** False for a source that reports nothing (`none`): viewers can't measure it. */
	measurable: boolean;
};

const bySeed = (a: RankRow, b: RankRow) => a.position - b.position || a.id.localeCompare(b.id);

/**
 * The `ok` order. Pinned rows lead in either mode, in seed order. Manual: the seed order.
 * Automatic: scored rows by score, while a row without a score keeps its seed slot, so a
 * new source sits where the admin put it until there's data.
 */
export function okOrder(rows: ReadonlyArray<RankRow>, mode: PardaSourceOrder): string[] {
	const pinned = rows.filter((row) => row.pinned).sort(bySeed);
	const rest = rows.filter((row) => !row.pinned).sort(bySeed);
	if (mode === "manual") return [...pinned, ...rest].map((row) => row.id);
	const scored = rest
		.filter((row) => row.score !== null)
		.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || bySeed(a, b));
	let next = 0;
	const ranked = rest.map((row) => {
		if (row.score === null) return row;
		const filled = scored[next];
		next += 1;
		return filled ?? row;
	});
	return [...pinned, ...ranked].map((row) => row.id);
}

/** The `slow` order: pinned rows still lead, then adaptive sources, each part keeping the `ok` order. */
export function slowOrder(ok: ReadonlyArray<string>, rows: ReadonlyArray<RankRow>): string[] {
	const byId = new Map(rows.map((row) => [row.id, row]));
	const part = (test: (row: RankRow) => boolean) =>
		ok.filter((id) => {
			const row = byId.get(id);
			return row ? test(row) : false;
		});
	return [
		...part((row) => row.pinned),
		...part((row) => !row.pinned && row.adaptive),
		...part((row) => !row.pinned && !row.adaptive),
	];
}

/** Sources failing on this title go last: still in the server menu, tried only when the rest have failed. */
export function skipLast(order: ReadonlyArray<string>, skipped: ReadonlySet<string>): string[] {
	return [...order.filter((id) => !skipped.has(id)), ...order.filter((id) => skipped.has(id))];
}

/**
 * Exploration (PLAN 12.5, "Data needed"): in automatic order, with no pinned row, 5% of
 * plays start on an eligible source short of data, so a new source earns a score. Only
 * once some source has data: with none, every play keeps the seed order. Parties never call this.
 */
export function explorePick(
	candidates: ReadonlyArray<string>,
	options: { random: () => number; rate?: number },
): string | null {
	if (candidates.length === 0) return null;
	if (options.random() >= (options.rate ?? RANKING.exploreRate)) return null;
	return candidates[Math.min(candidates.length - 1, Math.floor(options.random() * candidates.length))] ?? null;
}

export const toFront = (order: ReadonlyArray<string>, id: string | null): string[] =>
	id === null || !order.includes(id) ? [...order] : [id, ...order.filter((each) => each !== id)];

/**
 * The two orders one play starts from (PLAN 12.5, "At click"): the mode's `ok` order and
 * its `slow` twin, this title's failing sources last, and now and then a source short of
 * data first (automatic order only, never past a pin).
 */
export function watchOrders(
	rows: ReadonlyArray<RankRow>,
	options: { mode: PardaSourceOrder; skipped: ReadonlySet<string>; random: () => number },
): { ok: string[]; slow: string[] } {
	const ok = okOrder(rows, options.mode);
	const slow = slowOrder(ok, rows);
	let pick: string | null = null;
	if (
		options.mode === "auto" &&
		!rows.some((row) => row.pinned) &&
		rows.some((row) => row.measurable && row.plays >= RANKING.minPlays)
	) {
		pick = explorePick(
			rows
				.filter((row) => row.measurable && row.plays < RANKING.minPlays && !options.skipped.has(row.id))
				.map((row) => row.id),
			{ random: options.random },
		);
	}
	return {
		ok: toFront(skipLast(ok, options.skipped), pick),
		slow: toFront(skipLast(slow, options.skipped), pick),
	};
}

/** The admin's word wins over the probe's (PLAN Task 65a); with neither, a stream isn't adaptive. */
export const effectiveAdaptive = (admin: boolean | null, probe: boolean | null | undefined): boolean =>
	admin ?? probe ?? false;
export const effectiveHeight = (admin: number | null, probe: number | null | undefined): number | null =>
	admin ?? probe ?? null;

/** "1080p" for the server menu; null when unknown. */
export const qualityLabel = (height: number | null): string | null => (height && height > 0 ? `${height}p` : null);
