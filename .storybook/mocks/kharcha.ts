import type { ImageAsset } from "../../src/features/attachments/schema";
import { NOTIFY_DEFAULTS, type ThreadKey } from "../../src/features/kharcha/notifications";
import type {
	CommentView,
	ExpenseDetail,
	ExpenseView,
	FriendThread,
	FriendView,
	GroupSummary,
	GroupThread,
	GroupTotals,
	GroupView,
	JoinInvite,
	KharchaBalances,
	KharchaHome,
	KharchaLists,
	KharchaMe,
	KharchaPerson,
	MerchantSuggestion,
	PaymentView,
	PeoplePage,
	ReceiptDraftView,
	SettleUp,
	SpendChart,
	SpendPage,
	SpendRow,
} from "../../src/features/kharcha/types";
import type { Session } from "../../src/lib/session";

/**
 * Kharcha's sample data for stories (the functions' stand-ins in ./functions/kharcha). Amounts
 * are minor units of NPR. Task 87's kit and Task 88's pages build their stories on it.
 */

const person = (id: string, name: string, color: KharchaPerson["color"], isMe = false): KharchaPerson => ({
	id,
	name,
	color,
	isMe,
	hasAccount: true,
});

export const kharchaPeople = {
	me: person("p-me", "Maya", "teal", true),
	asha: person("p-asha", "Asha", "violet"),
	bikash: person("p-bikash", "Bikash", "indigo"),
} as const;

const { me, asha, bikash } = kharchaPeople;

export const sampleKharchaMe: KharchaMe = {
	person: me,
	profile: {
		homeCurrency: "NPR",
		timeZone: "Asia/Kathmandu",
		defaultSplit: "equal",
		payNote: "",
		onboarded: true,
		start: "split",
		notify: { ...NOTIFY_DEFAULTS },
		focus: false,
	},
	today: "2026-11-12",
	currencies: ["NPR", "INR", "USD"],
	receiptsMax: 10,
	rev: 1,
	isGuest: false,
	searches: [
		{ id: "s-trip-food", name: "Trip food", query: 'group:"Pokhara trip" category:food' },
		{ id: "s-big", name: "Over 1,000", query: "amount>1000" },
	],
};

/** Sessions for the shell and Home stories: an account, and a guest trying it. */
export const sampleKharchaSession: Session = {
	user: { id: "maya-1", email: "maya@example.com", name: "Maya Shrestha", role: "user", twoFactorEnabled: false },
	permissions: [],
};
export const sampleKharchaGuest: Session = {
	user: { id: "guest-1", email: "guest-1@anonymous.invalid", name: "Guest", role: "user", twoFactorEnabled: false },
	permissions: [],
	isAnonymous: true,
};

export const sampleKharchaBalances: KharchaBalances = {
	owed: [{ currency: "NPR", amountMinor: 186_667 }],
	owe: [{ currency: "USD", amountMinor: 1_250 }],
};

export const sampleKharchaHome: KharchaHome = {
	todos: [],
	budgets: [],
	balances: sampleKharchaBalances,
	openWith: 2,
	month: {
		current: "2026-11",
		previous: "2026-10",
		spent: [
			{ currency: "NPR", current: 2_364_000, previous: 2_711_000 },
			{ currency: "USD", current: 0, previous: 4_250 },
		],
	},
	recent: [
		{
			id: "a-1",
			kind: "expense.created",
			at: "2026-11-12T08:10:00.000Z",
			actor: bikash,
			subject: null,
			title: "Momo at Thamel",
			group: "Pokhara trip",
			payment: null,
		},
		{
			id: "a-2",
			kind: "payment.created",
			at: "2026-11-12T06:00:00.000Z",
			actor: asha,
			subject: null,
			title: "",
			group: null,
			payment: { from: asha, to: me, amount: { currency: "NPR", amountMinor: 60_000 } },
		},
		{
			id: "a-3",
			kind: "expense.updated",
			at: "2026-11-11T14:00:00.000Z",
			actor: me,
			subject: null,
			title: "Groceries, Bhatbhateni",
			group: null,
			payment: null,
		},
		{
			id: "a-4",
			kind: "member.added",
			at: "2026-11-10T09:00:00.000Z",
			actor: asha,
			subject: bikash,
			title: "",
			group: "Pokhara trip",
			payment: null,
		},
	],
	updates: [
		{
			id: "n-1",
			kind: "comment.mention",
			thread: "g:g-trip" as ThreadKey,
			data: {
				actor: "Asha",
				title: "Pokhara trip",
				group: "Pokhara trip",
				excerpt: "@Maya the boat was NPR 1,800 for all of us.",
			},
			at: "2026-11-12T09:30:00.000Z",
			read: false,
		},
		{
			id: "n-2",
			kind: "payment.received",
			thread: "f:p-asha" as ThreadKey,
			data: { actor: "Asha", amounts: [{ currency: "NPR", amountMinor: 60_000 }] },
			at: "2026-11-12T06:00:00.000Z",
			read: false,
		},
		{
			id: "n-3",
			kind: "expense.added",
			thread: "e:e-momo" as ThreadKey,
			data: { actor: "Bikash", title: "Momo at Thamel", group: "Pokhara trip" },
			at: "2026-11-11T08:10:00.000Z",
			read: true,
		},
	],
	unread: 2,
};

