import "@tanstack/react-start/server-only";
import type { Locale } from "@/paraglide/runtime";
import { APP_SERVERS } from "@/server/apps/registry"; // @apps
import { CHAAL_GUEST_DATA } from "@/server/chaal/guest-data"; // @chaal
import type { Tx } from "@/server/db/types";
import { PARDA_GUEST_DATA } from "@/server/parda/guest-data"; // @parda
import { TASKLINE_GUEST_DATA } from "@/server/taskline/sandbox"; // @taskline

/**
 * What owns rows a guest can make (decision 0186): each showcase app, and Taskline's sandbox. A new guest
 * gets every owner's sample rows; a guest who signs up or in hands every owner's rows
 * to the account. Both run in one transaction with the rest of the claim or start.
 */
export type GuestData = {
	/** Its name in logs ("kanban"). */
	slug: string;
	/**
	 * The section whose guests it seeds (PLAN 12.5, `guest_scope`): a guest started there
	 * gets only that section's samples. Unset: seeded for guests started anywhere else.
	 */
	section?: string;
	/** Sample rows for a new guest, in the language they started in. */
	seedGuestData: (tx: Tx, userId: string, locale: Locale) => Promise<void>;
	/** Moves every row of `fromUserId` (a guest) to `toUserId` (an account). */
	claim: (tx: Tx, fromUserId: string, toUserId: string) => Promise<void>;
};

export const GUEST_DATA: ReadonlyArray<GuestData> = [
	...APP_SERVERS, // @apps
	TASKLINE_GUEST_DATA, // @taskline
	PARDA_GUEST_DATA, // @parda
	CHAAL_GUEST_DATA, // @chaal
];

/**
 * The owners a new guest is seeded from: with a `guest_scope` (a section's id), only that
 * section's; without one, everyone's but the sections', as before sections had guests.
 * Claims always go through every owner.
 */
export const guestOwnersFor = (scope: string | null, owners: ReadonlyArray<GuestData> = GUEST_DATA) =>
	owners.filter((owner) => (scope ? owner.section === scope : owner.section === undefined));
