import "@tanstack/react-start/server-only";
import { getRequest } from "@tanstack/react-start/server";
import { AppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import { clientIpHash, trustedClientIp } from "@/server/auth/client-ip";
import { db } from "@/server/db/client";
import { serverEnv } from "@/server/env";
import { enforceRateLimit } from "@/server/http/rate-limit";
import type { ChaalUser, ConnectDeps } from "./connect/service";
import type { ChaalBlocks, ChaalControls, ChaalSettingsRow } from "./controls";
import type { ChaalCache } from "./lichess/cache";
import type { Lichess } from "./lichess/client";
import { chaalCache, chaalConnectDeps, chaalControls, chaalLichess } from "./store";

/**
 * What `withChaalPublic` hands a public function (PLAN 13.5): the client, the cache, the
 * controls and this request's settings, plus whether connecting is possible and whether
 * the explorer has the app's token. No session needed.
 */
export type ChaalPublic = {
	lichess: Lichess;
	cache: ChaalCache;
	controls: ChaalControls;
	settings: ChaalSettingsRow;
	/** LICHESS_APP_TOKEN: the explorer works for visitors who haven't connected (decision 0255). */
	appToken: string | null;
	/** CHAAL_TOKEN_KEY is set: connecting Lichess is possible. */
	connectConfigured: boolean;
};

/**
 * Calls over HTTP without a session, per IP (as Parda's, decision 0234): a page reads inside
 * its own request through the cache, so only direct calls count.
 */
const ANONYMOUS_LIMIT = { max: 300, windowSeconds: 300 } as const;

const isServerFunctionCall = (request: Request) => new URL(request.url).pathname.startsWith("/_serverFn/");

export async function chaalPublic(session: Session | null): Promise<ChaalPublic> {
	if (!session) {
		const request = getRequest();
		if (isServerFunctionCall(request)) {
			const ip = clientIpHash(trustedClientIp(request));
			await enforceRateLimit(db, `chaal-public:${ip ?? "unknown"}`, ANONYMOUS_LIMIT);
		}
	}
	return {
		lichess: chaalLichess,
		cache: chaalCache,
		controls: chaalControls,
		settings: await chaalControls.settings(),
		appToken: serverEnv.LICHESS_APP_TOKEN ?? null,
		connectConfigured: Boolean(serverEnv.CHAAL_TOKEN_KEY),
	};
}

/**
 * The session's user for Chaal's personal functions: anyone with a session, guests
 * included; UNAUTHORIZED without one, FORBIDDEN when blocked (`ch_block`).
 */
export function chaalUserOf(session: Session | null, blocks: ChaalBlocks): ChaalUser {
	if (!session) throw new AppError("UNAUTHORIZED", "Authentication required");
	if (blocks.users.has(session.user.id)) throw new AppError("FORBIDDEN", "Blocked from Chaal");
	return { id: session.user.id, isGuest: session.isAnonymous === true };
}

export async function chaalUser(session: Session | null): Promise<ChaalUser> {
	return chaalUserOf(session, await chaalControls.blocks());
}

/** What a personal function's service gets: the connection's dependencies, the user and the cache. */
export type ChaalServices = ConnectDeps & { user: ChaalUser; cache: ChaalCache };

export async function chaalServices(user: ChaalUser): Promise<ChaalServices> {
	return { ...(await chaalConnectDeps()), user, cache: chaalCache };
}
