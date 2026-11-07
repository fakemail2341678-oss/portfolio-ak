import { fn } from "storybook/test";
import type { AdminTakedown, AdminTakedownPage } from "../../../../src/features/parda/admin/schema";

// Stand-ins for src/functions/parda-admin/titles.ts.
const takedown: AdminTakedown = {
	id: "00000000-0000-4000-8000-000000000101",
	media: "movie",
	tmdbId: 550,
	title: { en: "Fight Club", ne: "फाइट क्लब" },
	reason: "Rights holder's request, 4 November",
	blockedBy: "Admin",
	createdAt: "2026-11-04T10:00:00.000Z",
};

export const listPardaTakedowns = fn(
	async (): Promise<AdminTakedownPage> => ({ items: [takedown], total: 1, page: 1, pageCount: 1 }),
).mockName("listPardaTakedowns");
export const blockPardaTitle = fn(async (): Promise<AdminTakedown> => takedown).mockName("blockPardaTitle");
export const unblockPardaTitles = fn(async (): Promise<{ deleted: number }> => ({ deleted: 1 })).mockName(
	"unblockPardaTitles",
);