/** Who can be mentioned in the trip, from Maya's side (Task 92). */
export const sampleKharchaMentionable = [
	{ ...asha, hasAccount: true, handle: "Asha Gurung" },
	{ ...bikash, hasAccount: true, handle: "Bikash Rai" },
];

/** A comment in the trip's thread (Task 92): a mention, a link and reactions. */
export const sampleKharchaComment: CommentView = {
	id: "c-boat",
	author: asha,
	body: "@Bikash Rai the boat on Phewa was NPR 1,800 for the four of us. Photos: https://example.com/phewa.",
	mentions: [{ id: bikash.id, handle: "Bikash Rai" }],
	createdAt: "2026-10-07T10:00:00.000Z",
	editedAt: null,
	reactions: [
		{ emoji: "👍", count: 2, mine: true },
		{ emoji: "😂", count: 1, mine: false },
	],
	can: { edit: false, delete: false, react: true },
};

const can = { edit: true, delete: true, restore: false };

export const sampleKharchaExpense: ExpenseView = {
	id: "e-hotel",
	groupId: "g-trip",
	kind: "expense",
	title: "Lakeside hotel, 2 nights",
	merchant: "",
	notes: "",
	amountMinor: 900_000,
	currency: "NPR",
	spentOn: "2026-10-04",
	split: { method: "equal", people: [me.id, asha.id, bikash.id] },
	payers: [{ personId: asha.id, amountMinor: 900_000 }],
	shares: [me, asha, bikash].map((who) => ({ personId: who.id, owedMinor: 300_000 })),
	people: [asha, me, bikash],
	createdBy: asha.id,
	myShareMinor: 300_000,
	myPaidMinor: 0,
	version: 1,
	deletedAt: null,
	createdAt: "2026-10-04T08:00:00.000Z",
	updatedAt: "2026-10-04T08:00:00.000Z",
	can,
	mine: { categoryId: "c-travel", tagIds: ["t-pokhara"], methodId: null, duplicateOk: false },
	category: { id: "c-travel", name: "Travel", icon: "plane", color: "teal" },
	tags: [{ id: "t-pokhara", name: "pokhara" }],
	method: null,
	receipts: [],
	fixes: [],
	duplicates: [],
};

/** A receipt as the server describes one: an SVG stands in for Cloudinary's image (stories never call it). */
const receiptImage = (id: string, format = "jpg"): ImageAsset => {
	const svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 4"><rect width="3" height="4" fill="#efe6d2"/><path d="M.5 1h2M.5 1.6h1.6M.5 2.2h2" stroke="#8a7a5c" stroke-width=".12"/></svg>')}`;
	const image = { src: svg, srcSet: "" };
	return {
		id,
		format,
		width: 600,
		height: 800,
		alt: { en: "", ne: "" },
		full: image,
		cover: image,
		thumb: svg,
		og: svg,
		url: svg,
	};
};

