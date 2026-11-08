import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import { chPreference } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import type { GuestData } from "@/server/guests/data";
import { log } from "@/server/log";
import { moveAnalyses } from "./analysis/service";
import { connectionOf, deleteConnection, moveConnection } from "./connect/repository";
import { moveLocalGames } from "./local/service";

/** Revokes a sealed token at Lichess, best effort (connect/service.ts's `revokeSealed`, with the app's services). */
type Revoke = (sealed: string, userId: string) => Promise<void>;

const revokeWithStore: Revoke = async (sealed, userId) => {
	const [{ chaalConnectDeps }, { revokeSealed }] = await Promise.all([import("./store"), import("./connect/service")]);
	await revokeSealed(await chaalConnectDeps(), sealed, userId);
};

/**
 * Chaal's guests (PLAN 13.5, "Guests"; decision 0254). A guest starts with nothing: it
 * connects Lichess, plays and saves on its own. The claim moves the guest's connection to
 * the account, unless the account already has one: then the account's stays, and the
 * guest's token is revoked at Lichess outside the claim's transaction, not awaited (a
 * network call doesn't belong inside it; if the claim rolls back, that guest reconnects).
 * Preferences move the same way, the account's own winning (Task 73), and saved analyses
 * join the account's (Task 75), and so do local games (Task 76, the account keeping its
 * LOCAL_GAMES_MAX most recent). Puzzle attempts join the claim with their table (Task 80).
 */
export function createChaalGuestData(revoke: Revoke = revokeWithStore): GuestData {
	return {
		slug: "chaal",
		section: "chaal",
		seedGuestData: async () => {},
		claim: async (tx: Tx, fromUserId: string, toUserId: string) => {
			await claimPreferences(tx, fromUserId, toUserId);
			await moveAnalyses(tx, fromUserId, toUserId);
			await moveLocalGames(tx, fromUserId, toUserId);
			const guest = await connectionOf(tx, fromUserId);
			if (!guest) return;
			if (!(await connectionOf(tx, toUserId))) {
				await moveConnection(tx, fromUserId, toUserId);
				return;
			}
			await deleteConnection(tx, fromUserId);
			void revoke(guest.token, toUserId).catch((error: unknown) =>
				log("warn", "chaal guest token revoke failed", { error: String(error) }),
			);
		},
	};
}

/** The guest's preferences become the account's, unless the account has its own (they win). */
async function claimPreferences(tx: Tx, fromUserId: string, toUserId: string): Promise<void> {
	const [own] = await tx
		.select({ userId: chPreference.userId })
		.from(chPreference)
		.where(eq(chPreference.userId, toUserId));
	if (own) await tx.delete(chPreference).where(eq(chPreference.userId, fromUserId));
	else await tx.update(chPreference).set({ userId: toUserId }).where(eq(chPreference.userId, fromUserId));
}

export const CHAAL_GUEST_DATA: GuestData = createChaalGuestData();
