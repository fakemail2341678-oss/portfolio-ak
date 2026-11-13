import type { ImageAsset } from "@/features/attachments/schema";
import type { IsoDate, IsoMonth } from "@/lib/i18n/date-only";
import type { BudgetPeriod, BudgetState } from "./budgets/period";
import type { Transfer } from "./money/simplify";
import type { Paid, Split, SplitMethod } from "./money/split";
import type { NotificationData, NotifyEmail, NotifyKind, NotifyTarget, Reaction, ThreadKey } from "./notifications";
import type { RecurringUnit } from "./recurring/cadence";

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

/** A category's icon, stored by name (`kh_category.icon`, Task 89); the kit draws each (`CategoryIcon`). */
export const CATEGORY_ICONS = [
	"utensils",
	"coffee",
	"shopping-basket",
	"shopping-bag",
	"bus",
	"car",
	"fuel",
	"plane",
	"house",
	"zap",
	"wifi",
	"smartphone",
	"film",
	"heart-pulse",
	"shirt",
	"gift",
	"graduation-cap",
	"receipt",
] as const;
export type CategoryIconName = (typeof CATEGORY_ICONS)[number];

/** How a merchant rule matches an expense's merchant, in any case (Settings → Rules, Task 89). */
export const RULE_MATCHES = ["contains", "equals"] as const;
export type RuleMatch = (typeof RULE_MATCHES)[number];

/** What an expense still needs from its owner (PLAN 14.5, "Fix badges"). */
export const FIX_KINDS = ["uncategorized", "duplicate", "receipt"] as const;
export type FixKind = (typeof FIX_KINDS)[number];

export const GROUP_ROLES = ["owner", "member"] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

/** A refund is its own kind: money that came back, counted as negative spending. */
export const EXPENSE_KINDS = ["expense", "refund"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

/** How long a deleted expense or payment can be restored; the daily job purges it after (Task 92). */
export const TRASH_DAYS = 30;

/** What someone came for, asked at onboarding (Task 88): their own spending, or splitting with people. Home shows it first. */
export const KHARCHA_STARTS = ["track", "split"] as const;
export type KharchaStart = (typeof KHARCHA_STARTS)[number];

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
	start: KharchaStart;
	/** How each kind of notification is emailed (Task 92): their choice, else the default. */
	notify: Record<NotifyKind, NotifyEmail>;
	/** Focus mode (Task 92): People shows only unread and unsettled conversations. */
	focus: boolean;
};

/** The caller in Kharcha: their person, their preferences, today in their time zone and the limits that apply. */
export type KharchaMe = {
	person: KharchaPerson;
	profile: KharchaProfile;
	today: IsoDate;
	/** The currencies the admin offers. */
	currencies: string[];
	/** How many receipts one expense may have (a guest's limit is smaller). */
	receiptsMax: number;
	/** Bumped by every change that touches the caller: open pages poll it and refetch (PLAN 14.5 "Freshness"). */
	rev: number;
	isGuest: boolean;
	/** The caller's saved searches, in their order (Task 93): Spend lists them after the built-in ones. */
	searches: SavedSearch[];
};

/** What the caller owes and is owed in all, per currency. */
export type KharchaBalances = { owed: Amount[]; owe: Amount[] };

/**
 * One line of Home's "Recent": an activity row the caller may see, in words. `actor` and
 * `subject` are people as the caller names them (null once gone, or Kharcha itself);
 * `title` is what it was about (an expense's title, a group's name).
 */
export type HomeActivity = {
	id: string;
	kind: ActivityKind;
	at: string;
	actor: KharchaPerson | null;
	subject: KharchaPerson | null;
	title: string;
	/** The group it happened in, by name. */
	group: string | null;
	/** A payment: who paid whom, and how much. */
	payment: { from: KharchaPerson | null; to: KharchaPerson | null; amount: Amount } | null;
};