/** A personal expense with a receipt: the panel's and the page's story. */
export const sampleKharchaDetail: ExpenseDetail = {
	...sampleKharchaExpense,
	id: "e-groceries",
	groupId: null,
	title: "Weekly groceries",
	merchant: "Bhatbhateni",
	notes: "Rice, lentils, vegetables",
	amountMinor: 248_050,
	spentOn: "2026-11-10",
	split: { method: "full", person: me.id },
	payers: [{ personId: me.id, amountMinor: 248_050 }],
	shares: [{ personId: me.id, owedMinor: 248_050 }],
	people: [me],
	createdBy: me.id,
	myShareMinor: 248_050,
	myPaidMinor: 248_050,
	version: 2,
	mine: { categoryId: "c-groceries", tagIds: ["t-home"], methodId: "m-esewa", duplicateOk: false },
	category: { id: "c-groceries", name: "Groceries", icon: "shopping-basket", color: "green" },
	tags: [{ id: "t-home", name: "home" }],
	method: { id: "m-esewa", name: "eSewa" },
	receipts: [receiptImage("r-1")],
	fixes: ["duplicate"],
	duplicates: [{ id: "e-groceries-2", title: "Bhatbhateni Store", spentOn: "2026-11-10" }],
	comments: [
		{
			...sampleKharchaComment,
			id: "c-rice",
			body: "Was the rice the 25 kg bag?",
			mentions: [],
			reactions: [],
			author: me,
			can: { edit: true, delete: true, react: true },
		},
	],
	talk: { thread: "e:e-groceries" as ThreadKey, canComment: true, mentionable: [], unread: 0 },
	activity: [
		{
			id: "x-1",
			kind: "expense.created",
			at: "2026-11-10T11:20:00.000Z",
			actor: me,
			data: { title: "Weekly groceries" },
		},
		{
			id: "x-2",
			kind: "expense.updated",
			at: "2026-11-11T09:05:00.000Z",
			actor: me,
			data: { field: "amountMinor", from: 238_050, to: 248_050 },
		},
		{
			id: "x-3",
			kind: "expense.updated",
			at: "2026-11-11T09:05:00.000Z",
			actor: me,
			data: { field: "category", from: null, to: "Groceries" },
		},
	],
};

export const sampleKharchaLists: KharchaLists = {
	categories: [
		{
			id: "c-food",
			key: "food",
			name: "Food and drink",
			icon: "utensils",
			color: "orange",
			position: 0,
			archived: false,
			used: 12,
		},
		{
			id: "c-groceries",
			key: "groceries",
			name: "Groceries",
			icon: "shopping-basket",
			color: "green",
			position: 1,
			archived: false,
			used: 9,
		},
		{
			id: "c-transport",
			key: "transport",
			name: "Transport",
			icon: "bus",
			color: "blue",
			position: 2,
			archived: false,
			used: 7,
		},
		{ id: "c-rent", key: "rent", name: "Rent", icon: "house", color: "indigo", position: 3, archived: false, used: 3 },
		{
			id: "c-travel",
			key: "travel",
			name: "Travel",
			icon: "plane",
			color: "teal",
			position: 4,
			archived: false,
			used: 4,
		},
		{ id: "c-pets", key: null, name: "Pets", icon: "heart-pulse", color: "pink", position: 5, archived: true, used: 1 },
	],
	tags: [
		{ id: "t-home", name: "home", used: 6 },
		{ id: "t-pokhara", name: "pokhara", used: 4 },
		{ id: "t-work", name: "work", used: 0 },
	],
	methods: [
		{ id: "m-cash", name: "Cash", position: 0, archived: false, used: 14 },
		{ id: "m-card", name: "Card", position: 1, archived: false, used: 3 },
		{ id: "m-esewa", name: "eSewa", position: 2, archived: false, used: 8 },
		{ id: "m-khalti", name: "Khalti", position: 3, archived: false, used: 0 },
	],
	rules: [
		{
			id: "r-bhat",
			match: "contains",
			pattern: "Bhatbhateni",
			categoryId: "c-groceries",
			tagIds: ["t-home"],
			methodId: "m-esewa",
			position: 0,
		},
		{
			id: "r-pathao",
			match: "equals",
			pattern: "Pathao",
			categoryId: "c-transport",
			tagIds: [],
			methodId: null,
			position: 1,
		},
	],
};

