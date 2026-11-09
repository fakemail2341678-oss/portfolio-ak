import "@tanstack/react-start/server-only";
import { CHAAL_FEATURES, type ChaalFeature, featureOn, missingScopes, scopesFor } from "@/features/chaal/features";
import type { ConnectResult } from "@/features/chaal/links";
import type { ChaalConnection } from "@/features/chaal/schema";
import { AppError } from "@/lib/errors";
import { isUniqueViolation } from "@/server/db/crud";
import type { Db } from "@/server/db/types";
import { errorFields, log } from "@/server/log";
import { recordActivity } from "../activity";
import type { ChaalControls, ChaalSettingsRow } from "../controls";
import { type Lichess, LichessAuthError } from "../lichess/client";
import { userLane } from "../lichess/lanes";
import { accountAnswer, tokenAnswer } from "../lichess/schemas";
import {
	authorizeUrl,
	type CallbackQuery,
	challengeOf,
	newState,
	newVerifier,
	type OAuthPending,
	sealPending,
} from "./oauth";
import {
	type ChaalConnectionRow,
	connectionForLichess,
	connectionOf,
	deleteConnection,
	markRevoked,
	markUsed,
	saveConnection,
} from "./repository";
import type { Vault } from "./vault";

/**
 * Connecting Lichess to a session's user (PLAN 13.5, decision 0256). Public features need
 * none of this. A token exists in plain form only inside `withToken`'s callback: it's never
 * returned, logged or rendered (tests/server/chaal-connect.test.ts checks every output).
 */

export type ConnectDeps = {
	db: Db;
	lichess: Lichess;
	/** Null when CHAAL_TOKEN_KEY is unset: connecting is off. */
	vault: Vault | null;
	controls: ChaalControls;
	now?: () => number;
};

export type ChaalUser = { id: string; isGuest: boolean };

const clock = (deps: ConnectDeps) => deps.now ?? Date.now;

/**
 * What a page may show about a connection, never the token: `revoked` when Lichess refused
 * it ("Reconnect"), `needsScopesFor` the enabled features it lacks a scope for ("Reconnect to allow …").
 */
export type ChaalConnectionView = ChaalConnection;

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function viewOf(row: ChaalConnectionRow, settings: ChaalSettingsRow, now: number): ChaalConnectionView {
	const expired = row.expiresAt !== null && row.expiresAt.getTime() <= now;
	return {
		lichessId: row.lichessId,
		username: row.username,
		title: row.title,
		scopes: row.scopes,
		connectedAt: row.connectedAt.toISOString(),
		lastUsedAt: iso(row.lastUsedAt),
		expiresAt: iso(row.expiresAt),
		revoked: row.revokedAt !== null || expired,
		needsScopesFor: CHAAL_FEATURES.filter(
			(feature) => featureOn(settings.features, feature) && missingScopes(feature, row.scopes).length > 0,
		),
	};
}

export async function connectionView(deps: ConnectDeps, userId: string): Promise<ChaalConnectionView | null> {
	const [row, settings] = await Promise.all([connectionOf(deps.db, userId), deps.controls.settings()]);
	return row ? viewOf(row, settings, clock(deps)()) : null;
}

/** Why `user` may not connect now, or null when they may. */
export async function connectRefusal(deps: ConnectDeps, user: ChaalUser): Promise<ConnectResult | null> {
	if (!deps.vault) return "off";
	const [settings, blocks] = await Promise.all([deps.controls.settings(), deps.controls.blocks()]);
	if (settings.maintenance || (user.isGuest && !settings.guestsMayConnect)) return "off";
	if (blocks.users.has(user.id)) return "blocked";
	return null;
}

export type ConnectStart =
	| { kind: "redirect"; location: string; cookie: string }
	| { kind: "refused"; result: ConnectResult };

