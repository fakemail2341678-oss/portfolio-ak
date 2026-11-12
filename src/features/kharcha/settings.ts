import { z } from "zod";
import { CURRENCIES } from "@/lib/i18n/currency";

/**
 * Kharcha's settings (`kh_settings.settings`, one row), with their defaults in code: the
 * row holds only what the admin changed, so a new setting needs no migration and `{}` is
 * the default. Read them with `kharchaSettings.parse()`. The admin edits them on
 * /admin/kharcha/settings (Task 96); a later task adds its own keys here.
 */

/** Limits per person (PLAN 14.5 "Quotas"), counted under `lockQuota`. */
export const QUOTA_DEFAULTS = {
	/** Expenses a person created, the trash included. */
	expenses: 10_000,
	payments: 10_000,
	/** Groups a person created. */
	groups: 50,
	groupMembers: 50,
	friends: 500,
} as const;

/** A guest's are smaller: enough to try everything, too few to fill the database. */
export const GUEST_QUOTA_DEFAULTS = {
	expenses: 300,
	payments: 100,
	groups: 5,
	groupMembers: 10,
	friends: 20,
} as const;

export type KharchaQuotas = { [Key in keyof typeof QUOTA_DEFAULTS]: number };

const limit = (fallback: number) => z.number().int().min(0).max(1_000_000).default(fallback);
const quotas = (defaults: KharchaQuotas) =>
	z
		.object({
			expenses: limit(defaults.expenses),
			payments: limit(defaults.payments),
			groups: limit(defaults.groups),
			groupMembers: limit(defaults.groupMembers),
			friends: limit(defaults.friends),
		})
		.default(defaults);

export const kharchaSettings = z.object({
	quotas: quotas(QUOTA_DEFAULTS),
	guestQuotas: quotas(GUEST_QUOTA_DEFAULTS),
	/** The currencies offered; empty means every one in `CURRENCIES`. */
	currencies: z.array(z.enum(CURRENCIES)).max(CURRENCIES.length).default([]),
	/** Whether people may invite others by email, and remind friends of a debt (Tasks 90 and 91). */
	invites: z.boolean().default(true),
	reminders: z.boolean().default(true),
});

export type KharchaSettings = z.infer<typeof kharchaSettings>;
/** What the row stores: any subset. */
export type StoredKharchaSettings = z.input<typeof kharchaSettings>;

/** The currencies a person can pick, in `CURRENCIES`' order. */
export const offeredCurrencies = (settings: Pick<KharchaSettings, "currencies">): string[] =>
	settings.currencies.length === 0 ? [...CURRENCIES] : CURRENCIES.filter((code) => settings.currencies.includes(code));