export const sampleKharchaMerchants: MerchantSuggestion[] = [
	{ merchant: "Bhatbhateni", categoryId: "c-groceries", uses: 9 },
	{ merchant: "Pathao", categoryId: "c-transport", uses: 7 },
	{ merchant: "Himalayan Java", categoryId: "c-food", uses: 5 },
];

const spendRow = (
	id: string,
	title: string,
	amountMinor: number,
	spentOn: string,
	category: ExpenseView["category"],
	extra: Partial<SpendRow> = {},
): SpendRow => ({
	id,
	groupId: null,
	kind: "expense",
	title,
	merchant: title,
	amountMinor,
	currency: "NPR",
	spentOn,
	payers: [{ personId: me.id, amountMinor }],
	people: [me],
	myShareMinor: amountMinor,
	myPaidMinor: amountMinor,
	category,
	fixes: category ? [] : ["uncategorized"],
	receipts: 0,
	...extra,
});

export const sampleKharchaSpend: SpendPage = {
	items: (
		[
			spendRow("e-groceries", "Weekly groceries", 248_050, "2026-11-10", sampleKharchaDetail.category, {
				receipts: 1,
				fixes: ["duplicate"],
			}),
			spendRow("e-groceries-2", "Bhatbhateni Store", 248_050, "2026-11-10", null, {
				fixes: ["uncategorized", "duplicate"],
			}),
			spendRow("e-ride", "Pathao", 18_500, "2026-11-09", {
				id: "c-transport",
				name: "Transport",
				icon: "bus",
				color: "blue",
			}),
			spendRow("e-coffee", "Himalayan Java", 42_000, "2026-11-08", {
				id: "c-food",
				name: "Food and drink",
				icon: "utensils",
				color: "orange",
			}),
			spendRow(
				"e-refund",
				"Daraz return",
				120_000,
				"2026-11-05",
				{ id: "c-shopping", name: "Shopping", icon: "shopping-bag", color: "pink" },
				{ kind: "refund" },
			),
		] satisfies SpendRow[]
	).map((row) => ({ source: "expense" as const, ...row })),
	total: 5,
	page: 1,
	pageCount: 1,
	totals: [{ currency: "NPR", amountMinor: 437_100 }],
};

/** Spend's chart of the same month by category (Task 93). */
export const sampleKharchaSpendChart: SpendChart = {
	currencies: [
		{
			currency: "NPR",
			total: 436_600,
			buckets: [
				{ key: "c-groceries", label: "Groceries", amountMinor: 248_050 },
				{ key: "", label: "", amountMinor: 248_050 },
				{ key: "c-food", label: "Food and drink", amountMinor: 42_000 },
				{ key: "c-transport", label: "Transport", amountMinor: 18_500 },
				{ key: "c-shopping", label: "Shopping", amountMinor: -120_000 },
			],
		},
	],
};

export const sampleKharchaDraft: ReceiptDraftView = {
	id: "d-1",
	createdAt: "2026-11-12T06:30:00.000Z",
	receipts: [receiptImage("r-draft")],
};

export const sampleKharchaPayment: PaymentView = {
	id: "pay-1",
	groupId: "g-trip",
	fromId: bikash.id,
	toId: me.id,
	amountMinor: 100_000,
	currency: "NPR",
	paid: null,
	method: "eSewa",
	note: "",
	paidOn: "2026-10-07",
	people: [bikash, me],
	createdBy: me.id,
	version: 1,
	deletedAt: null,
	createdAt: "2026-10-07T08:00:00.000Z",
	can,
};

export const sampleKharchaGroups: GroupSummary[] = [
	{
		id: "g-trip",
		name: "Pokhara trip",
		kind: "trip",
		color: "teal",
		icon: "plane",
		currency: "NPR",
		archived: false,
		left: false,
		members: 3,
		balances: [{ currency: "NPR", amountMinor: 186_667 }],
	},
];

