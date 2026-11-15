import { m } from "@/paraglide/messages";
import type { ChaalFeature } from "./lib/features";
import type { CHAAL_BOARD_THEMES } from "./look/lib/board-themes";

/** Names shared by the player's pages and the admin (Task 79): each feature, each board theme. */

export const FEATURE_NAMES: Readonly<Record<ChaalFeature, () => string>> = {
	play: m.chaal_feature_play,
	chat: m.chaal_feature_chat,
	local: m.chaal_feature_local,
	puzzles: m.chaal_feature_puzzles,
	analysis: m.chaal_feature_analysis,
	engine: m.chaal_feature_engine,
	explorer: m.chaal_feature_explorer,
	watch: m.chaal_feature_watch,
	players: m.chaal_feature_players,
	social: m.chaal_feature_social,
	tournaments: m.chaal_feature_tournaments,
	teams: m.chaal_feature_teams,
	studies: m.chaal_feature_studies,
	preferences: m.chaal_feature_preferences,
};

export const BOARD_NAMES: Readonly<Record<(typeof CHAAL_BOARD_THEMES)[number], () => string>> = {
	diagram: m.chaal_board_diagram,
	print: m.chaal_board_print,
	stone: m.chaal_board_stone,
};
