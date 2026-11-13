import { z } from "zod";
import { m } from "@/paraglide/messages";
import { type KharchaSettings, kharchaSettings } from "../settings";

/**
 * /admin/kharcha (PLAN Task 96, decision 0290): what its functions send and take. Counts
 * only, never anyone's amounts or what they spent on (0186); the senders' list names the
 * account, as the admin's users page does, so a suspension has someone to apply to.
 */

/** One UTC day of `kh_daily_stat`. */
export type KharchaDay = {
	day: string;
	people: number;
	guests: number;
	active: number;
	expenses: number;
	groups: number;
	payments: number;
	receipts: number;
	invitesSent: number;
	invitesAccepted: number;
};

export type KharchaOverview = {
	today: string;
	/** Accounts with at least one expense or payment, guests apart. */
	people: number;
	/** Accounts that did anything in the last 7 and 30 days. */
	active: { week: number; month: number };
	/** The last 30 days, today as it stands. */
	totals: Omit<KharchaDay, "day" | "active">;
	days: KharchaDay[];
};

export type KharchaAdminSettings = {
	settings: KharchaSettings;
	/** The row's version, which a save must match. */
	updatedAt: string;
};

/** The form saves every setting at once, from the version it opened at. */
export const updateKharchaSettingsInput = z.strictObject({
	updatedAt: z.string().regex(/^\d+$/),
	settings: kharchaSettings.extend({
		categories: kharchaSettings.shape.categories
			.unwrap()
			.min(1)
			.refine((list) => new Set(list.map((category) => category.key)).size === list.length, {
				error: () => m.kharcha_admin_error_category_keys(),
			}),
	}),
});
export type UpdateKharchaSettingsInput = z.infer<typeof updateKharchaSettingsInput>;

/** An account that sent invites lately, or whose sending is suspended. */
export type KharchaSender = {
	/** The account's id. */
	id: string;
	name: string;
	email: string;
	guest: boolean;
	/** Invites made in the last 24 hours and 30 days, and how many of the 30 days' were taken. */
	day: number;
	month: number;
	accepted: number;
	/** When the admin suspended their invites and reminders; null if they may send. */
	suspendedAt: string | null;
};

export const suspendKharchaSenderInput = z.strictObject({
	userId: z.string().min(1).max(100),
	suspend: z.boolean(),
});
export type SuspendKharchaSenderInput = z.infer<typeof suspendKharchaSenderInput>;