/**
 * One of Home's to-dos (PLAN 14.5 "UX"): a receipt that needs its details, a possible
 * duplicate to look at, or a friend the caller owes (Task 91: what they owe them in all,
 * per currency). Later tasks add budgets and recurring expenses.
 */
export type HomeTodo =
	| { kind: "receipt"; draft: ReceiptDraftView }
	| { kind: "duplicate"; expense: SpendRow; of: { id: string; title: string; spentOn: IsoDate } }
	| { kind: "settle"; person: KharchaPerson; owe: Amount[] }
	/** Task 94: a budget at 80% of its period or over it, and a recurring expense made tomorrow. */
	| { kind: "budget"; budget: BudgetView }
	| { kind: "recurring"; recurring: RecurringView };

/**
 * Home (PLAN 14.5 "UX"): the caller's to-dos (each later task adds its kinds: debts to
 * settle, budgets, recurring), their totals, this month's spending against last month's
 * (their share, per currency), and recent activity.
 */
export type KharchaHome = {
	todos: HomeTodo[];
	balances: KharchaBalances;
	/** How many friends and groups the open balances are spread over. */
	openWith: number;
	/** "YYYY-MM" in the caller's time zone, and what they spent in it and the month before (their share). */
	month: {
		current: IsoMonth;
		previous: IsoMonth;
		spent: Array<{ currency: string; current: number; previous: number }>;
	};
	recent: HomeActivity[];
	/** Task 92: the newest notifications (Updates), and how many are unread in all. */
	updates: NotificationView[];
	unread: number;
	/** Task 94: the caller's budgets and how each stands this period. */
	budgets: BudgetView[];
};

/** What the shell polls (PLAN 14.5 "Freshness"): the caller's `rev`, and their unread notifications for the bell. */
export type KharchaPulse = { rev: number; unread: number };

/** A notification as Home's Updates show it (Task 92): what happened, in words from `data`, and where it points. */
export type NotificationView = {
	id: string;
	kind: NotifyKind;
	/** A thread, or a budget (Task 94: `b:<budget>`, Insights' budgets). */
	thread: NotifyTarget;
	data: NotificationData;
	at: string;
	read: boolean;
};

/** A comment in a thread (Task 92): plain text with the people it mentions, reactions, and what the caller may do. */
export type CommentView = {
	id: string;
	/** Null once the author is gone. */
	author: KharchaPerson | null;
	body: string;
	/** The people it mentions, each by the handle written after "@" (their own name, the same for every reader). */
	mentions: MentionHandle[];
	createdAt: string;
	editedAt: string | null;
	reactions: Array<{ emoji: Reaction; count: number; mine: boolean }>;
	can: { edit: boolean; delete: boolean; react: boolean };
};

/** A thread's place in the list (Task 92): lines from others since the caller last read it, and when it last moved. */
export type ThreadState = { unread: number; latestAt: string | null };

/** Someone a comment can mention: "@" and their own name, which every reader sees the same. */
export type MentionHandle = { id: string; handle: string };

/**
 * A thread's conversation (Task 92): its key, whether the caller can write in it, who a
 * comment can mention (everyone in it with an account, the caller aside), and how many
 * lines from others came since the caller last read it.
 */
export type ThreadTalk = {
	thread: ThreadKey;
	canComment: boolean;
	mentionable: Array<KharchaPerson & { handle: string }>;
	unread: number;
};

export type ExpenseCan = { edit: boolean; delete: boolean; restore: boolean };

/** A category as an expense shows it: the caller's own. */
export type CategoryChip = { id: string; name: string; icon: CategoryIconName; color: KharchaColor };

/** The caller's own part of an expense: their category and tags, how they paid, a dismissed duplicate. */
export type ExpenseMine = {
	categoryId: string | null;
	tagIds: string[];
	methodId: string | null;
	duplicateOk: boolean;
};

