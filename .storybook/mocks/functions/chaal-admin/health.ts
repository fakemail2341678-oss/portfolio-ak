import { fn } from "storybook/test";
import type { ChaalHealth, ChaalPing } from "../../../../src/features/chaal/admin/schema";

// Stand-ins for src/functions/chaal-admin/health.ts: a day of calls, a little trouble at noon.
const HOUR = 3_600_000;
const start = Date.UTC(2026, 10, 8, 8);

export const chaalHealth: ChaalHealth = {
	hours: Array.from({ length: 24 }, (_, index) => {
		const calls = 40 + Math.round(30 * Math.sin(index / 3) ** 2);
		const errors = index === 4 ? 9 : index % 7 === 0 ? 1 : 0;
		return {
			hour: new Date(start + index * HOUR).toISOString(),
			calls,
			errors,
			rateLimited: index === 4 ? 6 : 0,
		};
	}),
	endpoints: [
		{ endpoint: "puzzle-daily", calls: 412, errors: 0, rateLimited: 0, avgMs: 180 },
		{ endpoint: "explorer-masters", calls: 268, errors: 7, rateLimited: 6, avgMs: 340 },
		{ endpoint: "account", calls: 96, errors: 1, rateLimited: 0, avgMs: 150 },
		{ endpoint: "stream:event", calls: 88, errors: 3, rateLimited: 0, avgMs: 220 },
	],
	totals: { calls: 864, errors: 11, rateLimited: 6, avgMs: 236 },
	cooldowns: { public: null, connections: [{ username: "Sita_K", until: "2026-11-09T08:12:00.000Z" }] },
	errors: [
		{
			id: "e1",
			at: "2026-11-08T12:41:00.000Z",
			endpoint: "explorer-masters",
			status: 429,
			ms: 120,
			lane: "public",
		},
		{ id: "e2", at: "2026-11-08T12:40:00.000Z", endpoint: "stream:event", status: 0, ms: 8000, lane: "user" },
	],
};

export const getChaalHealth = fn(async (): Promise<ChaalHealth> => chaalHealth).mockName("getChaalHealth");
export const pingChaalLichess = fn(async (): Promise<ChaalPing> => ({ ok: true, status: 200, ms: 186 })).mockName(
	"pingChaalLichess",
);
