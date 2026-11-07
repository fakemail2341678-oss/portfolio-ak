// No imports on purpose: the Drizzle schema (loaded by drizzle-kit, which knows
// neither path aliases nor Paraglide) shares these values with the app.

export const DISCIPLINES = ["product", "frontend", "backend", "platform", "ai"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

/** How a number is shown: `formatMetric` (lib/format-metric.ts) turns these into localized text. */
export const METRIC_FORMATS = ["number", "compact", "percent", "multiplier", "plus", "ms", "seconds"] as const;
export type MetricFormat = (typeof METRIC_FORMATS)[number];

/** Generative cover art (components/primitives/cover-art.tsx): a motif and a glyph, seeded by the art seed. */
export const COVER_MOTIFS = ["grid", "orbit", "waves", "blocks", "type", "terrain", "signal"] as const;
export type CoverMotif = (typeof COVER_MOTIFS)[number];

export const ARCHITECTURE_TIERS = ["client", "edge", "service", "data"] as const;
export type ArchitectureTier = (typeof ARCHITECTURE_TIERS)[number];

export const CODE_LANGUAGES = ["ts", "tsx", "sql", "bash", "css"] as const;

export const AVAILABILITY_STATUSES = ["open", "limited", "closed"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

/** Projects and journal posts: drafts are seen only in the admin and in previews. */
export const PORTFOLIO_STATUSES = ["draft", "published"] as const;
export type PortfolioStatus = (typeof PORTFOLIO_STATUSES)[number];

/** The profile is one row with this id. */
export const PROFILE_ID = "profile";

/** preferences table ids (useTablePreferences) of the admin lists. */
export const PROJECTS_TABLE_ID = "portfolio-projects";
export const POSTS_TABLE_ID = "portfolio-posts";
export const MESSAGES_TABLE_ID = "portfolio-messages";

/** The messages inbox's views: everything not archived, only unread, the archive, or all. */
export const MESSAGE_STATES_FILTER = ["inbox", "unread", "archived", "all"] as const;
export type MessageStateFilter = (typeof MESSAGE_STATES_FILTER)[number];
