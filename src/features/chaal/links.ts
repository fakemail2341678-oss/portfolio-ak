import { linkOptions } from "@tanstack/react-router";
import type {
	BroadcastPageSearch,
	BroadcastsSearch,
	PlayerSearch,
	PlayersSearch,
	PlaySearch,
	PuzzlesSearch,
} from "./search";
import type { TvChannel } from "./watch/limits";

/**
 * Where Chaal lives (PLAN 13.2): its base path is here and nowhere else, so a rename is
 * one edit (with a move of src/routes/_chaal/app/chaal). Task 71 has the connect routes and
 * the admin's lab; its pages start with Task 73.
 */
export const CHAAL_BASE = "/app/chaal";

/**
 * Every link into Chaal: pages link through these. A link arrives with its route
 * (PLAN 13.3), never before.
 */
export const chaalLinks = {
	home: () => linkOptions({ to: "/app/chaal" }),
	/** The analysis board (Task 75): empty, at a position, or a saved analysis. */
	analysis: (search: { fen?: string; moves?: string; id?: string } = {}) =>
		linkOptions({ to: "/app/chaal/analysis", search }),
	/**
	 * The play hub (Task 76): against the computer, over the board, and the games played here;
	 * online play (Task 77), with a setup filled in ("Play again" with a player).
	 */
	play: (search: PlaySearch = {}) => linkOptions({ to: "/app/chaal/play", search }),
	/** Puzzles (Task 80): the daily puzzle, or training, the streak or replaying misses. */
	puzzles: (search: PuzzlesSearch = {}) => linkOptions({ to: "/app/chaal/puzzles", search }),
	/** One puzzle by its Lichess id (Task 80, noindex). */
	puzzle: (id: string) => linkOptions({ to: "/app/chaal/puzzles/$id", params: { id } }),
	/** Leaderboards by rating (Task 81). */
	players: (search: PlayersSearch = {}) => linkOptions({ to: "/app/chaal/players", search }),
	/** A Lichess player (Task 81, noindex): the overview, or their games with filters. */
	player: (username: string, search: PlayerSearch = {}) =>
		linkOptions({ to: "/app/chaal/players/$username", params: { username }, search }),
	/** Watch (Task 82): the TV's channels, live. */
	watch: () => linkOptions({ to: "/app/chaal/watch" }),
	/** One TV channel's game on the big board (Task 82, noindex). */
	channel: (channel: TvChannel) => linkOptions({ to: "/app/chaal/watch/$channel", params: { channel } }),
	/** Lichess's broadcasts (Task 82): live, coming up and past; the official ones; a search. */
	broadcasts: (search: BroadcastsSearch = {}) => linkOptions({ to: "/app/chaal/broadcasts", search }),
	/** A broadcast (Task 82, noindex): a round's boards, or one board followed. */
	broadcast: (id: string, search: BroadcastPageSearch = {}) =>
		linkOptions({ to: "/app/chaal/broadcasts/$id", params: { id }, search }),
	/**
	 * A game on Lichess (noindex): the player's own while it's played (Task 77), anyone else's
	 * followed live (Task 82), else its replay (Task 81).
	 */
	game: (id: string) => linkOptions({ to: "/app/chaal/game/$id", params: { id } }),
	/** A local game (Task 76, noindex): its board, to play on or look back at. */
	local: (id: string) => linkOptions({ to: "/app/chaal/local/$id", params: { id } }),
	/** Preferences, the Lichess connection, this browser's data (noindex). `hash` opens a section. */
	settings: (hash?: "connection" | "board" | "device") =>
		linkOptions({ to: "/app/chaal/settings", ...(hash ? { hash } : {}) }),
	about: (hash?: string) => linkOptions({ to: "/app/chaal/about", ...(hash ? { hash } : {}) }),
	signIn: (redirect?: string) => linkOptions({ to: "/app/chaal/sign-in", search: { redirect } }),
	signUp: (redirect?: string) => linkOptions({ to: "/app/chaal/sign-up", search: { redirect } }),
};

/** De-localized paths for redirects, `?redirect=` targets, heads and the sitemap. */
export const CHAAL_PATHS = {
	home: CHAAL_BASE,
	play: `${CHAAL_BASE}/play`,
	analysis: `${CHAAL_BASE}/analysis`,
	puzzles: `${CHAAL_BASE}/puzzles`,
	players: `${CHAAL_BASE}/players`,
	watch: `${CHAAL_BASE}/watch`,
	broadcasts: `${CHAAL_BASE}/broadcasts`,
	about: `${CHAAL_BASE}/about`,
	settings: `${CHAAL_BASE}/settings`,
} as const;

/** Chaal's indexable pages (PLAN 13.5, "SEO"): each joins with its route. */
export const CHAAL_SITEMAP: ReadonlyArray<string> = [
	CHAAL_PATHS.home,
	CHAAL_PATHS.play,
	CHAAL_PATHS.analysis,
	CHAAL_PATHS.puzzles,
	CHAAL_PATHS.players,
	CHAAL_PATHS.watch,
	CHAAL_PATHS.broadcasts,
	CHAAL_PATHS.about,
];

/** The admin's Chaal: connecting from the lab returns there. */
const CHAAL_ADMIN = "/admin/chaal";

/** The Nitro routes that connect Lichess (src/server/routes/chaal-oauth.ts, decision 0256). */
export const CHAAL_OAUTH_START = "/api/chaal/oauth/start";
export const CHAAL_OAUTH_CALLBACK = "/api/chaal/oauth/callback";

/** The event stream, through our server (src/server/routes/chaal-stream.ts). */
export const CHAAL_EVENT_STREAM = "/api/chaal/stream/events";

/** What a connect result adds to the return path (`?lichess=connected`, `?lichess=taken`, ...). */
export const CONNECT_RESULT_PARAM = "lichess";

export const CONNECT_RESULTS = [
	"connected",
	"denied",
	"taken",
	"blocked",
	"off",
	"expired",
	"failed",
	"no-session",
] as const;
export type ConnectResult = (typeof CONNECT_RESULTS)[number];

/**
 * A path connecting may return to: one of Chaal's own pages, or the admin's lab, optionally
 * localized (`/ne/...`), with a query but never another origin (no open redirect: no `//`,
 * no backslash, no scheme). Anything else falls back to Chaal's home.
 */
export function safeReturnPath(value: string | null | undefined): string {
	if (!value || value.length > 512) return CHAAL_BASE;
	if (
		!value.startsWith("/") ||
		value.startsWith("//") ||
		/[\\\s]/.test(value) ||
		value.includes("://") ||
		value.includes("..")
	) {
		return CHAAL_BASE;
	}
	const path = value.split(/[?#]/)[0] ?? "";
	const unlocalized = path.replace(/^\/ne(?=\/|$)/, "") || "/";
	const allowed = [CHAAL_BASE, CHAAL_ADMIN].some((base) => unlocalized === base || unlocalized.startsWith(`${base}/`));
	return allowed ? value : CHAAL_BASE;
}

/** The address that starts connecting Lichess and comes back to `returnTo`. */
export const connectHref = (returnTo: string) => `${CHAAL_OAUTH_START}?return=${encodeURIComponent(returnTo)}`;
