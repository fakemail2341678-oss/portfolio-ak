import { fn } from "storybook/test";
import type { KharchaBalances, KharchaHome, KharchaMe, KharchaPulse } from "../../../../src/features/kharcha/types";
import { sampleKharchaBalances, sampleKharchaHome, sampleKharchaMe } from "../../kharcha";

// Stand-ins for src/functions/kharcha/me.ts.
export const getKharchaMe = fn(async (): Promise<KharchaMe> => sampleKharchaMe).mockName("getKharchaMe");
export const getKharchaRev = fn(
	async (): Promise<KharchaPulse> => ({ rev: sampleKharchaMe.rev, unread: sampleKharchaHome.unread }),
).mockName("getKharchaRev");
export const getKharchaBalances = fn(async (): Promise<KharchaBalances> => sampleKharchaBalances).mockName(
	"getKharchaBalances",
);
export const getKharchaHome = fn(async (): Promise<KharchaHome> => sampleKharchaHome).mockName("getKharchaHome");
export const completeKharchaOnboarding = fn(async (): Promise<void> => undefined).mockName("completeKharchaOnboarding");
export const updateKharchaProfile = fn(async (): Promise<KharchaMe> => sampleKharchaMe).mockName(
	"updateKharchaProfile",
);
