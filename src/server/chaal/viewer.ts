import "@tanstack/react-start/server-only";
import { type ChaalFeature, featureOn, missingScopes } from "@/features/chaal/features";
import { isAppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import { type ChaalConnectionRow, connectionOf } from "./connect/repository";
import { type ConnectDeps, withToken } from "./connect/service";
import type { ChaalPublic } from "./context";

/**
 * A public page's viewer (Tasks 81 and 83): what Lichess says only to a player's own token
 * (whether they follow someone, where they stand in an arena, whether they're in a team, a
 * private study) is read with it when it may be used, never cached, and the page falls back
 * to the public read when it can't. Never an error of its own.
 */
export type Viewer = { deps: ConnectDeps; userId: string; row: ChaalConnectionRow };

/** The session's connection when it's active (not revoked), else null. */
export async function viewerOf(chaal: ChaalPublic, session: Session | null): Promise<Viewer | null> {
	if (!session || !chaal.connectConfigured) return null;
	const deps = await chaal.connectDeps();
	const row = await connectionOf(deps.db, session.user.id);
	return row && !row.revokedAt ? { deps, userId: session.user.id, row } : null;
}

/** Whether a connection may be used for a feature now: not revoked, not in maintenance, the feature on, its scopes granted. */
export function canUse(
	chaal: Pick<ChaalPublic, "settings">,
	row: ChaalConnectionRow | null,
	feature: ChaalFeature,
): row is ChaalConnectionRow {
	return Boolean(
		row &&
			!row.revokedAt &&
			!chaal.settings.maintenance &&
			featureOn(chaal.settings.features, feature) &&
			missingScopes(feature, row.scopes).length === 0,
	);
}

/** `read` with the viewer's token, or null when it can't be used or Lichess refused it. */
export async function readAsViewer<T>(
	chaal: ChaalPublic,
	viewer: Viewer | null,
	feature: ChaalFeature,
	read: (token: string, row: ChaalConnectionRow) => Promise<T>,
): Promise<T | null> {
	if (!viewer || !canUse(chaal, viewer.row, feature)) return null;
	try {
		return await withToken(viewer.deps, viewer.userId, feature, read);
	} catch (error) {
		if (isAppError(error) && error.reason === "lichess-reconnect") return null;
		throw error;
	}
}
