import { m } from "@/paraglide/messages";
import type { ChaalFeature } from "./features";
import type { CHAAL_BOARD_THEMES } from "./look/board-themes";

/** Names shared by the player's pages and the admin (Task 79): each feature, each board theme. */

export const FEATURE_NAMES: Readonly<Record<ChaalFeature, () => string>> = {
	play: m.ch_feature_play,
	chat: m.ch_feature_chat,
	local: m.ch_feature_local,
	puzzles: m.ch_feature_puzzles,
	analysis: m.ch_feature_analysis,
	engine: m.ch_feature_engine,
	explorer: m.ch_feature_explorer,
	watch: m.ch_feature_watch,
	players: m.ch_feature_players,
	social: m.ch_feature_social,
	tournaments: m.ch_feature_tournaments,
	teams: m.ch_feature_teams,
	studies: m.ch_feature_studies,
	preferences: m.ch_feature_preferences,
};

export const BOARD_NAMES: Readonly<Record<(typeof CHAAL_BOARD_THEMES)[number], () => string>> = {
	diagram: m.ch_board_diagram,
	print: m.ch_board_print,
	stone: m.ch_board_stone,
};
