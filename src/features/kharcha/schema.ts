import { z } from "zod";
import { CURRENCIES } from "@/lib/i18n/currency";
import { email, isoDate, optionalText, required } from "@/lib/validation";
import { BUDGET_PERIODS } from "./budgets/period";
import { FULL_BP, MAX_AMOUNT_MINOR, MAX_WEIGHT, SPLIT_METHODS } from "./money/split";
import { COMMENT_MAX, NOTIFY_EMAILS, NOTIFY_KINDS, REACTIONS, THREAD_KEY, type ThreadKey } from "./notifications";
import { RECURRING_EVERY_MAX, RECURRING_UNITS } from "./recurring/cadence";
import {
	CATEGORY_ICONS,
	EXPENSE_KINDS,
	GROUP_ICONS,
	GROUP_KINDS,
	KHARCHA_COLORS,
	KHARCHA_STARTS,
	RULE_MATCHES,
} from "./types";

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
export const CATEGORY_NAME_MAX = 40;
export const TAG_NAME_MAX = 30;
/** Tags on one person's part of an expense, and on one rule. */
export const TAGS_MAX = 10;
/** Receipts on one expense (the admin's quota may be lower: `receipts`). */
export const RECEIPTS_MAX = 10;

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
	/**
	 * The caller's own category, tags and method (Task 89). Left out on a new expense, the
	 * merchant's rule or the category they last gave the merchant; null: none.
	 */
	categoryId: id.nullable().optional(),
	tagIds: z.array(id).max(TAGS_MAX).optional(),
	methodId: id.nullable().optional(),
	/** Its receipts, in order: the caller's uploads, or files it has. */
	receiptIds: z.array(id).max(RECEIPTS_MAX).optional(),
};

export const expenseIdInput = z.strictObject({ expenseId: id });

/** "Not a duplicate" (`ok`), or "it may be one" again: the caller's own flag on their share. */
export const markDuplicateInput = z.strictObject({ expenseId: id, ok: z.boolean() });

