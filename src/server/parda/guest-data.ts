import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import { pdProfile, pdReport } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import type { GuestData } from "@/server/guests/data";
import { mergeProfiles } from "./library/repository";
import { mergeSaved } from "./library/saved-repository";
import { claimParties } from "./party/repository";
import { defaultProfile, profilesOf } from "./profiles/repository";

/**
 * Parda's guests (PLAN 12.5, "Guests"; decision 0236). A guest starts with nothing: its
 * default profile is made on its first save. The claim merges the guest's default
 * profile into the account's (the later progress wins, as `claimSandbox` merges labels;
 * My List, ♥ and likes join the account's, decision 0240) and hands any other profile
 * over as it is.
 */
export const PARDA_GUEST_DATA: GuestData = {
	slug: "parda",
	section: "parda",
	seedGuestData: async () => {},
	claim: async (tx: Tx, fromUserId: string, toUserId: string) => {
		const profiles = await profilesOf(tx, fromUserId);
		if (profiles.length > 0) {
			const target = await defaultProfile(tx, toUserId);
			for (const profile of profiles) {
				if (profile.isDefault && target) {
					await mergeProfiles(tx, profile.id, target.id);
					await mergeSaved(tx, profile.id, target.id);
					await tx.delete(pdProfile).where(eq(pdProfile.id, profile.id));
				} else {
					await tx.update(pdProfile).set({ ownerId: toUserId }).where(eq(pdProfile.id, profile.id));
				}
			}
		}
		await tx.update(pdReport).set({ reporterId: toUserId }).where(eq(pdReport.reporterId, fromUserId));
		await claimParties(tx, fromUserId, toUserId);
	},
};
