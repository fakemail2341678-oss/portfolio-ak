import type {
	ExpenseView,
	FriendView,
	GroupSummary,
	GroupView,
	KharchaBalances,
	KharchaMe,
	KharchaPerson,
	PaymentView,
} from "../../src/features/kharcha/types";

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
	profile: { homeCurrency: "NPR", timeZone: "Asia/Kathmandu", defaultSplit: "equal", payNote: "", onboarded: true },
	today: "2026-11-12",
	currencies: ["NPR", "INR", "USD"],
	rev: 1,
	isGuest: false,
};

export const sampleKharchaBalances: KharchaBalances = {
	owed: [{ currency: "NPR", amountMinor: 186_667 }],
	owe: [{ currency: "USD", amountMinor: 1_250 }],
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
