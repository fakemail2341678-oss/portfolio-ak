import { z } from "zod";
import { CURRENCIES } from "@/lib/i18n/currency";
import { email, isoDate, optionalText, required } from "@/lib/validation";
import { FULL_BP, MAX_AMOUNT_MINOR, MAX_WEIGHT, SPLIT_METHODS } from "./money/split";
import { EXPENSE_KINDS, GROUP_ICONS, GROUP_KINDS, KHARCHA_COLORS, KHARCHA_STARTS } from "./types";

/**
 * Kharcha's inputs, checked on the server (and by the forms from Task 88). Amounts are
 * integer minor units: a form converts what was typed with `toMinor` (src/lib/i18n/currency.ts).
 * Ids of new rows may come from the browser, so an optimistic row and the saved one share
 * their key. Whether a split adds up is the money core's question (`computeShares`), asked
 * by the service; these schemas only bound its shape.
 */

export const TITLE_MAX = 200;
export const MERCHANT_MAX = 80;
export const NOTES_MAX = 2_000;
export const NAME_MAX = 60;
export const METHOD_MAX = 40;
export const PAYMENT_NOTE_MAX = 500;
/** People on one expense: a group's members at most. */
export const PARTICIPANTS_MAX = 50;
export const LINES_MAX = 100;
export const LINE_LABEL_MAX = 80;

const id = z.uuid();
const minor = z.number().int().min(1).max(MAX_AMOUNT_MINOR);
const minorOrZero = z.number().int().min(0).max(MAX_AMOUNT_MINOR);
const currency = z.enum(CURRENCIES);
const people = z.array(id).min(1).max(PARTICIPANTS_MAX);
const parts = <T extends z.ZodType>(value: T) => z.array(value).min(1).max(PARTICIPANTS_MAX);

/** A split's inputs, as `kh_expense.split` stores them (src/features/kharcha/money/split.ts). */
export const split = z.discriminatedUnion("method", [
	z.strictObject({ method: z.literal("equal"), people }),
	z.strictObject({ method: z.literal("exact"), parts: parts(z.strictObject({ person: id, amount: minorOrZero })) }),
	z.strictObject({
		method: z.literal("percent"),
		parts: parts(z.strictObject({ person: id, bp: z.number().int().min(0).max(FULL_BP) })),
	}),
	z.strictObject({
		method: z.literal("shares"),
		parts: parts(z.strictObject({ person: id, weight: z.number().int().min(0).max(MAX_WEIGHT) })),
	}),
	z.strictObject({
		method: z.literal("adjustment"),
		parts: parts(z.strictObject({ person: id, adjust: z.number().int().min(-MAX_AMOUNT_MINOR).max(MAX_AMOUNT_MINOR) })),
	}),
	z.strictObject({
		method: z.literal("itemized"),
		lines: z
			.array(z.strictObject({ label: optionalText({ max: LINE_LABEL_MAX }), amount: minor, people }))
			.min(1)
			.max(LINES_MAX),
		service: minorOrZero,
		tax: minorOrZero,
	}),
	z.strictObject({ method: z.literal("full"), person: id }),
]);

const payers = parts(z.strictObject({ person: id, amount: minor }));

const expenseFields = {
	kind: z.enum(EXPENSE_KINDS).default("expense"),
	title: optionalText({ max: TITLE_MAX }).default(""),
	merchant: optionalText({ max: MERCHANT_MAX }).default(""),
	notes: optionalText({ max: NOTES_MAX }).default(""),
	amountMinor: minor,
	currency,
	spentOn: isoDate(),
	/** Who paid; left out, the caller paid all of it. */
	payers: payers.optional(),
	/** How it is split; left out, it is the caller's alone. */
	split: split.optional(),
};

export const expenseIdInput = z.strictObject({ expenseId: id });

/** A new expense. `groupId` puts it in a group; without one it is personal or shared with friends. */
export const createExpenseInput = z.strictObject({
	id: id.optional(),
	groupId: id.nullable().default(null),
	...expenseFields,
});

/** The expense form's save: every field, with the `version` it was loaded at (a stale one is refused). */
export const updateExpenseInput = z.strictObject({
	expenseId: id,
	version: z.number().int().min(1),
	...expenseFields,
});

