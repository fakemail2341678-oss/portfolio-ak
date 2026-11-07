import { describe, expect, it } from "vitest";
import { scheduleDays } from "@/features/parda/schedule/days";
import { episodeRangeLabel } from "@/features/parda/schedule/labels";
import type { ScheduleEntry } from "@/features/parda/schedule/types";
import { CHECK_EVERY_MS, ENDED_CHECK_EVERY_MS, isDue, isEnded, newEpisodes, paced } from "@/server/parda/notify/rules";

/** Task 68's pure rules (decision 0241): what counts as new, when a series is due, pacing, the schedule's days. */

const TODAY = "2026-11-05";
const at = (season: number, episode: number, airDate: string | null = TODAY) => ({ season, episode, airDate });

describe("newEpisodes", () => {
	it("says nothing on the first check: it only records where the series is", () => {
		expect(newEpisodes(null, at(2, 5), TODAY)).toBeNull();
	});

	it("says nothing when the latest episode hasn't moved, or moved back", () => {
		expect(newEpisodes({ season: 2, episode: 5 }, at(2, 5), TODAY)).toBeNull();
		expect(newEpisodes({ season: 2, episode: 5 }, at(2, 4), TODAY)).toBeNull();
		expect(newEpisodes({ season: 2, episode: 5 }, null, TODAY)).toBeNull();
	});

	it("is the next episode, or the run since the last one seen", () => {
		expect(newEpisodes({ season: 2, episode: 5 }, at(2, 6), TODAY)).toEqual({ season: 2, episode: 6, lastEpisode: 6 });
		expect(newEpisodes({ season: 2, episode: 5 }, at(2, 8), TODAY)).toEqual({ season: 2, episode: 6, lastEpisode: 8 });
	});

	it("starts a new season at its first episode, a whole season dropped at once included", () => {
		expect(newEpisodes({ season: 1, episode: 10 }, at(2, 1), TODAY)).toEqual({ season: 2, episode: 1, lastEpisode: 1 });
		expect(newEpisodes({ season: 1, episode: 10 }, at(2, 8), TODAY)).toEqual({ season: 2, episode: 1, lastEpisode: 8 });
	});

	it("tells a series that had nothing aired about its first episode", () => {
		expect(newEpisodes({ season: 0, episode: 0 }, at(1, 1), TODAY)).toEqual({ season: 1, episode: 1, lastEpisode: 1 });
	});

	it("ignores specials and old news", () => {
		expect(newEpisodes({ season: 1, episode: 3 }, at(0, 4), TODAY)).toBeNull();
		expect(newEpisodes({ season: 1, episode: 3 }, at(1, 4, "2026-10-22"), TODAY)).toEqual({
			season: 1,
			episode: 4,
			lastEpisode: 4,
		});
		expect(newEpisodes({ season: 1, episode: 3 }, at(1, 4, "2026-10-21"), TODAY)).toBeNull();
	});
});

describe("isDue", () => {
	const now = new Date("2026-11-05T02:00:00Z");
	const ago = (ms: number) => new Date(now.getTime() - ms);

	it("checks a new series at once, then daily, and an ended one weekly", () => {
		expect(isDue(undefined, now)).toBe(true);
		expect(isDue({ checkedAt: ago(CHECK_EVERY_MS - 1), ended: false }, now)).toBe(false);
		expect(isDue({ checkedAt: ago(CHECK_EVERY_MS), ended: false }, now)).toBe(true);
		expect(isDue({ checkedAt: ago(CHECK_EVERY_MS), ended: true }, now)).toBe(false);
		expect(isDue({ checkedAt: ago(ENDED_CHECK_EVERY_MS), ended: true }, now)).toBe(true);
	});

	it("reads TMDB's ended statuses", () => {
		expect(isEnded("Ended")).toBe(true);
		expect(isEnded("Canceled")).toBe(true);
		expect(isEnded("Returning Series")).toBe(false);
		expect(isEnded(null)).toBe(false);
	});
});

describe("paced", () => {
	it("keeps under the rate: each batch waits out its share of a second", async () => {
		let clock = 0;
		const waits: number[] = [];
		const seen: number[] = [];
		const done = await paced(
			Array.from({ length: 20 }, (_, index) => index),
			async (item) => {
				seen.push(item);
				clock += 10;
			},
			{
				perSecond: 35,
				concurrency: 7,
				now: () => clock,
				sleep: async (ms) => {
					waits.push(ms);
					clock += ms;
				},
			},
		);
		expect(done).toBe(20);
		expect(seen).toHaveLength(20);
		// Three batches (7, 7, 6): two waits, none after the last; 7 at 35 a second is 200 ms a batch.
		expect(waits).toHaveLength(2);
		for (const wait of waits) expect(wait).toBeGreaterThan(100);
		expect(clock).toBeGreaterThanOrEqual(400);
	});

	it("stops between batches when told to", async () => {
		let calls = 0;
		const done = await paced([1, 2, 3, 4, 5], async () => void calls++, {
			perSecond: 1_000,
			concurrency: 2,
			stop: () => calls >= 2,
			sleep: async () => undefined,
		});
		expect(done).toBe(2);
	});
});

const entry = (
	id: number,
	title: string,
	airDate: string,
	kind: ScheduleEntry["kind"],
	episode = 1,
): ScheduleEntry => ({
	id,
	slug: title.toLowerCase(),
	title,
	poster: null,
	season: 1,
	episode,
	name: "",
	airDate,
	kind,
});

describe("scheduleDays", () => {
	it("groups by day from today for 14 days, followed series first by title, then anime", () => {
		const days = scheduleDays(
			TODAY,
			[
				entry(1, "Zeta", TODAY, "following"),
				entry(2, "Alpha", TODAY, "following"),
				entry(3, "Beta", "2026-11-18", "following"),
			],
			[entry(4, "Kaiju", TODAY, "anime"), entry(5, "Mecha", "2026-11-07", "anime")],
		);
		expect(days.map((day) => day.day)).toEqual([TODAY, "2026-11-07", "2026-11-18"]);
		expect(days[0]?.entries.map((each) => each.title)).toEqual(["Alpha", "Zeta", "Kaiju"]);
	});

	it("leaves out what's before today or past the 14th day, and shows a followed anime once", () => {
		const days = scheduleDays(
			TODAY,
			[entry(1, "Followed", TODAY, "following"), entry(2, "Late", "2026-11-19", "following")],
			[entry(1, "Followed", TODAY, "anime"), entry(3, "Yesterday", "2026-11-04", "anime")],
		);
		expect(days).toHaveLength(1);
		expect(days[0]?.entries.map((each) => each.kind)).toEqual(["following"]);
	});
});

describe("episodeRangeLabel", () => {
	it("names one episode, or a run of a season", () => {
		expect(episodeRangeLabel({ season: 2, episode: 5, lastEpisode: 5 }, "en")).toBe("S2 · E5");
		expect(episodeRangeLabel({ season: 1, episode: 1, lastEpisode: 8 }, "en")).toBe("S1 · E1–8");
		expect(episodeRangeLabel({ season: 1, episode: 1, lastEpisode: 8 }, "ne")).toBe("सिजन १ · भाग १–८");
	});
});
