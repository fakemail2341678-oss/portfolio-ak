import { fn } from "storybook/test";
import type { AdminOverview } from "../../../../src/features/parda/admin/schema";

// Stand-ins for src/functions/parda-admin/overview.ts: a fortnight of plays by kind of viewer.
const today = "2026-11-05";
const dayOf = (index: number) => {
	const date = new Date(`${today}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + index - 29);
	return date.toISOString().slice(0, 10);
};

export const PARDA_STORY_OVERVIEW: AdminOverview = {
	range: "7d",
	today,
	plays: { today: 42, week: 318, month: 1204 },
	openReports: 3,
	viewersPerDay: 27.4,
	watchedS: 462_000,
	failureRate: 0.031,
	byKind: { account: 172, guest: 61, anonymous: 85 },
	days: Array.from({ length: 30 }, (_, index) => ({
		day: dayOf(index),
		account: index < 16 ? 0 : 12 + (index % 7) * 3,
		guest: index < 16 ? 0 : 4 + (index % 5),
		anonymous: index < 16 ? 0 : 6 + (index % 4) * 2,
		viewers: index < 16 ? 0 : 18 + (index % 6),
		watchedS: index < 16 ? 0 : 40_000 + index * 800,
	})),
	topTitles: [
		{ media: "movie", tmdbId: 550, title: { en: "Fight Club", ne: "फाइट क्लब" }, plays: 86, watchedS: 240_000 },
		{ media: "tv", tmdbId: 1396, title: { en: "Breaking Bad", ne: "ब्रेकिङ ब्याड" }, plays: 64, watchedS: 190_000 },
		{ media: "movie", tmdbId: 27205, title: null, plays: 12, watchedS: 8_400 },
	],
	topSearches: [
		{ query: "breaking bad", count: 41 },
		{ query: "nepali movies", count: 23 },
		{ query: "fight club", count: 9 },
	],
	zeroSearches: [{ query: "kathmandu nights", count: 4 }],
	servers: [
		{
			id: "00000000-0000-4000-8000-000000000001",
			name: { en: "Server 1", ne: "सर्भर 1" },
			plays: 180,
			failed: 3,
			failureRate: 3 / 180,
		},
		{
			id: "00000000-0000-4000-8000-000000000002",
			name: { en: "Server 2", ne: "सर्भर 2" },
			plays: 96,
			failed: 6,
			failureRate: 6 / 96,
		},
		{
			id: "00000000-0000-4000-8000-000000000003",
			name: { en: "Server 3", ne: "सर्भर 3" },
			plays: 42,
			failed: 1,
			failureRate: 1 / 42,
		},
	],
};

export const getPardaOverview = fn(async (): Promise<AdminOverview> => PARDA_STORY_OVERVIEW).mockName(
	"getPardaOverview",
);
