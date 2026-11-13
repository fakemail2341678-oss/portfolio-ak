import { fn } from "storybook/test";
import type { RemindResult, SettleUp } from "../../../../src/features/kharcha/types";
import { sampleKharchaSettleUp } from "../../kharcha";

// Stand-ins for src/functions/kharcha/settle.ts.
export const getKharchaSettleUp = fn(async (): Promise<SettleUp> => sampleKharchaSettleUp).mockName(
	"getKharchaSettleUp",
);
export const remindKharchaFriend = fn(
	async (): Promise<RemindResult> => ({ remindedAt: "2026-11-12T08:00:00.000Z" }),
).mockName("remindKharchaFriend");
