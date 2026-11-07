import type { Localized } from "@/lib/i18n/localized";
import type { ChaalFeature } from "./features";

/** Shapes Chaal's server functions return (Task 71). */

/** What any Chaal page may know before it renders (getChaalStatus). */
export type ChaalStatus = {
	features: Record<ChaalFeature, boolean>;
	/** Whether this visitor could connect Lichess now: off without CHAAL_TOKEN_KEY, or for a guest when the admin says so. */
	connect: "on" | "off";
	/** The explorer answers visitors who haven't connected (LICHESS_APP_TOKEN is set). */
	explorerForVisitors: boolean;
	/** The admin's notice under the top bar (Task 73), or null. */
	banner: Localized | null;
};

/** A connected Lichess account as a page sees it: never the token (src/server/chaal/connect/service.ts). */
export type ChaalConnection = {
	lichessId: string;
	username: string;
	title: string | null;
	scopes: string[];
	connectedAt: string;
	lastUsedAt: string | null;
	expiresAt: string | null;
	/** Lichess refused the token, or it ran out: "Reconnect". */
	revoked: boolean;
	/** Enabled features it lacks a scope for: "Reconnect to allow …". */
	needsScopesFor: ChaalFeature[];
};

export type ChaalCallCounts = {
	endpoint: string;
	calls: number;
	errors: number;
	rateLimited: number;
	avgMs: number;
	lastStatus: number;
};

/** /admin/chaal/lab: the setup, what connecting asks for, the stream's window and this server's calls. */
export type ChaalLabState = {
	setup: {
		tokenKey: boolean;
		/** The key id new tokens are sealed with. */
		keyId: string | null;
		appToken: boolean;
		clientId: string;
		apiBase: string;
		redirectUri: string;
	};
	scopes: string[];
	streamWindowSeconds: number;
	publicCooldownUntil: string | null;
	counters: ChaalCallCounts[];
};

/** The lab's check of the public lane: the daily puzzle, through the client and the cache. */
export type ChaalLaneCheck = { puzzleId: string; rating: number | null; ms: number };
