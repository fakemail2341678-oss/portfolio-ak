import type { ImageAsset } from "../../src/features/attachments/schema";
import type {
	ExpenseDetail,
	ExpenseView,
	FriendView,
	GroupSummary,
	GroupView,
	KharchaBalances,
	KharchaHome,
	KharchaLists,
	KharchaMe,
	KharchaPerson,
	MerchantSuggestion,
	PaymentView,
	ReceiptDraftView,
	SpendPage,
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
	},
	today: "2026-11-12",
	currencies: ["NPR", "INR", "USD"],
	receiptsMax: 10,
	rev: 1,
	isGuest: false,
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
	extra: Partial<SpendPage["items"][number]> = {},
): SpendPage["items"][number] => ({
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
	items: [
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
	],
	total: 5,
	page: 1,
	pageCount: 1,
	totals: [{ currency: "NPR", amountMinor: 437_100 }],
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

export const sampleKharchaFriends: FriendView[] = [
	{ person: asha, nickname: "", hidden: false, email: null, balances: [{ currency: "NPR", amountMinor: -28_000 }] },
	{ person: bikash, nickname: "", hidden: false, email: null, balances: [{ currency: "NPR", amountMinor: 214_667 }] },
];
