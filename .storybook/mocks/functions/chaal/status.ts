import { fn } from "storybook/test";
import { CHAAL_FEATURES, type ChaalFeature } from "../../../../src/features/chaal/features";
import type { ChaalStatus } from "../../../../src/features/chaal/schema";

// Stand-ins for src/functions/chaal/status.ts.
export const getChaalStatus = fn(
	async (): Promise<ChaalStatus> => ({
		features: Object.fromEntries(CHAAL_FEATURES.map((feature) => [feature, true])) as Record<ChaalFeature, boolean>,
		connect: "on",
		explorerForVisitors: true,
		banner: null,
	}),
).mockName("getChaalStatus");