export const sampleKharchaGroup: GroupView = {
	id: "g-trip",
	name: "Pokhara trip",
	kind: "trip",
	color: "teal",
	icon: "plane",
	currency: "NPR",
	archived: false,
	left: false,
	balances: [{ currency: "NPR", amountMinor: 186_667 }],
	startOn: "2026-10-03",
	endOn: "2026-10-06",
	settings: { defaultSplit: "equal", simplify: true },
	version: 1,
	members: [me, asha, bikash].map((who, index) => ({
		person: who,
		role: index === 0 ? "owner" : "member",
		joinedAt: "2026-10-01T08:00:00.000Z",
		leftAt: null,
	})),
	nets: [
		{
			currency: "NPR",
			people: [
				{ personId: me.id, netMinor: 186_667 },
				{ personId: asha.id, netMinor: 433_333 },
				{ personId: bikash.id, netMinor: -620_000 },
			],
			suggested: [
				{ from: bikash.id, to: asha.id, amount: 433_333 },
				{ from: bikash.id, to: me.id, amount: 186_667 },
			],
		},
	],
	can: { edit: true, manage: true },
};

const friend = (who: KharchaPerson, amountMinor: number, extra: Partial<FriendView> = {}): FriendView => ({
	person: who,
	nickname: "",
	hidden: false,
	email: null,
	balances: amountMinor === 0 ? [] : [{ currency: "NPR", amountMinor }],
	canInvite: false,
	canAddEmail: false,
	invite: null,
	...extra,
});

/** Sita has no account yet: added with her address, invited. */
const sita: KharchaPerson = { ...person("p-sita", "Sita", "pink"), hasAccount: false };

export const sampleKharchaFriends: FriendView[] = [
	friend(asha, -28_000),
	friend(bikash, 214_667),
	friend(sita, 0, {
		canInvite: true,
		invite: { sentAt: "2026-11-08T08:00:00.000Z", expiresAt: "2026-11-22T08:00:00.000Z" },
	}),
];

export const sampleKharchaPeople: PeoplePage = {
	friends: sampleKharchaFriends,
	groups: [
		...sampleKharchaGroups,
		{
			id: "g-flat",
			name: "Flat 3B",
			kind: "home",
			color: "indigo",
			icon: "house",
			currency: "NPR",
			archived: false,
			left: false,
			members: 2,
			balances: [],
		},
	],
	hiddenCount: 1,
	threads: {
		"g:g-trip": { unread: 3, latestAt: "2026-11-12T09:30:00.000Z" },
		"f:p-asha": { unread: 1, latestAt: "2026-11-12T06:00:00.000Z" },
	},
	focus: false,
	focusHidden: 0,
};

const threadRow = (id: string, title: string, amountMinor: number, spentOn: string, payer: KharchaPerson) => ({
	...spendRow(id, title, amountMinor, spentOn, {
		id: "c-food",
		name: "Food and drink",
		icon: "utensils",
		color: "orange",
	}),
	groupId: "g-trip",
	payers: [{ personId: payer.id, amountMinor }],
	people: [me, asha, bikash],
	myShareMinor: Math.round(amountMinor / 3),
	myPaidMinor: payer.id === me.id ? amountMinor : 0,
});