/** A decimal rate with up to 8 decimals, kept as text: nothing is computed from it in floating point. */
export const RATE_PATTERN = /^(?=.*[1-9])\d{1,9}(?:\.\d{1,8})?$/;

const paymentFields = {
	amountMinor: minor,
	currency,
	/** What changed hands when it was another currency, and the rate the payer typed. */
	paid: z
		.strictObject({ currency, amountMinor: minor, rate: z.string().regex(RATE_PATTERN) })
		.nullable()
		.default(null),
	/** How it was paid, as a label ("Cash", "eSewa"): no money moves through Kharcha. */
	method: optionalText({ max: METHOD_MAX }).default(""),
	note: optionalText({ max: PAYMENT_NOTE_MAX }).default(""),
	paidOn: isoDate(),
};

export const paymentIdInput = z.strictObject({ paymentId: id });

/** A payment made elsewhere, recorded: `fromId` paid `toId`. */
export const createPaymentInput = z.strictObject({
	id: id.optional(),
	groupId: id.nullable().default(null),
	fromId: id,
	toId: id,
	...paymentFields,
});

export const updatePaymentInput = z.strictObject({
	paymentId: id,
	version: z.number().int().min(1),
	...paymentFields,
});

const groupFields = {
	name: required({ max: NAME_MAX }),
	kind: z.enum(GROUP_KINDS).default("other"),
	color: z.enum(KHARCHA_COLORS).default("teal"),
	/** Left out, the kind's own icon. */
	icon: z.enum(GROUP_ICONS).optional(),
	currency,
	/** A trip's dates. */
	startOn: isoDate().nullable().default(null),
	endOn: isoDate().nullable().default(null),
};

const groupDates = (value: { startOn: string | null; endOn: string | null }) =>
	value.startOn === null || value.endOn === null || value.startOn <= value.endOn;

export const groupIdInput = z.strictObject({ groupId: id });

export const createGroupInput = z
	.strictObject({
		id: id.optional(),
		...groupFields,
		/** Friends to add at once. */
		memberIds: z.array(id).max(PARTICIPANTS_MAX).default([]),
	})
	.refine(groupDates, { path: ["endOn"] });

export const updateGroupInput = z
	.strictObject({
		groupId: id,
		version: z.number().int().min(1),
		...groupFields,
		defaultSplit: z.enum(SPLIT_METHODS).default("equal"),
		simplify: z.boolean().default(true),
	})
	.refine(groupDates, { path: ["endOn"] });

export const archiveGroupInput = z.strictObject({ groupId: id, archived: z.boolean() });
export const groupMemberInput = z.strictObject({ groupId: id, personId: id });

export const personIdInput = z.strictObject({ personId: id });

/** A friend by name only (a contact private to the caller), or by their address too. */
export const addFriendInput = z.strictObject({
	name: required({ max: NAME_MAX }),
	email: email().optional(),
});

export const updateFriendInput = z.strictObject({
	personId: id,
	nickname: optionalText({ max: NAME_MAX }).optional(),
	hidden: z.boolean().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseInput>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseInput>;
export type CreatePaymentInput = z.infer<typeof createPaymentInput>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentInput>;
export type CreateGroupInput = z.infer<typeof createGroupInput>;
export type UpdateGroupInput = z.infer<typeof updateGroupInput>;
export type AddFriendInput = z.infer<typeof addFriendInput>;
export type UpdateFriendInput = z.infer<typeof updateFriendInput>;

/** An IANA time zone this runtime knows ("Asia/Kathmandu"): `Intl` throws on any other. */
export const timeZone = z
	.string()
	.min(1)
	.max(64)
	.refine((value) => {
		try {
			new Intl.DateTimeFormat("en", { timeZone: value });
			return true;
		} catch {
			return false;
		}
	});

/**
 * Onboarding (Task 88): home currency, time zone and what they came for. Skipping sends
 * what is already set, so the dialog never comes back either way.
 */
export const onboardingInput = z.strictObject({
	homeCurrency: currency,
	timeZone,
	start: z.enum(KHARCHA_STARTS),
});

export type OnboardingInput = z.infer<typeof onboardingInput>;