/** A new expense. `groupId` puts it in a group; without one it is personal or shared with friends. */
export const createExpenseInput = z.strictObject({
	id: id.optional(),
	groupId: id.nullable().default(null),
	...expenseFields,
	/** A receipt draft this expense is made from: it takes the draft's files, and the draft goes. */
	draftId: id.optional(),
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

/**
 * A friend by name only (a contact private to the caller), or by their address too; with
 * `invite`, someone without an account is emailed an invite at once (Task 90).
 */
export const addFriendInput = z.strictObject({
	name: required({ max: NAME_MAX }),
	email: email().optional(),
	invite: z.boolean().default(false),
});

export const updateFriendInput = z.strictObject({
	personId: id,
	nickname: optionalText({ max: NAME_MAX }).optional(),
	hidden: z.boolean().optional(),
});

/** An address for a contact of the caller's who has a name only: it merges into whoever has that address. */
export const friendEmailInput = z.strictObject({
	personId: id,
	email: email(),
	invite: z.boolean().default(false),
});

/** `/people`: the caller's friends and groups whose name has `q`; `hidden` lists the friends they hid too. */
export const peopleInput = z.strictObject({
	q: z.string().trim().max(80).default(""),
	hidden: z.boolean().default(false),
});

/** A link for a friend without an account, from a group (its name shows on the page) or not; `send` emails it. */
export const inviteInput = z.strictObject({
	personId: id,
	groupId: id.nullable().default(null),
	send: z.boolean().default(false),
});

/** An invite link's token (src/features/kharcha/search.ts has the route's pattern). */
export const joinTokenInput = z.strictObject({ token: z.string().regex(/^[\w-]{32}$/) });

/** Someone new in a group: a friend made on the way (by name, or with an address), then added. */
export const newGroupMemberInput = z.strictObject({
	groupId: id,
	name: required({ max: NAME_MAX }),
	email: email().optional(),
});

// Lists (Task 89): the caller's own categories, tags, payment methods and merchant rules.

export const listIdInput = z.strictObject({ id });

const categoryFields = {
	name: required({ max: CATEGORY_NAME_MAX }),
	icon: z.enum(CATEGORY_ICONS),
	color: z.enum(KHARCHA_COLORS),
};
export const createCategoryInput = z.strictObject({ id: id.optional(), ...categoryFields });
export const updateCategoryInput = z.strictObject({ id, ...categoryFields, archived: z.boolean() });

/** A list's new order: every id of it, first to last. */
export const reorderInput = z.strictObject({ ids: z.array(id).min(1).max(200) });

export const tagInput = z.strictObject({ name: required({ max: TAG_NAME_MAX }) });
export const updateTagInput = z.strictObject({ id, name: required({ max: TAG_NAME_MAX }) });

export const createMethodInput = z.strictObject({ name: required({ max: METHOD_MAX }) });
export const updateMethodInput = z.strictObject({ id, name: required({ max: METHOD_MAX }), archived: z.boolean() });

const ruleFields = {
	match: z.enum(RULE_MATCHES),
	pattern: required({ max: MERCHANT_MAX }),
	categoryId: id.nullable(),
	tagIds: z.array(id).max(TAGS_MAX),
	methodId: id.nullable(),
};
export const createRuleInput = z.strictObject(ruleFields);
export const updateRuleInput = z.strictObject({ id, ...ruleFields });

// Receipts (Task 89).

export const receiptUploadInput = z.strictObject({ publicId: z.string().min(1).max(300) });
export const receiptIdInput = z.strictObject({ id });
/** A receipt to fill in later: the caller's uploads. */
export const createDraftInput = z.strictObject({ receiptIds: z.array(id).min(1).max(RECEIPTS_MAX) });

// Spend (Task 93): bulk actions, saved searches, export and import.

/** Rows one bulk action or one exported selection takes: a page of the table at most. */
export const BULK_MAX = 100;
export const SAVED_SEARCH_NAME_MAX = 40;
/** Rows one CSV import takes. */
export const IMPORT_ROWS_MAX = 1_000;

export const bulkInput = z.strictObject({
	ids: z.array(id).min(1).max(BULK_MAX),
	action: z.discriminatedUnion("kind", [
		/** The caller's own category on their part; null: none. */
		z.strictObject({ kind: z.literal("category"), categoryId: id.nullable() }),
		/** Tags added to the caller's part (those it has stay). */
		z.strictObject({ kind: z.literal("tags"), tagIds: z.array(id).min(1).max(TAGS_MAX) }),
		/** The caller's own method, where they paid; null: none. */
		z.strictObject({ kind: z.literal("method"), methodId: id.nullable() }),
		/** To the trash, where the caller may delete. */
		z.strictObject({ kind: z.literal("delete") }),
	]),
});
export type BulkInput = z.infer<typeof bulkInput>;

/** A CSV of the search (`q`), or of the rows chosen (`ids`). */
export const spendExportInput = z.strictObject({
	q: z.string().trim().max(300).default(""),
	ids: z.array(id).min(1).max(BULK_MAX).optional(),
});
export type SpendExportInput = z.infer<typeof spendExportInput>;

export const savedSearchInput = z.strictObject({
	name: required({ max: SAVED_SEARCH_NAME_MAX }),
	query: required({ max: 300 }),
});
export const renameSearchInput = z.strictObject({ id, name: required({ max: SAVED_SEARCH_NAME_MAX }) });

/** One row of a CSV import, read by the import page (spend/import.ts) and checked again here. */
export const importRowSchema = z.strictObject({
	spentOn: isoDate(),
	kind: z.enum(EXPENSE_KINDS),
	amountMinor: minor,
	currency,
	title: optionalText({ max: TITLE_MAX }),
	merchant: optionalText({ max: MERCHANT_MAX }),
	notes: optionalText({ max: NOTES_MAX }),
	category: optionalText({ max: CATEGORY_NAME_MAX }),
	tags: z.array(required({ max: TAG_NAME_MAX })).max(TAGS_MAX),
	method: optionalText({ max: METHOD_MAX }),
});
export type ImportRow = z.infer<typeof importRowSchema>;

/** The rows, once per idempotency key (made with each preview on the page). */
export const importInput = z.strictObject({
	key: id,
	rows: z.array(importRowSchema).min(1).max(IMPORT_ROWS_MAX),
});
export type ImportInput = z.infer<typeof importInput>;

export type CreateCategoryInput = z.infer<typeof createCategoryInput>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryInput>;
export type UpdateMethodInput = z.infer<typeof updateMethodInput>;
export type CreateRuleInput = z.infer<typeof createRuleInput>;
export type UpdateRuleInput = z.infer<typeof updateRuleInput>;

export type CreateExpenseInput = z.infer<typeof createExpenseInput>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseInput>;
export type CreatePaymentInput = z.infer<typeof createPaymentInput>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentInput>;
export type CreateGroupInput = z.infer<typeof createGroupInput>;
export type UpdateGroupInput = z.infer<typeof updateGroupInput>;
export type AddFriendInput = z.input<typeof addFriendInput>;
export type UpdateFriendInput = z.infer<typeof updateFriendInput>;
export type FriendEmailInput = z.input<typeof friendEmailInput>;
export type PeopleInput = z.input<typeof peopleInput>;
export type InviteInput = z.input<typeof inviteInput>;
export type NewGroupMemberInput = z.infer<typeof newGroupMemberInput>;

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

/** How friends can pay the caller, in their own words (Task 91): shown to them when they settle up. */
export const PAY_NOTE_MAX = 200;

/** Settings → Profile (Task 91): the home currency, the time zone, and the pay note. */
export const profileInput = z.strictObject({
	homeCurrency: currency,
	timeZone,
	payNote: optionalText({ max: PAY_NOTE_MAX }).default(""),
});

/**
 * The settle-up dialog's options (Task 91): in a group, with a friend, or (neither) every
 * open balance of the caller's.
 */
export const settleUpInput = z.strictObject({
	groupId: id.nullable().default(null),
	personId: id.optional(),
});

export type ProfileInput = z.input<typeof profileInput>;
export type SettleUpInput = z.input<typeof settleUpInput>;

/** A thread from the reader's side (Task 92): `g:<group>`, `f:<person>` or `e:<expense>`. */
export const threadKeyInput = z
	.string()
	.regex(THREAD_KEY)
	.transform((key) => key as ThreadKey);

/** A new comment: plain text, with the people it mentions (the server keeps those who can read it). */
export const createCommentInput = z.strictObject({
	id: id.optional(),
	thread: threadKeyInput,
	body: required({ max: COMMENT_MAX }),
	mentions: z.array(id).max(20).default([]),
});
export const updateCommentInput = z.strictObject({
	commentId: id,
	body: required({ max: COMMENT_MAX }),
	mentions: z.array(id).max(20).default([]),
});
export const commentIdInput = z.strictObject({ commentId: id });
export const reactInput = z.strictObject({ commentId: id, emoji: z.enum(REACTIONS), on: z.boolean() });
export const threadInput = z.strictObject({ thread: threadKeyInput });
/** Mark notifications read: these, or (none named) all of the caller's. */
export const markNotificationsInput = z.strictObject({ ids: z.array(id).max(100).optional() });
/** Settings → Notifications: how each kind is emailed. */
export const notifySettingsInput = z.strictObject({
	notify: z.partialRecord(z.enum(NOTIFY_KINDS), z.enum(NOTIFY_EMAILS)),
});
export const focusInput = z.strictObject({ focus: z.boolean() });

export type CreateCommentInput = z.input<typeof createCommentInput>;
export type UpdateCommentInput = z.input<typeof updateCommentInput>;
export type ReactInput = z.input<typeof reactInput>;
export type NotifySettingsInput = z.input<typeof notifySettingsInput>;

/* Planning (Task 94, decision 0288): budgets and recurring expenses. */

/** "YYYY-MM": a monthly budget's own month. */
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** A new budget: one of the caller's categories (null: everything), a currency, a period and its amount. */
export const createBudgetInput = z.strictObject({
	categoryId: id.nullable().default(null),
	currency,
	period: z.enum(BUDGET_PERIODS),
	amountMinor: minor,
	startsOn: isoDate(),
});
/** A budget's amount and first day, at the `version` it was loaded at; what it is about stays. */
export const updateBudgetInput = z.strictObject({
	budgetId: id,
	version: z.number().int().min(1),
	amountMinor: minor,
	startsOn: isoDate(),
});
/** A monthly budget's own amount for one month; null goes back to the budget's amount. */
export const budgetMonthInput = z.strictObject({
	budgetId: id,
	month: z.string().regex(MONTH_PATTERN),
	amountMinor: minor.nullable(),
});
export const budgetIdInput = z.strictObject({ budgetId: id });

const cadence = {
	unit: z.enum(RECURRING_UNITS),
	every: z.number().int().min(1).max(RECURRING_EVERY_MAX).default(1),
	endsOn: isoDate().nullable().default(null),
};
/** "Repeat…" on an expense: how often from its day, and until when. */
export const repeatExpenseInput = z.strictObject({ expenseId: id, ...cadence });
/** A recurring expense's cadence and end, at its `version`; what it makes is the expense it came from. */
export const updateRecurringInput = z.strictObject({
	recurringId: id,
	version: z.number().int().min(1),
	...cadence,
});
export const recurringIdInput = z.strictObject({ recurringId: id });
export const pauseRecurringInput = z.strictObject({ recurringId: id, paused: z.boolean() });

export type CreateBudgetInput = z.input<typeof createBudgetInput>;
export type UpdateBudgetInput = z.input<typeof updateBudgetInput>;
export type BudgetMonthInput = z.input<typeof budgetMonthInput>;
export type RepeatExpenseInput = z.input<typeof repeatExpenseInput>;
export type UpdateRecurringInput = z.input<typeof updateRecurringInput>;
