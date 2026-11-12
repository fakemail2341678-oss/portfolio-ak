import type { IsoDate } from "@/lib/i18n/date-only";
import type { Transfer } from "./money/simplify";
import type { Split, SplitMethod } from "./money/split";

/**
 * Kharcha's shared types (docs/guides/kharcha.md, PLAN 14.5): what the server returns and
 * the browser shows. Amounts are integer minor units of their own currency everywhere, and
 * totals are per currency: nothing is converted (decision 0278).
 */

/**
 * Colours of people and groups, stored by name so the values can be retuned without
 * touching rows. The CSS values come with the kit (Task 87).
 */
export const KHARCHA_COLORS = [
	"gray",
	"red",
	"orange",
	"amber",
	"green",
	"teal",
	"blue",
	"indigo",
	"violet",
	"pink",
] as const;
export type KharchaColor = (typeof KHARCHA_COLORS)[number];

export const GROUP_KINDS = ["trip", "home", "couple", "event", "other"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

/** A group's icon, stored by name. Each kind starts with its own. */
export const GROUP_ICONS = ["users", "plane", "house", "heart", "party-popper", "utensils", "car", "gift"] as const;
export type GroupIcon = (typeof GROUP_ICONS)[number];
export const GROUP_KIND_ICON: Readonly<Record<GroupKind, GroupIcon>> = {
	trip: "plane",
	home: "house",
	couple: "heart",
	event: "party-popper",
	other: "users",
};

export const GROUP_ROLES = ["owner", "member"] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

/** A refund is its own kind: money that came back, counted as negative spending. */
export const EXPENSE_KINDS = ["expense", "refund"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

/** How long a deleted expense or payment can be restored; the daily job purges it after (Task 92). */
export const TRASH_DAYS = 30;

/** A group's own settings (`kh_group.settings`): only what was changed is stored. */
export type GroupSettings = { defaultSplit?: SplitMethod; simplify?: boolean };

/** An amount in one currency, in its minor units. */
export type Amount = { currency: string; amountMinor: number };

/**
 * Someone money can be owed to or by (decision 0277): the caller, a friend with an account,
 * or a contact somebody added. `name` is the caller's nickname for them when they set one.
 */
export type KharchaPerson = {
	id: string;
	name: string;
	color: KharchaColor;
	isMe: boolean;
	/** Whether they have an account (a contact without one sees nothing and gets no notifications). */
	hasAccount: boolean;
};

export type KharchaProfile = {
	homeCurrency: string;
	timeZone: string;
	defaultSplit: SplitMethod;
	/** How friends can pay the caller, in their own words ("eSewa 98…"). */
	payNote: string;
	onboarded: boolean;
};

/** The caller in Kharcha: their person, their preferences, today in their time zone and the limits that apply. */
export type KharchaMe = {
	person: KharchaPerson;
	profile: KharchaProfile;
	today: IsoDate;
	/** The currencies the admin offers. */
	currencies: string[];
	/** Bumped by every change that touches the caller: open pages poll it and refetch (PLAN 14.5 "Freshness"). */
	rev: number;
	isGuest: boolean;
};

/** What the caller owes and is owed in all, per currency. */
export type KharchaBalances = { owed: Amount[]; owe: Amount[] };

export type ExpenseCan = { edit: boolean; delete: boolean; restore: boolean };

export type ExpenseView = {
	id: string;
	groupId: string | null;
	kind: ExpenseKind;
	title: string;
	merchant: string;
	notes: string;
	amountMinor: number;
	currency: string;
	spentOn: IsoDate;
	split: Split;
	payers: Array<{ personId: string; amountMinor: number }>;
	shares: Array<{ personId: string; owedMinor: number }>;
	/** Everyone the expense names, the caller included. */
	people: KharchaPerson[];
	createdBy: string;
	/** The caller's part of it: what they owe of it, and what they paid. */
	myShareMinor: number;
	myPaidMinor: number;
	version: number;
	/** Set while it is in the trash (30 days). */
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
	can: ExpenseCan;
};

export type PaymentView = {
	id: string;
	groupId: string | null;
	fromId: string;
	toId: string;
	amountMinor: number;
	currency: string;
	/** What was really handed over when it was another currency, at the rate the payer typed. */
	paid: { currency: string; amountMinor: number; rate: string } | null;
	method: string;
	note: string;
	paidOn: IsoDate;
	people: KharchaPerson[];
	createdBy: string;
	version: number;
	deletedAt: string | null;
	createdAt: string;
	can: ExpenseCan;
};

export type FriendView = {
	person: KharchaPerson;
	/** The caller's own name for them; empty when none. */
	nickname: string;
	hidden: boolean;
	/** The address they were added by, shown only to whoever added the contact. */
	email: string | null;
	/** What they owe the caller per currency (below zero: what the caller owes them). */
	balances: Amount[];
};

export type GroupMemberView = {
	person: KharchaPerson;
	role: GroupRole;
	joinedAt: string;
	/** Set once they left or were removed: they keep the history, read only. */
	leftAt: string | null;
};

export type GroupSummary = {
	id: string;
	name: string;
	kind: GroupKind;
	color: KharchaColor;
	icon: GroupIcon;
	currency: string;
	archived: boolean;
	/** The caller left it or was removed: its history up to then, read only. */
	left: boolean;
	/** Current members. */
	members: number;
	/** The caller's net in the group per currency (above zero: they are owed). */
	balances: Amount[];
};

export type GroupCan = {
	/** Add and change expenses and payments, add members, change the details. */
	edit: boolean;
	/** Remove members and archive: the owner's. */
	manage: boolean;
};

export type GroupView = Omit<GroupSummary, "members"> & {
	startOn: IsoDate | null;
	endOn: IsoDate | null;
	settings: Required<GroupSettings>;
	version: number;
	members: GroupMemberView[];
	/** Every member's net per currency (above zero: they are owed), and how to settle when `simplify` is on. */
	nets: Array<{ currency: string; people: Array<{ personId: string; netMinor: number }>; suggested: Transfer[] }>;
	can: GroupCan;
};

/** One line of history: who did what to an expense, a payment or a group. */
export const ACTIVITY_KINDS = [
	"expense.created",
	"expense.updated",
	"expense.deleted",
	"expense.restored",
	"payment.created",
	"payment.updated",
	"payment.deleted",
	"payment.restored",
	"group.created",
	"group.updated",
	"group.archived",
	"group.unarchived",
	"member.added",
	"member.removed",
	"member.left",
	"friend.added",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export type ActivityValue = string | number | boolean | null;
/**
 * `{ field, from, to }` for an edit (who paid and the split change as a whole: `field`
 * alone), a title for the rest. Never a person's id: who it was done to is the row's subject.
 */
export type ActivityData = { field?: string; from?: ActivityValue; to?: ActivityValue; title?: string };
