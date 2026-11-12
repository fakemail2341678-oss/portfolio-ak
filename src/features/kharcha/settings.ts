import { z } from "zod";
import { CURRENCIES } from "@/lib/i18n/currency";
import { CATEGORY_ICONS, KHARCHA_COLORS } from "./types";

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
	/** A person's own lists (Task 89). */
	categories: 100,
	tags: 200,
	methods: 30,
	rules: 100,
	/** Receipts on one expense, and receipts waiting for their details. */
	receipts: 10,
	drafts: 100,
} as const;

/** A guest's are smaller: enough to try everything, too few to fill the database. */
export const GUEST_QUOTA_DEFAULTS = {
	expenses: 300,
	payments: 100,
	groups: 5,
	groupMembers: 10,
	friends: 20,
	categories: 30,
	tags: 30,
	methods: 10,
	rules: 20,
	receipts: 5,
	drafts: 10,
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
			categories: limit(defaults.categories),
			tags: limit(defaults.tags),
			methods: limit(defaults.methods),
			rules: limit(defaults.rules),
			receipts: limit(defaults.receipts),
			drafts: limit(defaults.drafts),
		})
		.default(defaults);

/** A built-in category as the admin offers it (Task 96 edits them): its key, its name in each language, its look. */
const defaultCategory = z.object({
	key: z.string().regex(/^[a-z][a-z0-9-]{0,29}$/),
	name: z.object({ en: z.string().min(1).max(40), ne: z.string().min(1).max(40) }),
	icon: z.enum(CATEGORY_ICONS),
	color: z.enum(KHARCHA_COLORS),
});
export type DefaultCategory = z.infer<typeof defaultCategory>;

/**
 * The categories everyone starts with (PLAN 14.5 `kh_settings`), in this order: made with a
 * person's first use, in their language then (src/server/kharcha/lists/service.ts).
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
	{ key: "food", name: { en: "Food and drink", ne: "खानपान" }, icon: "utensils", color: "orange" },
	{ key: "groceries", name: { en: "Groceries", ne: "किराना" }, icon: "shopping-basket", color: "green" },
	{ key: "transport", name: { en: "Transport", ne: "यातायात" }, icon: "bus", color: "blue" },
	{ key: "rent", name: { en: "Rent", ne: "घरभाडा" }, icon: "house", color: "indigo" },
	{ key: "utilities", name: { en: "Bills", ne: "बिल" }, icon: "zap", color: "amber" },
	{ key: "phone", name: { en: "Phone and internet", ne: "फोन र इन्टरनेट" }, icon: "wifi", color: "teal" },
	{ key: "shopping", name: { en: "Shopping", ne: "किनमेल" }, icon: "shopping-bag", color: "pink" },
	{ key: "fun", name: { en: "Entertainment", ne: "मनोरञ्जन" }, icon: "film", color: "violet" },
	{ key: "health", name: { en: "Health", ne: "स्वास्थ्य" }, icon: "heart-pulse", color: "red" },
	{ key: "education", name: { en: "Education", ne: "शिक्षा" }, icon: "graduation-cap", color: "blue" },
	{ key: "travel", name: { en: "Travel", ne: "यात्रा" }, icon: "plane", color: "teal" },
	{ key: "gifts", name: { en: "Gifts", ne: "उपहार" }, icon: "gift", color: "pink" },
	{ key: "other", name: { en: "Other", ne: "अन्य" }, icon: "receipt", color: "gray" },
];

/** The payment methods everyone starts with: labels only, renamed or archived as they like. */
export const DEFAULT_METHODS: ReadonlyArray<{ en: string; ne: string }> = [
	{ en: "Cash", ne: "नगद" },
	{ en: "Card", ne: "कार्ड" },
	{ en: "eSewa", ne: "इसेवा" },
	{ en: "Khalti", ne: "खल्ती" },
];

export const kharchaSettings = z.object({
	quotas: quotas(QUOTA_DEFAULTS),
	guestQuotas: quotas(GUEST_QUOTA_DEFAULTS),
	/** The currencies offered; empty means every one in `CURRENCIES`. */
	currencies: z.array(z.enum(CURRENCIES)).max(CURRENCIES.length).default([]),
	/** Whether people may invite others by email, and remind friends of a debt (Tasks 90 and 91). */
	invites: z.boolean().default(true),
	reminders: z.boolean().default(true),
	/** The built-in categories (Task 96 edits them); each person's are made from these on first use. */
	categories: z.array(defaultCategory).max(50).default(DEFAULT_CATEGORIES),
});

export type KharchaSettings = z.infer<typeof kharchaSettings>;
/** What the row stores: any subset. */
export type StoredKharchaSettings = z.input<typeof kharchaSettings>;

/** The currencies a person can pick, in `CURRENCIES`' order. */
export const offeredCurrencies = (settings: Pick<KharchaSettings, "currencies">): string[] =>
	settings.currencies.length === 0 ? [...CURRENCIES] : CURRENCIES.filter((code) => settings.currencies.includes(code));