/** An expense it may duplicate: the same amount and currency, within a day, a similar merchant. */
export type DuplicateRef = { id: string; title: string; spentOn: IsoDate };

export type ExpenseView = {
	id: string;
	/** Task 94: the recurring expense that made it or that it started, and whether it is the caller's own. */
	recurring?: { id: string; mine: boolean } | null;
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
	/** The caller's own part (Task 89), and those lists' names as they show on it. */
	mine: ExpenseMine;
	category: CategoryChip | null;
	tags: Array<{ id: string; name: string }>;
	method: { id: string; name: string } | null;
	/** Its receipts: images and PDFs, in order. */
	receipts: ImageAsset[];
	fixes: FixKind[];
	/** Expenses it may duplicate (none once the caller said it isn't one). */
	duplicates: DuplicateRef[];
};

/** One line of an expense's history: who did what, an edit as "field: from → to". */
export type ExpenseActivityLine = {
	id: string;
	kind: ActivityKind;
	at: string;
	actor: KharchaPerson | null;
	data: ActivityData;
};

/** The expense page and panel: the expense and its history. */
export type ExpenseDetail = ExpenseView & {
	activity: ExpenseActivityLine[];
	/** Task 92: its comments, oldest first, and its conversation. */
	comments: CommentView[];
	talk: ThreadTalk;
};

/** A row of Spend (Task 89): an expense the caller is on, with their share and their own category. */
export type SpendRow = Pick<
	ExpenseView,
	| "id"
	| "groupId"
	| "kind"
	| "title"
	| "merchant"
	| "amountMinor"
	| "currency"
	| "spentOn"
	| "payers"
	| "people"
	| "myShareMinor"
	| "myPaidMinor"
	| "category"
	| "fixes"
> & { receipts: number };

/** One line of Spend (Task 93): the caller's share of an expense, or a payment they made or got (`type:payment`). */
export type SpendItem = ({ source: "expense" } & SpendRow) | ({ source: "payment" } & ThreadPayment);

/**
 * A page of Spend, and what the caller spent across every page of it, per currency (their
 * share; refunds against it; payments are not spending and aren't counted).
 */
export type SpendPage = { items: SpendItem[]; total: number; page: number; pageCount: number; totals: Amount[] };

/** One bar, slice or point of Spend's chart: a category, a merchant, a day… with the caller's spending there. */
export type SpendBucket = {
	/** A list's id, a name, or the first day of a period (`2026-11-01`, `2026-11`, `2026`); "" is "none" (uncategorized, no tag…). */
	key: string;
	/** The name, when the key isn't one (a category's, a group's, a person's). */
	label: string;
	amountMinor: number;
};

/** Spend's chart (Task 93): per currency, the caller's spending summed by what it groups by. */
export type SpendChart = { currencies: Array<{ currency: string; total: number; buckets: SpendBucket[] }> };

/** One line of Spend's CSV (Task 93): the total and the caller's share, with their own names for things. */
export type SpendExportRow = {
	spentOn: IsoDate;
	kind: ExpenseKind;
	title: string;
	merchant: string;
	category: string;
	tags: string[];
	method: string;
	currency: string;
	amountMinor: number;
	shareMinor: number;
	group: string;
	paidBy: string[];
	notes: string;
};

/** A saved search (Task 93): a name for a query in the search language, the caller's own. */
export type SavedSearch = { id: string; name: string; query: string };

/** What a bulk action did: the rows it changed, and those it left (not the caller's to change, or already so). */
export type BulkResult = { changed: number; skipped: number };

/** What an import made; `replayed` when the key had been used for these rows already. */
export type ImportResult = { inserted: number; categories: number; tags: number; methods: number; replayed: boolean };

/** A receipt uploaded before its details (Home's to-do). */
export type ReceiptDraftView = { id: string; createdAt: string; receipts: ImageAsset[] };

