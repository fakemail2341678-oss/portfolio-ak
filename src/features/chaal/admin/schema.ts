import { z } from "zod";
import type { Localized } from "@/lib/i18n/localized";
import type { Paged } from "@/lib/list/paging";
import { email, localizedText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { ENGINE_BOUNDS, type EngineLimits } from "../engine/limits";
import { CHAAL_FEATURES, type ChaalFeature, LICHESS_SCOPES } from "../features";
import { CHAAL_BOARD_THEMES } from "../look/board-themes";
import { AI_LEVELS, type PlayLimits, QUICK_PAIR_MODES } from "../play/controls";
import { PUZZLE_AHEAD_BOUNDS, type PuzzleLimits } from "../puzzles/limits";
import { CHAAL_PIECE_SETS, type ChaalDefaults } from "../settings/preferences";
import { TV_CHANNELS, type WatchLimits } from "../watch/limits";

/**
 * Chaal's admin (PLAN Task 79, decision 0268): the shapes its functions return and the
 * inputs they take. Route files import the URL contract from ./search.ts, never this file.
 */

/** A row's version as the form sends it back. */
const version = () => z.string().regex(/^[1-9][0-9]*$/);

// ---- Settings -----------------------------------------------------------------------------------

export type ChaalAdminSettings = {
	/** Every feature's switch, on or off. */
	features: Record<ChaalFeature, boolean>;
	guestsMayConnect: boolean;
	extraScopes: string[];
	play: PlayLimits;
	puzzles: PuzzleLimits;
	watch: WatchLimits;
	defaults: ChaalDefaults;
	engine: EngineLimits;
	banner: Localized;
	maintenance: boolean;
	maintenanceMessage: Localized;
	cacheEpoch: number;
	/** Whether CHAAL_TOKEN_KEY is set: without it nobody can connect, whatever the switches say. */
	connectConfigured: boolean;
	updatedAt: string;
};

const between = ({ min, max }: { min: number; max: number }) => z.number().int().min(min).max(max);

/** The settings form: everything but maintenance, the purge and the epoch, which are their own writes. */
export const chaalSettingsInput = z.strictObject({
	features: z.strictObject(
		Object.fromEntries(CHAAL_FEATURES.map((feature) => [feature, z.boolean()])) as Record<ChaalFeature, z.ZodBoolean>,
	),
	guestsMayConnect: z.boolean(),
	extraScopes: z.array(z.enum(LICHESS_SCOPES)).max(LICHESS_SCOPES.length),
	play: z.strictObject({
		aiMaxLevel: z
			.number()
			.int()
			.min(AI_LEVELS[0])
			.max(AI_LEVELS[AI_LEVELS.length - 1] ?? 8),
		rated: z.boolean(),
		quickPair: z.enum(QUICK_PAIR_MODES),
	}),
	puzzles: z.strictObject({ ahead: between(PUZZLE_AHEAD_BOUNDS), streak: z.boolean() }),
	/** Watch (Task 82): at least one TV channel, and whether the streamers live are listed. */
	watch: z.strictObject({
		channels: z
			.array(z.enum(TV_CHANNELS))
			.min(1, { error: () => m.ch_admin_settings_watch_channels_min() })
			.max(TV_CHANNELS.length),
		streamers: z.boolean(),
	}),
	defaults: z.strictObject({
		board: z.enum(CHAAL_BOARD_THEMES),
		pieces: z.enum(CHAAL_PIECE_SETS),
		sounds: z.boolean(),
	}),
	engine: z.strictObject({
		maxDepth: between(ENGINE_BOUNDS.maxDepth),
		multiPv: between(ENGINE_BOUNDS.multiPv),
		hashMb: between(ENGINE_BOUNDS.hashMb),
	}),
	/** A notice under Chaal's top bar on every page; empty English hides it. */
	banner: localizedText({ max: 200, optional: true }),
	/** What pages say during maintenance; empty English: the default sentence. */
	maintenanceMessage: localizedText({ max: 200, optional: true }),
	updatedAt: version(),
});
export type ChaalSettingsInput = z.output<typeof chaalSettingsInput>;
export type ChaalSettingsFormValues = z.input<typeof chaalSettingsInput>;

export const chaalMaintenanceInput = z.strictObject({ on: z.boolean() });

// ---- Connections --------------------------------------------------------------------------------

export const CONNECTION_STATES = ["active", "revoked", "expired"] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

/** A connected Lichess account in the admin's list: never the token. `id` is the site user's id. */
export type ChaalAdminConnection = {
	id: string;
	/** The site user: their name and email, or a guest's session (no email). */
	userName: string;
	userEmail: string | null;
	guest: boolean;
	lichessId: string;
	username: string;
	title: string | null;
	scopes: string[];
	connectedAt: string;
	lastUsedAt: string | null;
	expiresAt: string | null;
	state: ConnectionState;
	/** Lichess asked this connection to wait until then (a 429). */
	cooldownUntil: string | null;
	/** The site user or the Lichess account is blocked. */
	blocked: boolean;
};
export type ChaalAdminConnectionPage = Paged<ChaalAdminConnection>;

/** Site users' ids: a connection is keyed by its user (Better Auth's ids aren't uuids). */
export const connectionIdsInput = z.strictObject({
	ids: z.array(z.string().min(1).max(64)).min(1).max(100),
});

// ---- Blocks -------------------------------------------------------------------------------------

export const BLOCK_KINDS = ["lichess", "user"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export type ChaalAdminBlock = {
	id: string;
	kind: BlockKind;
	/** The Lichess username, or the site user's name. */
	target: string;
	/** The site user's email (a guest has none). */
	email: string | null;
	reason: string;
	blockedBy: string | null;
	createdAt: string;
};
export type ChaalAdminBlockPage = Paged<ChaalAdminBlock>;

/** Lichess usernames: 2–30 letters, digits, `_` and `-`. */
export const LICHESS_USERNAME = /^[A-Za-z0-9][\w-]{0,28}[A-Za-z0-9]$/;

/** Block a Lichess account by its username, or a site user by their email. */
export const chaalBlockInput = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("lichess"),
		target: z
			.string()
			.trim()
			.regex(LICHESS_USERNAME, { error: () => m.ch_admin_block_username_invalid() }),
		reason: required({ max: 500 }),
	}),
	z.strictObject({
		kind: z.literal("user"),
		target: email(),
		reason: required({ max: 500 }),
	}),
]);
export type ChaalBlockInput = z.output<typeof chaalBlockInput>;
export type ChaalBlockFormValues = { kind: BlockKind; target: string; reason: string };

// ---- Health -------------------------------------------------------------------------------------

export type ChaalHealthHour = { hour: string; calls: number; errors: number; rateLimited: number };

export type ChaalHealthEndpoint = {
	endpoint: string;
	calls: number;
	errors: number;
	rateLimited: number;
	avgMs: number;
};

export type ChaalHealthError = { id: string; at: string; endpoint: string; status: number; ms: number; lane: string };

export type ChaalHealth = {
	/** Every hour of the range, oldest first, with zeros where nothing was called. */
	hours: ChaalHealthHour[];
	endpoints: ChaalHealthEndpoint[];
	totals: { calls: number; errors: number; rateLimited: number; avgMs: number };
	cooldowns: {
		/** The public lane's, when one runs now. */
		public: string | null;
		/** Connections Lichess asked to wait, the latest first. */
		connections: Array<{ username: string; until: string }>;
	};
	errors: ChaalHealthError[];
};

/** "Test Lichess": one call through the public lane, past the cache. */
export type ChaalPing = { ok: true; status: number; ms: number } | { ok: false; reason: "wait" | "down"; ms: number };
