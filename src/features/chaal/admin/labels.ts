import { defineStatuses } from "@/components/data-display/status-badge";
import { m } from "@/paraglide/messages";
import type { ChaalFeaturedKind, ChaalHomeSectionKey, FeaturedState } from "../home/lib/curation";
import type { ChaalFeature } from "../lib/features";
import type { QuickPairMode } from "../play/lib/controls";
import type { CHAAL_PIECE_SETS } from "../settings/lib/preferences";
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
	play: m.chaal_admin_feature_play,
	chat: m.chaal_admin_feature_chat,
	local: m.chaal_admin_feature_local,
	puzzles: m.chaal_admin_feature_puzzles,
	analysis: m.chaal_admin_feature_analysis,
	engine: m.chaal_admin_feature_engine,
	explorer: m.chaal_admin_feature_explorer,
	watch: m.chaal_admin_feature_watch,
	players: m.chaal_admin_feature_players,
	social: m.chaal_admin_feature_social,
	tournaments: m.chaal_admin_feature_tournaments,
	teams: m.chaal_admin_feature_teams,
	studies: m.chaal_admin_feature_studies,
	preferences: m.chaal_admin_feature_preferences,
};

/** What each feature switch turns on or off, under its name on the settings page. */
export const FEATURE_HINTS: Readonly<Record<ChaalFeature, () => string>> = {
	play: m.chaal_admin_feature_play_hint,
	chat: m.chaal_admin_feature_chat_hint,
	local: m.chaal_admin_feature_local_hint,
	puzzles: m.chaal_admin_feature_puzzles_hint,
	analysis: m.chaal_admin_feature_analysis_hint,
	engine: m.chaal_admin_feature_engine_hint,
	explorer: m.chaal_admin_feature_explorer_hint,
	watch: m.chaal_admin_feature_watch_hint,
	players: m.chaal_admin_feature_players_hint,
	social: m.chaal_admin_feature_social_hint,
	tournaments: m.chaal_admin_feature_tournaments_hint,
	teams: m.chaal_admin_feature_teams_hint,
	studies: m.chaal_admin_feature_studies_hint,
	preferences: m.chaal_admin_feature_preferences_hint,
};

export const PIECE_SET_NAMES: Readonly<Record<(typeof CHAAL_PIECE_SETS)[number], () => string>> = {
	cburnett: m.chaal_admin_pieces_cburnett,
};

export const QUICK_PAIR_LABELS: Readonly<Record<QuickPairMode, () => string>> = {
	all: m.chaal_admin_quick_pair_all,
	clock: m.chaal_admin_quick_pair_clock,
	days: m.chaal_admin_quick_pair_days,
	off: m.chaal_admin_quick_pair_off,
};

export const CONNECTION_STATE = defineStatuses<ConnectionState>({
	active: { tone: "success", label: m.chaal_admin_connection_active },
	revoked: { tone: "danger", label: m.chaal_admin_connection_revoked },
	expired: { tone: "neutral", label: m.chaal_admin_connection_expired },
});

export const CONNECTION_STATE_FILTER_LABELS: Readonly<Record<ConnectionStateFilter, () => string>> = {
	all: m.chaal_admin_filter_all,
	active: m.chaal_admin_connection_active,
	revoked: m.chaal_admin_connection_revoked,
	expired: m.chaal_admin_connection_expired,
};

export const CONNECTION_WHO_LABELS: Readonly<Record<ConnectionWhoFilter, () => string>> = {
	all: m.chaal_admin_filter_all,
	members: m.chaal_admin_who_members,
	guests: m.chaal_admin_who_guests,
};

export const BLOCK_KIND_LABELS: Readonly<Record<BlockKind, () => string>> = {
	lichess: m.chaal_admin_block_kind_lichess,
	user: m.chaal_admin_block_kind_user,
};

export const BLOCK_KIND_FILTER_LABELS: Readonly<Record<BlockKindFilter, () => string>> = {
	all: m.chaal_admin_filter_all,
	...BLOCK_KIND_LABELS,
};

export const HEALTH_RANGE_LABELS: Readonly<Record<ChaalHealthRange, () => string>> = {
	"24h": m.chaal_admin_health_range_24h,
	"7d": m.chaal_admin_health_range_7d,
};

// ---- Overview and curation (Task 84) ----------------------------------------------------------

export const OVERVIEW_RANGE_LABELS: Readonly<Record<ChaalOverviewRange, () => string>> = {
	today: m.chaal_admin_range_today,
	"7d": m.chaal_admin_range_week,
	"30d": m.chaal_admin_range_month,
};

export const GAME_MODE_LABELS: Readonly<Record<ChaalGameMode, () => string>> = {
	ai: m.chaal_admin_mode_ai,
	challenge: m.chaal_admin_mode_challenge,
	seek: m.chaal_admin_mode_seek,
	lichess: m.chaal_admin_mode_lichess,
	"local-engine": m.chaal_admin_mode_local_engine,
	"local-board": m.chaal_admin_mode_local_board,
};

export const FEATURED_KIND_LABELS: Readonly<Record<ChaalFeaturedKind, () => string>> = {
	broadcast: m.chaal_admin_featured_kind_broadcast,
	arena: m.chaal_admin_featured_kind_arena,
	swiss: m.chaal_admin_featured_kind_swiss,
	study: m.chaal_admin_featured_kind_study,
	theme: m.chaal_admin_featured_kind_theme,
};

/** The home's sections, as the admin and the home name them. */
export const HOME_SECTION_LABELS: Readonly<Record<ChaalHomeSectionKey, () => string>> = {
	announcement: m.chaal_home_section_announcement,
	start: m.chaal_home_start,
	broadcasts: m.chaal_home_section_broadcasts,
	tournaments: m.chaal_home_section_tournaments,
	studies: m.chaal_home_section_studies,
	themes: m.chaal_home_section_themes,
};

export const CURATION_TAB_LABELS: Readonly<Record<ChaalCurationTab, () => string>> = {
	broadcasts: m.chaal_home_section_broadcasts,
	tournaments: m.chaal_home_section_tournaments,
	studies: m.chaal_home_section_studies,
	themes: m.chaal_home_section_themes,
	home: m.chaal_admin_curation_tab_home,
};

export const FEATURED_STATES = defineStatuses<FeaturedState>({
	live: { tone: "success", label: m.chaal_admin_featured_live },
	scheduled: { tone: "info", label: m.chaal_admin_featured_scheduled },
	ended: { tone: "neutral", label: m.chaal_admin_featured_ended },
});
