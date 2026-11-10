import { defineStatuses } from "@/components/data-display/status-badge";
import { m } from "@/paraglide/messages";
import type { ChaalFeature } from "../features";
import type { ChaalFeaturedKind, ChaalHomeSectionKey, FeaturedState } from "../home/curation";
import type { QuickPairMode } from "../play/controls";
import type { CHAAL_PIECE_SETS } from "../settings/preferences";
import type { BlockKind, ChaalGameMode, ConnectionState } from "./schema";
import type {
	BlockKindFilter,
	ChaalCurationTab,
	ChaalHealthRange,
	ChaalOverviewRange,
	ConnectionStateFilter,
	ConnectionWhoFilter,
} from "./search";

/** The admin's words for Chaal's values (Task 79). */

/** Each feature switch's name on the settings page. */
export const FEATURE_TITLES: Readonly<Record<ChaalFeature, () => string>> = {
	play: m.ch_admin_feature_play,
	chat: m.ch_admin_feature_chat,
	local: m.ch_admin_feature_local,
	puzzles: m.ch_admin_feature_puzzles,
	analysis: m.ch_admin_feature_analysis,
	engine: m.ch_admin_feature_engine,
	explorer: m.ch_admin_feature_explorer,
	watch: m.ch_admin_feature_watch,
	players: m.ch_admin_feature_players,
	social: m.ch_admin_feature_social,
	tournaments: m.ch_admin_feature_tournaments,
	teams: m.ch_admin_feature_teams,
	studies: m.ch_admin_feature_studies,
	preferences: m.ch_admin_feature_preferences,
};

/** What each feature switch turns on or off, under its name on the settings page. */
export const FEATURE_HINTS: Readonly<Record<ChaalFeature, () => string>> = {
	play: m.ch_admin_feature_play_hint,
	chat: m.ch_admin_feature_chat_hint,
	local: m.ch_admin_feature_local_hint,
	puzzles: m.ch_admin_feature_puzzles_hint,
	analysis: m.ch_admin_feature_analysis_hint,
	engine: m.ch_admin_feature_engine_hint,
	explorer: m.ch_admin_feature_explorer_hint,
	watch: m.ch_admin_feature_watch_hint,
	players: m.ch_admin_feature_players_hint,
	social: m.ch_admin_feature_social_hint,
	tournaments: m.ch_admin_feature_tournaments_hint,
	teams: m.ch_admin_feature_teams_hint,
	studies: m.ch_admin_feature_studies_hint,
	preferences: m.ch_admin_feature_preferences_hint,
};

export const PIECE_SET_NAMES: Readonly<Record<(typeof CHAAL_PIECE_SETS)[number], () => string>> = {
	cburnett: m.ch_admin_pieces_cburnett,
};

export const QUICK_PAIR_LABELS: Readonly<Record<QuickPairMode, () => string>> = {
	all: m.ch_admin_quick_pair_all,
	clock: m.ch_admin_quick_pair_clock,
	days: m.ch_admin_quick_pair_days,
	off: m.ch_admin_quick_pair_off,
};

export const CONNECTION_STATE = defineStatuses<ConnectionState>({
	active: { tone: "success", label: m.ch_admin_connection_active },
	revoked: { tone: "danger", label: m.ch_admin_connection_revoked },
	expired: { tone: "neutral", label: m.ch_admin_connection_expired },
});

export const CONNECTION_STATE_FILTER_LABELS: Readonly<Record<ConnectionStateFilter, () => string>> = {
	all: m.ch_admin_filter_all,
	active: m.ch_admin_connection_active,
	revoked: m.ch_admin_connection_revoked,
	expired: m.ch_admin_connection_expired,
};

export const CONNECTION_WHO_LABELS: Readonly<Record<ConnectionWhoFilter, () => string>> = {
	all: m.ch_admin_filter_all,
	members: m.ch_admin_who_members,
	guests: m.ch_admin_who_guests,
};

export const BLOCK_KIND_LABELS: Readonly<Record<BlockKind, () => string>> = {
	lichess: m.ch_admin_block_kind_lichess,
	user: m.ch_admin_block_kind_user,
};

export const BLOCK_KIND_FILTER_LABELS: Readonly<Record<BlockKindFilter, () => string>> = {
	all: m.ch_admin_filter_all,
	...BLOCK_KIND_LABELS,
};

export const HEALTH_RANGE_LABELS: Readonly<Record<ChaalHealthRange, () => string>> = {
	"24h": m.ch_admin_health_range_24h,
	"7d": m.ch_admin_health_range_7d,
};

// ---- Overview and curation (Task 84) ----------------------------------------------------------

export const OVERVIEW_RANGE_LABELS: Readonly<Record<ChaalOverviewRange, () => string>> = {
	today: m.ch_admin_range_today,
	"7d": m.ch_admin_range_week,
	"30d": m.ch_admin_range_month,
};

export const GAME_MODE_LABELS: Readonly<Record<ChaalGameMode, () => string>> = {
	ai: m.ch_admin_mode_ai,
	challenge: m.ch_admin_mode_challenge,
	seek: m.ch_admin_mode_seek,
	lichess: m.ch_admin_mode_lichess,
	"local-engine": m.ch_admin_mode_local_engine,
	"local-board": m.ch_admin_mode_local_board,
};

export const FEATURED_KIND_LABELS: Readonly<Record<ChaalFeaturedKind, () => string>> = {
	broadcast: m.ch_admin_featured_kind_broadcast,
	arena: m.ch_admin_featured_kind_arena,
	swiss: m.ch_admin_featured_kind_swiss,
	study: m.ch_admin_featured_kind_study,
	theme: m.ch_admin_featured_kind_theme,
};

/** The home's sections, as the admin and the home name them. */
export const HOME_SECTION_LABELS: Readonly<Record<ChaalHomeSectionKey, () => string>> = {
	announcement: m.ch_home_section_announcement,
	start: m.ch_home_start,
	broadcasts: m.ch_home_section_broadcasts,
	tournaments: m.ch_home_section_tournaments,
	studies: m.ch_home_section_studies,
	themes: m.ch_home_section_themes,
};

export const CURATION_TAB_LABELS: Readonly<Record<ChaalCurationTab, () => string>> = {
	broadcasts: m.ch_home_section_broadcasts,
	tournaments: m.ch_home_section_tournaments,
	studies: m.ch_home_section_studies,
	themes: m.ch_home_section_themes,
	home: m.ch_admin_curation_tab_home,
};

export const FEATURED_STATES = defineStatuses<FeaturedState>({
	live: { tone: "success", label: m.ch_admin_featured_live },
	scheduled: { tone: "info", label: m.ch_admin_featured_scheduled },
	ended: { tone: "neutral", label: m.ch_admin_featured_ended },
});
