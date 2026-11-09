import "@tanstack/react-start/server-only";
import { db } from "@/server/db/client";
import { serverEnv } from "@/server/env";
import type { ConnectDeps } from "./connect/service";
import { createVault, type Vault } from "./connect/vault";
import { createChaalControls } from "./controls";
import { createChaalCache } from "./lichess/cache";
import { createLichess } from "./lichess/client";
import { createDbCooldowns } from "./lichess/cooldown";
import { createCounters } from "./lichess/counters";
import { createCallsFlush } from "./stats";

/**
 * This process's Chaal services (PLAN 13.5): the Lichess client with its lanes, cooldowns
 * and counters (flushed to ch_api_stat), the cache, the controls, and the vault (null without CHAAL_TOKEN_KEY).
 * Bump the client version when Chaal's use of the API changes, so Lichess can tell.
 */
const CLIENT_VERSION = "1";

export const chaalControls = createChaalControls(db);

/** The calls' counters, added to ch_api_stat after each call (../stats.ts, Task 79). */
const callsFlush = createCallsFlush(db, () => counters);
const counters = createCounters({ onRecord: callsFlush.schedule });

export const chaalLichess = createLichess(
	{
		apiBase: serverEnv.LICHESS_API_BASE,
		explorerBase: serverEnv.LICHESS_EXPLORER_BASE,
		tablebaseBase: serverEnv.LICHESS_TABLEBASE_BASE,
		userAgent: `Chaal/${CLIENT_VERSION} (+${new URL("/app/chaal/about", serverEnv.BETTER_AUTH_URL).toString()})`,
	},
	fetch,
	{ cooldowns: createDbCooldowns(db, chaalControls), counters },
);

export const chaalCache = createChaalCache();

const vault: Promise<Vault | null> = serverEnv.CHAAL_TOKEN_KEY
	? createVault(serverEnv.CHAAL_TOKEN_KEY)
	: Promise.resolve(null);

/** What the connection service and the stream route need. */
export const chaalConnectDeps = async (): Promise<ConnectDeps> => ({
	db,
	lichess: chaalLichess,
	vault: await vault,
	controls: chaalControls,
});