/** GET /api/chaal/oauth/start: the sealed cookie and Lichess's approval page, asking for the enabled features' scopes. */
export async function startConnect(
	deps: ConnectDeps,
	user: ChaalUser,
	{ returnTo, redirectUri, clientId }: { returnTo: string; redirectUri: string; clientId: string },
): Promise<ConnectStart> {
	const refusal = await connectRefusal(deps, user);
	if (refusal || !deps.vault) return { kind: "refused", result: refusal ?? "off" };
	const settings = await deps.controls.settings();
	const pending: OAuthPending = {
		state: newState(),
		verifier: newVerifier(),
		userId: user.id,
		returnTo,
		scopes: scopesFor(settings.features, settings.extraScopes),
		at: clock(deps)(),
	};
	return {
		kind: "redirect",
		cookie: await sealPending(deps.vault, pending),
		location: authorizeUrl({
			apiBase: deps.lichess.config.apiBase,
			clientId,
			redirectUri,
			challenge: await challengeOf(pending.verifier),
			state: pending.state,
			scopes: pending.scopes,
		}),
	};
}

/** Revokes a token Chaal won't keep. Best effort: Lichess may be unreachable, and the token is dropped either way. */
async function revokeQuietly(deps: ConnectDeps, token: string, userId: string): Promise<void> {
	try {
		await deps.lichess.send({
			endpoint: "token-revoke",
			method: "DELETE",
			path: "/api/token",
			token,
			lane: userLane(userId),
		});
	} catch (error) {
		log("warn", "chaal token revoke failed", errorFields(error));
	}
}

/** A sealed token's revocation, for a connection that is going away (disconnect, a guest's claim). */
export async function revokeSealed(deps: ConnectDeps, sealed: string, userId: string): Promise<void> {
	if (!deps.vault) return;
	let token: string;
	try {
		token = await deps.vault.open(sealed, "token");
	} catch {
		// Sealed with a key that's gone: nothing to revoke from here.
		return;
	}
	await revokeQuietly(deps, token, userId);
}

/**
 * GET /api/chaal/oauth/callback: checks the state against the cookie's, exchanges the code,
 * reads the account and saves the connection. A Lichess account belongs to one site user:
 * connecting it from another is refused ("taken"), and the new token is revoked.
 */
export async function completeConnect(
	deps: ConnectDeps,
	user: ChaalUser,
	{
		query,
		pending,
		redirectUri,
		clientId,
	}: { query: CallbackQuery; pending: OAuthPending | null; redirectUri: string; clientId: string },
): Promise<ConnectResult> {
	if (!pending) return "expired";
	if (!query.state || query.state !== pending.state || pending.userId !== user.id) {
		log("warn", "chaal connect state mismatch", { sameUser: pending.userId === user.id });
		return "failed";
	}
	if (query.error) return query.error === "access_denied" ? "denied" : "failed";
	if (!query.code) return "failed";
	const refusal = await connectRefusal(deps, user);
	if (refusal || !deps.vault) return refusal ?? "off";
	const vault = deps.vault;

	let token: string;
	let expiresInSeconds: number;
	try {
		({ token, expiresInSeconds } = await deps.lichess.json(
			{
				endpoint: "token",
				method: "POST",
				path: "/api/token",
				form: {
					grant_type: "authorization_code",
					code: query.code,
					code_verifier: pending.verifier,
					redirect_uri: redirectUri,
					client_id: clientId,
				},
				lane: userLane(user.id),
			},
			tokenAnswer,
		));
	} catch (error) {
		log("warn", "chaal connect token exchange failed", errorFields(error));
		return "failed";
	}

	let account: Awaited<ReturnType<typeof readAccount>>;
	try {
		account = await readAccount(deps, token, user.id);
	} catch (error) {
		log("warn", "chaal connect account read failed", errorFields(error));
		await revokeQuietly(deps, token, user.id);
		return "failed";
	}
	const blocks = await deps.controls.blocks();
	if (account.closed || blocks.lichess.has(account.id)) {
		await revokeQuietly(deps, token, user.id);
		return account.closed ? "failed" : "blocked";
	}
	const owner = await connectionForLichess(deps.db, account.id);
	if (owner && owner.userId !== user.id) {
		await revokeQuietly(deps, token, user.id);
		return "taken";
	}

	const now = clock(deps)();
	const previous = await connectionOf(deps.db, user.id);
	try {
		await saveConnection(
			deps.db,
			{
				userId: user.id,
				lichessId: account.id,
				username: account.username,
				title: account.title,
				token: await vault.seal(token, "token"),
				scopes: pending.scopes,
				expiresAt: new Date(now + expiresInSeconds * 1000),
			},
			new Date(now),
		);
	} catch (error) {
		// Another user connected the same account a moment ago.
		if (isUniqueViolation(error, "ch_connection_lichess_unique")) {
			await revokeQuietly(deps, token, user.id);
			return "taken";
		}
		throw error;
	}
	// The new token replaced the user's earlier one (the same account or another): the old one isn't kept, so it's revoked.
	if (previous) await revokeSealed(deps, previous.token, user.id);
	log("info", "chaal connected", { lichessId: account.id, guest: user.isGuest });
	await recordActivity(deps.db, { userId: user.id, kind: "connect" });
	return "connected";
}

