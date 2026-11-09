import { fn } from "storybook/test";
import type { ChaalAdminBlock, ChaalAdminBlockPage } from "../../../../src/features/chaal/admin/schema";

// Stand-ins for src/functions/chaal-admin/blocks.ts.
const block: ChaalAdminBlock = {
	id: "00000000-0000-4000-8000-000000000201",
	kind: "lichess",
	target: "pawnstorm",
	email: null,
	reason: "Abusive chat in two games, 5 November",
	blockedBy: "Admin",
	createdAt: "2026-11-05T16:00:00.000Z",
};

export const listChaalBlocks = fn(
	async (): Promise<ChaalAdminBlockPage> => ({ items: [block], total: 1, page: 1, pageCount: 1 }),
).mockName("listChaalBlocks");
export const blockChaal = fn(async (): Promise<ChaalAdminBlock> => block).mockName("blockChaal");
export const unblockChaal = fn(async (): Promise<{ deleted: number }> => ({ deleted: 1 })).mockName("unblockChaal");
