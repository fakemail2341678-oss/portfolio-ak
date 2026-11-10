import { fn } from "storybook/test";
import type { ChaalOverview } from "../../../../src/features/chaal/admin/schema";

// Stand-ins for src/functions/chaal-admin/overview.ts: a month of play, busier at weekends.
const DAY_MS = 86_400_000;
const last = Date.UTC(2026, 10, 8);

export const chaalOverview: ChaalOverview = {
	range: "7d",
	today: "2026-11-08",
	connected: 214,
	players: { week: 162, month: 388 },
	totals: { games: 941, puzzles: 1_820, puzzlesSolved: 1_377, analyses: 233, connects: 19 },
	modes: { ai: 212, challenge: 96, seek: 301, lichess: 88, "local-engine": 171, "local-board": 73 },
	days: Array.from({ length: 30 }, (_, index) => {
		const weekend = index % 7 === 5 || index % 7 === 6;
		return {
			day: new Date(last - (29 - index) * DAY_MS).toISOString().slice(0, 10),
			players: 38 + (index % 9) * 3 + (weekend ? 22 : 0),
			online: 70 + (index % 5) * 9 + (weekend ? 40 : 0),
			local: 28 + (index % 4) * 5,
			puzzles: 210 + (index % 6) * 17,
			analyses: 22 + (index % 3) * 6,
		};
	}),
	api: { calls: 864, errors: 11, rateLimited: 6, avgMs: 236, cooldown: null },
};

export const getChaalOverview = fn(async (): Promise<ChaalOverview> => chaalOverview).mockName("getChaalOverview");