function readAccount(deps: ConnectDeps, token: string, userId: string) {
	return deps.lichess.json({ endpoint: "account", path: "/api/account", token, lane: userLane(userId) }, accountAnswer);
}

/** Disconnect: revokes the token at Lichess (best effort), then forgets the connection. */
export async function disconnect(deps: ConnectDeps, userId: string): Promise<void> {
	const row = await connectionOf(deps.db, userId);
	if (!row) return;
	await revokeSealed(deps, row.token, userId);
	await deleteConnection(deps.db, userId);
	log("info", "chaal disconnected", { lichessId: row.lichessId });
}

const reconnect = (message: string) => new AppError("FORBIDDEN", message, { reason: "lichess-reconnect" });

/** Refuses what uses a player's token while the admin has Chaal in maintenance (Task 79, decision 0268). */
export function requireNoMaintenance(settings: ChaalSettingsRow): void {
	if (settings.maintenance) throw new AppError("FORBIDDEN", "Chaal is in maintenance");
}

/** Refuses a call to a feature the admin turned off. */
export function requireFeature(settings: ChaalSettingsRow, feature: ChaalFeature): void {
	if (!featureOn(settings.features, feature)) throw new AppError("FORBIDDEN", `Chaal's ${feature} is off`);
}

/** How often `lastUsedAt` is written: not on every call. */
const USE_WRITE_MS = 5 * 60_000;

/**
 * Runs `use` with the user's token, for a feature: refused in maintenance, when the feature
 * is off, the user has no connection, Lichess revoked it, or it lacks the feature's scopes. A 401 from Lichess
 * inside `use` marks the connection revoked, so the UI says "Reconnect".
 */
export async function withToken<T>(
	deps: ConnectDeps,
	userId: string,
	feature: ChaalFeature,
	use: (token: string, connection: ChaalConnectionRow) => Promise<T>,
): Promise<T> {
	const [row, settings] = await Promise.all([connectionOf(deps.db, userId), deps.controls.settings()]);
	requireNoMaintenance(settings);
	requireFeature(settings, feature);
	if (!row) throw reconnect("Lichess isn't connected");
	const now = clock(deps)();
	if (row.revokedAt || (row.expiresAt && row.expiresAt.getTime() <= now)) throw reconnect("Lichess token revoked");
	const missing = missingScopes(feature, row.scopes);
	if (missing.length > 0) throw reconnect(`Lichess token lacks ${missing.join(", ")}`);
	if (!deps.vault) throw new AppError("FORBIDDEN", "Connecting Lichess is off");
	let token: string;
	try {
		token = await deps.vault.open(row.token, "token");
	} catch {
		// Sealed with a key that was removed from CHAAL_TOKEN_KEY: only a new connection helps.
		await markRevoked(deps.db, userId, new Date(now));
		throw reconnect("Lichess token can't be opened");
	}
	try {
		const result = await use(token, row);
		if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > USE_WRITE_MS)
			await markUsed(deps.db, userId, new Date(now));
		return result;
	} catch (error) {
		if (error instanceof LichessAuthError) {
			await markRevoked(deps.db, userId, new Date(now));
			log("info", "chaal token revoked by lichess", { lichessId: row.lichessId });
		}
		throw error;
	}
}