export type CategoryView = CategoryChip & {
	/** The built-in it started as; null for one of the caller's own. */
	key: string | null;
	position: number;
	archived: boolean;
	/** How many of the caller's shares carry it. */
	used: number;
};
export type TagView = { id: string; name: string; used: number };
export type MethodView = { id: string; name: string; position: number; archived: boolean; used: number };
export type RuleView = {
	id: string;
	match: RuleMatch;
	pattern: string;
	categoryId: string | null;
	tagIds: string[];
	methodId: string | null;
	position: number;
};

/** The caller's own lists (Settings, and the expense dialog's pickers). */
export type KharchaLists = { categories: CategoryView[]; tags: TagView[]; methods: MethodView[]; rules: RuleView[] };

/** A merchant from the caller's history, newest first, with the category they last gave it. */
export type MerchantSuggestion = { merchant: string; categoryId: string | null; uses: number };

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
	/** Whether the caller can invite them: they have an address and no account yet (Task 90). */
	canInvite: boolean;
	/** Whether the caller may add an address: a contact of theirs with a name only. */
	canAddEmail: boolean;
	/** The caller's latest invite to them that is still open. */
	invite: { sentAt: string | null; expiresAt: string } | null;
};

/** A link made for a friend (Task 90): to copy, and emailed when asked (`sent`; at most once a day per address). */
export type InviteResult = { url: string; expiresAt: string; sent: boolean };

