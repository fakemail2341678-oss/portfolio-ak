import { fn } from "storybook/test";
import { DEFAULT_COMMUNITY_LIMITS } from "../../../../src/features/chaal/community/limits";
import { DEFAULT_ENGINE_LIMITS } from "../../../../src/features/chaal/engine/limits";
import { CHAAL_FEATURES, type ChaalFeature } from "../../../../src/features/chaal/features";
import { DEFAULT_PLAY_LIMITS } from "../../../../src/features/chaal/play/controls";
import { DEFAULT_PUZZLE_LIMITS } from "../../../../src/features/chaal/puzzles/limits";
import type { ChaalStatus } from "../../../../src/features/chaal/schema";
import { DEFAULT_CHAAL_DEFAULTS } from "../../../../src/features/chaal/settings/preferences";
import { DEFAULT_WATCH_LIMITS } from "../../../../src/features/chaal/watch/limits";

// Stand-ins for src/functions/chaal/status.ts.
export const getChaalStatus = fn(
	async (): Promise<ChaalStatus> => ({
		features: Object.fromEntries(CHAAL_FEATURES.map((feature) => [feature, true])) as Record<ChaalFeature, boolean>,
		connect: "on",
		explorerForVisitors: true,
		banner: null,
		engine: DEFAULT_ENGINE_LIMITS,
		play: DEFAULT_PLAY_LIMITS,
		puzzles: DEFAULT_PUZZLE_LIMITS,
		watch: DEFAULT_WATCH_LIMITS,
		community: DEFAULT_COMMUNITY_LIMITS,
		// No live base: stories never read Lichess's streams.
		live: "",
		defaults: DEFAULT_CHAAL_DEFAULTS,
		maintenance: null,
	}),
).mockName("getChaalStatus");