export const sampleKharchaGroupThread: GroupThread = {
	group: sampleKharchaGroup,
	more: false,
	items: [
		{
			type: "system",
			id: "a-created",
			day: "2026-10-01",
			at: "2026-10-01T08:00:00.000Z",
			line: {
				id: "a-created",
				kind: "group.created",
				at: "2026-10-01T08:00:00.000Z",
				actor: me,
				subject: null,
				title: "Pokhara trip",
				group: "Pokhara trip",
				payment: null,
			},
		},
		{
			type: "expense",
			id: "e-bus",
			day: "2026-10-03",
			at: "2026-10-03T08:00:00.000Z",
			expense: threadRow("e-bus", "Tourist bus", 450_000, "2026-10-03", me),
		},
		{
			type: "expense",
			id: "e-dinner",
			day: "2026-10-04",
			at: "2026-10-04T15:00:00.000Z",
			expense: threadRow("e-dinner", "Lakeside dinner", 620_000, "2026-10-04", asha),
		},
		{
			type: "payment",
			id: "pay-1",
			day: "2026-10-07",
			at: "2026-10-07T08:00:00.000Z",
			payment: {
				id: "pay-1",
				groupId: "g-trip",
				fromId: bikash.id,
				toId: me.id,
				amountMinor: 100_000,
				currency: "NPR",
				paid: null,
				method: "eSewa",
				note: "",
				paidOn: "2026-10-07",
				people: [bikash, me],
			},
		},
		{
			type: "system",
			id: "a-edit",
			day: "2026-10-07",
			at: "2026-10-07T09:00:00.000Z",
			line: {
				id: "a-edit",
				kind: "expense.updated",
				at: "2026-10-07T09:00:00.000Z",
				actor: asha,
				subject: null,
				title: "Lakeside dinner",
				group: "Pokhara trip",
				payment: null,
			},
		},
		{ type: "comment", id: "c-boat", day: "2026-10-07", at: "2026-10-07T10:00:00.000Z", comment: sampleKharchaComment },
	],
	talk: { thread: "g:g-trip" as ThreadKey, canComment: true, mentionable: sampleKharchaMentionable, unread: 0 },
};

export const sampleKharchaFriendThread: FriendThread = {
	friend: sampleKharchaFriends[0] ?? friend(asha, 0),
	more: false,
	groups: [
		{
			id: "g-trip",
			name: "Pokhara trip",
			color: "teal",
			icon: "plane",
			left: false,
			balances: [{ currency: "NPR", amountMinor: -28_000 }],
		},
	],
	items: [
		{
			type: "expense",
			id: "e-coffee-asha",
			day: "2026-11-08",
			at: "2026-11-08T08:00:00.000Z",
			expense: {
				...spendRow("e-coffee-asha", "Coffee at Himalayan Java", 84_000, "2026-11-08", null),
				people: [me, asha],
				payers: [{ personId: asha.id, amountMinor: 84_000 }],
				myShareMinor: 42_000,
				myPaidMinor: 0,
				fixes: [],
			},
		},
	],
	remind: { available: false, lastAt: null },
	payNote: "eSewa 9801234567",
	talk: {
		thread: "f:p-asha" as ThreadKey,
		canComment: true,
		mentionable: [{ ...asha, hasAccount: true, handle: "Asha Gurung" }],
		unread: 0,
	},
};

/** The settle-up dialog in the trip (Task 91): its simplified suggestions, and Asha's pay note. */
export const sampleKharchaSettleUp: SettleUp = {
	group: { id: "g-trip", name: "Pokhara trip", currency: "NPR" },
	choices: [
		{ groupId: "g-trip", group: "Pokhara trip", fromId: bikash.id, toId: me.id, amountMinor: 186_667, currency: "NPR" },
		{
			groupId: "g-trip",
			group: "Pokhara trip",
			fromId: bikash.id,
			toId: asha.id,
			amountMinor: 433_333,
			currency: "NPR",
		},
	],
	people: [me, asha, bikash],
	pickable: [me.id, asha.id, bikash.id],
	payNotes: { [asha.id]: "eSewa 9801234567" },
};

/** The trip's Totals tab (Task 91). */
export const sampleKharchaGroupTotals: GroupTotals = {
	currencies: [
		{
			currency: "NPR",
			spentMinor: 1_070_000,
			members: [
				{ personId: bikash.id, paidMinor: 0, shareMinor: 620_000 },
				{ personId: me.id, paidMinor: 450_000, shareMinor: 263_333 },
				{ personId: asha.id, paidMinor: 620_000, shareMinor: 186_667 },
			],
			mine: [
				{ category: { id: "c-travel", name: "Travel", icon: "bus", color: "blue" }, shareMinor: 150_000 },
				{ category: { id: "c-food", name: "Food and drink", icon: "utensils", color: "orange" }, shareMinor: 113_333 },
			],
		},
	],
	people: [me, asha, bikash],
};

export const sampleKharchaInvite: JoinInvite = {
	inviter: { name: "Asha Gurung", color: "violet" },
	group: { name: "Pokhara trip", color: "teal", icon: "plane" },
	status: "open",
	expiresAt: "2026-11-26T08:00:00.000Z",
};