export const INVITE_STATUSES = ["open", "accepted", "expired"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

/** What `/join/$token` shows anyone holding the link: who sent it, from which group, and whether it is still open. */
export type JoinInvite = {
	inviter: { name: string; color: KharchaColor };
	group: { name: string; color: KharchaColor; icon: GroupIcon } | null;
	status: InviteStatus;
	expiresAt: string;
};

/** Where joining took the caller: the group the invite came from, else the thread with whoever sent it. */
export type JoinedInvite = { groupId: string | null; inviterId: string };

/** `/people` (Task 90): the caller's friends and groups, each with what is open with it, matching `q`. */
export type PeoplePage = {
	friends: FriendView[];
	groups: GroupSummary[];
	/** Friends the caller hid: listed only with `hidden`. */
	hiddenCount: number;
	/** Task 92: each listed thread's unread lines and last move, by key (`g:<group>`, `f:<person>`). */
	threads: Record<string, ThreadState>;
	/** Focus mode is on: only unread and unsettled conversations are listed. */
	focus: boolean;
	/** The conversations focus mode leaves out. */
	focusHidden: number;
};

/** A payment as a thread's card shows it. */
export type ThreadPayment = Pick<
	PaymentView,
	"id" | "groupId" | "fromId" | "toId" | "amountMinor" | "currency" | "paid" | "method" | "note" | "paidOn" | "people"
>;

/**
 * One line of a thread (Task 90, PLAN 14.5 "Conversations"): an expense's or a payment's
 * card, or a system line ("Asha changed the amount of Momo"). `day` is the date in the margin
 * (an expense's own, or the day a line was written in the caller's time zone); lines run in
 * that order, then by when they were written.
 */
export type ThreadItem =
	| { type: "expense"; id: string; day: IsoDate; at: string; expense: SpendRow }
	| { type: "payment"; id: string; day: IsoDate; at: string; payment: ThreadPayment }
	| { type: "system"; id: string; day: IsoDate; at: string; line: HomeActivity }
	| { type: "comment"; id: string; day: IsoDate; at: string; comment: CommentView };

/** A group's thread: the group, its lines (the newest `THREAD_LIMIT`), and whether older ones were left out. */
export type GroupThread = { group: GroupView; items: ThreadItem[]; more: boolean; talk: ThreadTalk };

/** What the caller and a friend have in one group: a link to it with the balance between the two there. */
export type FriendGroupBalance = Pick<GroupSummary, "id" | "name" | "color" | "icon" | "left"> & {
	balances: Amount[];
};

/**
 * Whether the caller can remind a friend of what they owe (Task 91): `available` when
 * reminders are on, the caller isn't a guest or blocked, the friend has an address and owes
 * them; `lastAt` is the caller's latest reminder to them (one a day).
 */
export type RemindState = { available: boolean; lastAt: string | null };

/** A friend's thread: what is between the two outside groups, and their balance in each group they share. */
export type FriendThread = {
	friend: FriendView;
	items: ThreadItem[];
	more: boolean;
	groups: FriendGroupBalance[];
	remind: RemindState;
	/** How the friend asked to be paid (their profile's pay note); empty when they wrote none. */
	payNote: string;
	talk: ThreadTalk;
};

/** A reminder sent (Task 91): when, so the button can say "reminded today". */
export type RemindResult = { remindedAt: string };

/**
 * One way to settle up (Task 91): an open debt, as the payment that would clear it. In a
 * group it is one of the group's suggestions (simplified, or who owes whom); outside groups
 * the balance between two friends there.
 */
export type SettleChoice = {
	groupId: string | null;
	/** The group's name; null outside groups. */
	group: string | null;
	fromId: string;
	toId: string;
	amountMinor: number;
	currency: string;
};

/**
 * The settle-up dialog's options (Task 91): the open debts to pick from (the caller's
 * first), who can be chosen as payer and recipient (`pickable`: a group's current members,
 * or the caller and their friends), and how each person asked to be paid.
 */
export type SettleUp = {
	group: { id: string; name: string; currency: string } | null;
	choices: SettleChoice[];
	/** Everyone the choices and the pickers name. */
	people: KharchaPerson[];
	pickable: string[];
	/** Pay notes by person id, only those who wrote one. */
	payNotes: Record<string, string>;
};

/**
 * A group's Totals tab (Task 91), per currency: what the group spent (its expenses less its
 * refunds), each member's part (what they paid, their share), and the caller's own share by
 * their own category (categories are private: decision 0285). A former member's stop when they left.
 */
export type GroupTotals = {
	currencies: Array<{
		currency: string;
		spentMinor: number;
		members: Array<{ personId: string; paidMinor: number; shareMinor: number }>;
		/** The caller's share by category; `category` null: uncategorized. */
		mine: Array<{ category: CategoryChip | null; shareMinor: number }>;
	}>;
	people: KharchaPerson[];
};

/** Lines a thread loads (Task 92 pages back through older ones). */
export const THREAD_LIMIT = 200;

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
	/**
	 * Every member's net per currency (above zero: they are owed), and how to settle: the
	 * fewest payments when `simplify` is on, else who owes whom, pair by pair (Task 91).
	 */
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
	/** Someone joined Kharcha by an invite or their address (Task 90): the actor is who joined. */
	"friend.joined",
	/** The actor reminded the subject of what they owe (Task 91), by email. */
	"friend.reminded",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export type ActivityValue = string | number | boolean | null;
/**
 * `{ field, from, to }` for an edit (who paid and the split change as a whole: `field`
 * alone), a title for the rest. Never a person's id: who it was done to is the row's subject.
 */
export type ActivityData = { field?: string; from?: ActivityValue; to?: ActivityValue; title?: string };

/** Spend's chart: the bucket the smaller ones of a list are summed into. */
export const SPEND_OTHER_BUCKET = "*other";

/* Planning (Task 94, decision 0288): budgets, recurring expenses and insights. */

/** A budget as the caller sees it, with how it stands in the period holding today. */
export type BudgetView = {
	id: string;
	/** Null: everything they spend in the currency. */
	category: CategoryChip | null;
	currency: string;
	period: BudgetPeriod;
	/** The amount of every period without one of its own. */
	amountMinor: number;
	startsOn: IsoDate;
	version: number;
	/** A monthly budget's own amounts, by month. */
	months: Array<{ month: IsoMonth; amountMinor: number }>;
	/** The period holding today: its days, its amount, what was spent, how it stands. */
	current: BudgetPeriodView;
	/** The periods before it, newest first (up to six, from the budget's first). */
	history: BudgetPeriodView[];
};

export type BudgetPeriodView = {
	start: IsoDate;
	end: IsoDate;
	amountMinor: number;
	spentMinor: number;
	state: BudgetState;
	percent: number;
};

/** What a recurring expense makes: an expense, its people and split, and the owner's own category, method and tags. */
export type RecurringTemplate = {
	kind: ExpenseKind;
	title: string;
	merchant: string;
	notes: string;
	amountMinor: number;
	currency: string;
	payers: Paid[];
	split: Split;
	categoryId: string | null;
	methodId: string | null;
	tagIds: string[];
};

/** Why the daily job paused a recurring expense: it couldn't make it. */
export const RECURRING_PROBLEMS = ["group", "people", "quota", "currency", "split"] as const;
export type RecurringProblem = (typeof RECURRING_PROBLEMS)[number];

export type RecurringView = {
	id: string;
	kind: ExpenseKind;
	title: string;
	merchant: string;
	amountMinor: number;
	currency: string;
	/** The owner's share of each one it makes. */
	myShareMinor: number;
	group: { id: string; name: string } | null;
	/** The people on it besides the owner. */
	people: KharchaPerson[];
	category: CategoryChip | null;
	unit: RecurringUnit;
	every: number;
	startsOn: IsoDate;
	nextOn: IsoDate;
	endsOn: IsoDate | null;
	/** Past its end date: nothing more to make. */
	ended: boolean;
	paused: boolean;
	problem: RecurringProblem | null;
	lastMadeOn: IsoDate | null;
	/** How many expenses it has made. */
	made: number;
	version: number;
};

/** Insights' overview (`/insights/overview`): one month of the caller's spending in one currency. */
export type InsightsOverview = {
	month: IsoMonth;
	previous: IsoMonth;
	/** The currencies the caller spent in over the two months, and the one shown. */
	currencies: string[];
	currency: string;
	total: number;
	previousTotal: number;
	/** By their own category ("" is uncategorized), this month and last. */
	byCategory: Array<SpendBucket & { color: KharchaColor | null; previousMinor: number }>;
	/** The month's top merchants (the title when there is no merchant). */
	merchants: SpendBucket[];
	/** Every day of the month, with what was spent. */
	days: Array<{ day: IsoDate; amountMinor: number }>;
};

/** One line of a trend: a value per month, oldest first. */
export type TrendSeries = { key: string; label: string; color: KharchaColor | null; values: number[] };

/** Insights' trends (`/insights/trends`): twelve months to `month`, in one currency. */
export type InsightsTrends = {
	months: IsoMonth[];
	currencies: string[];
	currency: string;
	totals: number[];
	byCategory: TrendSeries[];
	byTag: TrendSeries[];
	/** Shared spending: the caller's share by group, and outside groups by friend. */
	shared: TrendSeries[];
};

/** One expense on a statement: the caller's share, with their own category. */
export type StatementLine = {
	id: string;
	spentOn: IsoDate;
	kind: ExpenseKind;
	title: string;
	merchant: string;
	category: CategoryChip | null;
	group: string | null;
	amountMinor: number;
	myShareMinor: number;
};

/** Insights' statement (`/insights/statement`): a range of days, per currency. */
export type InsightsStatement = {
	from: IsoDate;
	to: IsoDate;
	currencies: Array<{
		currency: string;
		/** Expenses, refunds, and the two together (the caller's share). */
		spent: number;
		refunds: number;
		net: number;
		count: number;
		byCategory: SpendBucket[];
		lines: StatementLine[];
	}>;
	/** More expenses than a statement lists (`STATEMENT_MAX`): the totals still count them all. */
	truncated: boolean;
};
