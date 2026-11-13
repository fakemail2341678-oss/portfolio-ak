import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import { expenseDebts, paymentDebt } from "@/features/kharcha/money/ledger";
import { computeShares, itemizedExtras, type Paid, type Split } from "@/features/kharcha/money/split";
import { occurrenceOn } from "@/features/kharcha/recurring/cadence";
import { type ExpenseKind, GROUP_KIND_ICON } from "@/features/kharcha/types";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import {
	khActivity,
	khBudget,
	khCategory,
	khComment,
	khExpense,
	khExpensePayer,
	khExpenseShare,
	khFriend,
	khGroup,
	khGroupMember,
	khLedger,
	khMerchantRule,
	khPayment,
	khPerson,
	khProfile,
	khReaction,
	khRecurring,
} from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import type { GuestData } from "@/server/guests/data";
import { pairOf } from "./activity";
import { forgetUsers } from "./forget";
import { seedLists } from "./lists/repository";
import { colorFor, ensurePerson, mergePerson, personOfUser } from "./people";
import { bumpRevs } from "./rev";
import { getSettings } from "./settings";

/**
 * Kharcha's guests (docs/guides/kharcha.md "Guests", decisions 0186 and 0277). A guest who
 * starts in Kharcha gets sample data in their language: three months of personal spending,
 * three placeholder friends (contacts with a name only), two groups with shared expenses
 * and one payment. Their Kharcha is a closed world: names only, no addresses, no invites.
 * Signing up or in merges the guest's person into the account's (`mergePerson`), so
 * nothing they made is lost; an expired guest's rows are removed before the guest is.
 */

type T = { locale: Locale };
type Who = "me" | "asha" | "bikash" | "sita";
type Sample = {
	group?: "trip" | "flat";
	kind?: ExpenseKind;
	title: (t: T) => string;
	merchant?: (t: T) => string;
	/** The built-in category the guest gave it (`DEFAULT_CATEGORIES`' key); none leaves a fix badge to try. */
	category?: string;
	/** Minor units of NPR (paisa). */
	amount: number;
	daysAgo: number;
	paidBy: Who;
	split: (id: Record<Who, string>, t: T) => Split;
};

const mine: Sample["split"] = (id) => ({ method: "full", person: id.me });

/** One month of the guest's own spending, `month` months back. */
const personalMonth = (month: number): Sample[] => {
	const back = month * 30;
	const own = (
		category: string | null,
		title: Sample["title"],
		amount: number,
		daysAgo: number,
		merchant?: Sample["merchant"],
	): Sample => ({
		title,
		amount,
		daysAgo: back + daysAgo,
		paidBy: "me",
		split: mine,
		...(merchant ? { merchant } : {}),
		...(category ? { category } : {}),
	});
	return [
		own(
			"groceries",
			(t) => m.kharcha_seed_groceries({}, t),
			245_000 + month * 13_000,
			2,
			(t) => m.kharcha_seed_merchant_mart({}, t),
		),
		own(
			"groceries",
			(t) => m.kharcha_seed_groceries({}, t),
			182_050,
			16,
			(t) => m.kharcha_seed_merchant_mart({}, t),
		),
		own(
			"food",
			(t) => m.kharcha_seed_lunch({}, t),
			38_000,
			1,
			(t) => m.kharcha_seed_merchant_momo({}, t),
		),
		own(
			"food",
			(t) => m.kharcha_seed_lunch({}, t),
			42_000,
			9,
			(t) => m.kharcha_seed_merchant_momo({}, t),
		),
		own("food", (t) => m.kharcha_seed_lunch({}, t), 35_000, 20),
		own("transport", (t) => m.kharcha_seed_bus({}, t), 6_000, 3),
		own("transport", (t) => m.kharcha_seed_bus({}, t), 4_500, 12),
		own("food", (t) => m.kharcha_seed_tea({}, t), 12_000, 5),
		own(month === 0 ? null : "food", (t) => m.kharcha_seed_tea({}, t), 9_500, 18),
		own(
			"phone",
			(t) => m.kharcha_seed_mobile({}, t),
			50_000,
			7,
			() => "Ncell",
		),
		own(
			"fun",
			(t) => m.kharcha_seed_movie({}, t),
			70_000,
			14,
			() => "QFX Cinemas",
		),
		...(month === 1
			? [
					{
						...own(
							"shopping",
							(t) => m.kharcha_seed_refund({}, t),
							150_000,
							10,
							(t) => m.kharcha_seed_merchant_shoes({}, t),
						),
						kind: "refund" as const,
					},
				]
			: [own("health", (t) => m.kharcha_seed_pharmacy({}, t), 64_000, 22)]),
	];
};

/** The dinner's bill: two lines, with Nepal's usual service charge and VAT on top. */
const DINNER_FOOD = 240_000;
const DINNER_DRINKS = 90_000;
const DINNER_EXTRAS = itemizedExtras(DINNER_FOOD + DINNER_DRINKS);

const SHARED: Sample[] = [
	{
		title: (t) => m.kharcha_seed_coffee({}, t),
		category: "food",
		amount: 56_000,
		daysAgo: 3,
		paidBy: "me",
		split: (id) => ({ method: "equal", people: [id.me, id.asha] }),
	},
	{
		group: "trip",
		title: (t) => m.kharcha_seed_trip_bus({}, t),
		category: "travel",
		amount: 360_000,
		daysAgo: 40,
		paidBy: "me",
		split: (id) => ({ method: "equal", people: [id.me, id.asha, id.bikash] }),
	},
	{
		group: "trip",
		title: (t) => m.kharcha_seed_trip_hotel({}, t),
		category: "travel",
		amount: 900_000,
		daysAgo: 39,
		paidBy: "asha",
		split: (id) => ({ method: "equal", people: [id.me, id.asha, id.bikash] }),
	},
	{
		group: "trip",
		title: (t) => m.kharcha_seed_trip_dinner({}, t),
		category: "food",
		amount: DINNER_FOOD + DINNER_DRINKS + DINNER_EXTRAS.service + DINNER_EXTRAS.tax,
		daysAgo: 39,
		paidBy: "bikash",
		split: (id, t) => ({
			method: "itemized",
			lines: [
				{ label: m.kharcha_seed_line_food({}, t), amount: DINNER_FOOD, people: [id.me, id.asha, id.bikash] },
				{ label: m.kharcha_seed_line_drinks({}, t), amount: DINNER_DRINKS, people: [id.asha, id.bikash] },
			],
			...DINNER_EXTRAS,
		}),
	},
	{
		group: "trip",
		title: (t) => m.kharcha_seed_trip_boat({}, t),
		category: "travel",
		amount: 150_000,
		daysAgo: 38,
		paidBy: "me",
		split: (id) => ({
			method: "shares",
			parts: [
				{ person: id.me, weight: 1 },
				{ person: id.asha, weight: 1 },
				{ person: id.bikash, weight: 2 },
			],
		}),
	},
	...[0, 1, 2].flatMap((month): Sample[] => [
		{
			group: "flat",
			title: (t) => m.kharcha_seed_flat_rent({}, t),
			category: "rent",
			amount: 2_400_000,
			daysAgo: month * 30 + 6,
			paidBy: "me",
			split: (id) => ({ method: "equal", people: [id.me, id.sita] }),
		},
		{
			group: "flat",
			title: (t) => m.kharcha_seed_flat_internet({}, t),
			category: "phone",
			merchant: () => "WorldLink",
			amount: 135_600,
			daysAgo: month * 30 + 8,
			paidBy: "sita",
			split: (id) => ({ method: "equal", people: [id.me, id.sita] }),
		},
	]),
	...[0, 1].map(
		(month): Sample => ({
			group: "flat",
			title: (t) => m.kharcha_seed_flat_electricity({}, t),
			category: "utilities",
			merchant: () => "NEA",
			amount: 218_000,
			daysAgo: month * 30 + 11,
			paidBy: "sita",
			split: (id) => ({
				method: "percent",
				parts: [
					{ person: id.me, bp: 6_000 },
					{ person: id.sita, bp: 4_000 },
				],
			}),
		}),
	),
];

/** Bikash paid part of what he owed for the trip. */
const TRIP_PAYMENT = { amount: 100_000, daysAgo: 36 };

const CURRENCY = "NPR";

/**
 * The sample data, written with a handful of bulk inserts: the shares and the debts come
 * from the money core in memory, exactly as a service would write them one by one
 * (tests/server/kharcha-seed.test.ts checks the ledger against it). Skipped when the person
 * already has friends: it never lands on top of someone's own data.
 */
export async function seedSample(tx: Tx, userId: string, locale: Locale): Promise<void> {
	const me = await ensurePerson(tx, userId);
	const [friend] = await tx
		.select({ id: khFriend.friendId })
		.from(khFriend)
		.where(eq(khFriend.ownerId, me.id))
		.limit(1);
	if (friend) return;
	const t: T = { locale };
	const today = todayInZone(APP_TIME_ZONE);
	const id: Record<Who, string> = {
		me: me.id,
		asha: crypto.randomUUID(),
		bikash: crypto.randomUUID(),
		sita: crypto.randomUUID(),
	};
	const friends = [
		{ id: id.asha, name: m.kharcha_seed_friend_asha({}, t) },
		{ id: id.bikash, name: m.kharcha_seed_friend_bikash({}, t) },
		{ id: id.sita, name: m.kharcha_seed_friend_sita({}, t) },
	];
	await tx.insert(khPerson).values(
		friends.map((person) => ({
			id: person.id,
			displayName: person.name,
			color: colorFor(person.name),
			createdBy: me.id,
		})),
	);
	await tx.insert(khFriend).values(
		friends.flatMap((person) => [
			{ ownerId: me.id, friendId: person.id },
			{ ownerId: person.id, friendId: me.id },
		]),
	);

	const groups = {
		trip: { id: crypto.randomUUID(), members: [id.asha, id.bikash] },
		flat: { id: crypto.randomUUID(), members: [id.sita] },
	};
	await tx.insert(khGroup).values([
		{
			id: groups.trip.id,
			name: m.kharcha_seed_group_trip({}, t),
			kind: "trip",
			color: "teal",
			icon: GROUP_KIND_ICON.trip,
			currency: CURRENCY,
			startOn: addDays(today, -40),
			endOn: addDays(today, -37),
			createdBy: me.id,
		},
		{
			id: groups.flat.id,
			name: m.kharcha_seed_group_flat({}, t),
			kind: "home",
			color: "amber",
			icon: GROUP_KIND_ICON.home,
			currency: CURRENCY,
			createdBy: me.id,
		},
	]);
	await tx
		.insert(khGroupMember)
		.values(
			Object.values(groups).flatMap((group) => [
				{ groupId: group.id, personId: me.id, role: "owner" as const },
				...group.members.map((personId) => ({ groupId: group.id, personId, role: "member" as const })),
			]),
		);

	// Their own lists, made now in their language (as a first visit would), and a merchant rule to try.
	await seedLists(tx, me.id, await getSettings(tx), locale);
	await tx.update(khProfile).set({ listsAt: new Date() }).where(eq(khProfile.userId, userId));
	const categories = new Map(
		(
			await tx.select({ id: khCategory.id, key: khCategory.key }).from(khCategory).where(eq(khCategory.ownerId, me.id))
		).flatMap((row) => (row.key ? [[row.key, row.id] as const] : [])),
	);
	await tx.insert(khMerchantRule).values({
		ownerId: me.id,
		match: "contains",
		pattern: m.kharcha_seed_merchant_mart({}, t),
		categoryId: categories.get("groceries") ?? null,
	});

	const expenses = [...[0, 1, 2].flatMap(personalMonth), ...SHARED].map((sample) => {
		const split = sample.split(id, t);
		const shares = computeShares(sample.amount, split);
		if (!shares.ok) throw new Error(`Kharcha sample: ${shares.problem.code}`);
		const payers: Paid[] = [{ person: id[sample.paidBy], amount: sample.amount }];
		const kind = sample.kind ?? "expense";
		const expenseId = crypto.randomUUID();
		const groupId = sample.group ? groups[sample.group].id : null;
		return {
			row: {
				id: expenseId,
				groupId,
				createdBy: me.id,
				kind,
				title: sample.title(t),
				merchant: sample.merchant?.(t) ?? "",
				amountMinor: sample.amount,
				currency: CURRENCY,
				spentOn: addDays(today, -sample.daysAgo),
				split,
			},
			payers,
			shares: shares.shares,
			category: sample.category ? (categories.get(sample.category) ?? null) : null,
			debts: expenseDebts(kind, payers, shares.shares),
			pair: groupId
				? null
				: pairOf([...payers.map((payer) => payer.person), ...shares.shares.map((share) => share.person)]),
		};
	});
	await tx.insert(khExpense).values(expenses.map((expense) => expense.row));
	await tx.insert(khExpensePayer).values(
		expenses.flatMap((expense) =>
			expense.payers.map((payer, position) => ({
				expenseId: expense.row.id,
				personId: payer.person,
				amountMinor: payer.amount,
				position,
			})),
		),
	);
	await tx.insert(khExpenseShare).values(
		expenses.flatMap((expense) =>
			expense.shares.map((share, position) => ({
				expenseId: expense.row.id,
				personId: share.person,
				owedMinor: share.owed,
				position,
				categoryId: share.person === me.id ? expense.category : null,
			})),
		),
	);

	const [payment] = await tx
		.insert(khPayment)
		.values({
			groupId: groups.trip.id,
			fromPerson: id.bikash,
			toPerson: id.me,
			amountMinor: TRIP_PAYMENT.amount,
			currency: CURRENCY,
			method: m.kharcha_seed_method_wallet({}, t),
			paidOn: addDays(today, -TRIP_PAYMENT.daysAgo),
			createdBy: me.id,
		})
		.returning({ id: khPayment.id });
	if (!payment) throw new Error("kh_payment: nothing inserted");
	const settled = paymentDebt(id.bikash, id.me, TRIP_PAYMENT.amount);

	await tx.insert(khLedger).values([
		...expenses.flatMap((expense) =>
			expense.debts.map((debt) => ({
				expenseId: expense.row.id,
				groupId: expense.row.groupId,
				debtorId: debt.debtor,
				creditorId: debt.creditor,
				amountMinor: debt.amount,
				currency: CURRENCY,
			})),
		),
		{
			paymentId: payment.id,
			groupId: groups.trip.id,
			debtorId: settled.debtor,
			creditorId: settled.creditor,
			amountMinor: settled.amount,
			currency: CURRENCY,
		},
	]);
	await tx.insert(khActivity).values([
		...Object.values(groups).map((group) => ({ groupId: group.id, actorId: me.id, kind: "group.created" as const })),
		...expenses.map((expense) => ({
			groupId: expense.row.groupId,
			personLo: expense.pair?.[0] ?? null,
			personHi: expense.pair?.[1] ?? null,
			expenseId: expense.row.id,
			actorId: me.id,
			kind: "expense.created" as const,
			data: { title: expense.row.title },
		})),
		{ groupId: groups.trip.id, paymentId: payment.id, actorId: me.id, kind: "payment.created" as const },
	]);
	// A comment in the trip from Asha (Task 92), with a mention and the guest's reaction: the trip shows unread.
	const bikash = friends[1]?.name ?? "";
	const [comment] = await tx
		.insert(khComment)
		.values({
			groupId: groups.trip.id,
			authorId: id.asha,
			body: m.kharcha_seed_comment_boat({ bikash: `@${bikash}` }, t),
			mentions: [id.bikash],
		})
		.returning({ id: khComment.id });
	if (comment) await tx.insert(khReaction).values({ commentId: comment.id, personId: me.id, emoji: "👍" });
	// Planning (Task 94): the latest rent repeats monthly, and a monthly budget on Food.
	const rentTitle = m.kharcha_seed_flat_rent({}, t);
	const rent = expenses
		.filter((expense) => expense.row.title === rentTitle)
		.sort((a, b) => b.row.spentOn.localeCompare(a.row.spentOn))[0];
	if (rent) {
		const monthly = { unit: "month" as const, every: 1 };
		const [recurring] = await tx
			.insert(khRecurring)
			.values({
				ownerId: me.id,
				groupId: rent.row.groupId,
				template: {
					kind: rent.row.kind,
					title: rent.row.title,
					merchant: rent.row.merchant,
					notes: "",
					amountMinor: rent.row.amountMinor,
					currency: CURRENCY,
					payers: rent.payers,
					split: rent.row.split,
					categoryId: rent.category,
					methodId: null,
					tagIds: [],
				},
				...monthly,
				startsOn: rent.row.spentOn,
				nextN: 1,
				nextOn: occurrenceOn(rent.row.spentOn, monthly, 1),
			})
			.returning({ id: khRecurring.id });
		if (recurring) {
			await tx.update(khExpense).set({ recurringId: recurring.id, recurringN: 0 }).where(eq(khExpense.id, rent.row.id));
		}
	}
	await tx.insert(khBudget).values({
		ownerId: me.id,
		categoryId: categories.get("food") ?? null,
		currency: CURRENCY,
		period: "month",
		amountMinor: 800_000,
		startsOn: `${today.slice(0, 7)}-01`,
	});
	await bumpRevs(tx, [me.id]);
}

/**
 * The guest's person becomes the account's: every expense, group, friend and balance
 * moves with `mergePerson`. The account's own preferences win; a guest who went through
 * onboarding hands theirs to an account that hasn't.
 */
async function claim(tx: Tx, fromUserId: string, toUserId: string): Promise<void> {
	const guest = await personOfUser(tx, fromUserId);
	if (!guest) return;
	const account = await ensurePerson(tx, toUserId);
	const [from] = await tx.select().from(khProfile).where(eq(khProfile.userId, fromUserId));
	const [to] = await tx.select().from(khProfile).where(eq(khProfile.userId, toUserId));
	if (from?.onboardedAt && to && !to.onboardedAt) {
		await tx
			.update(khProfile)
			.set({
				homeCurrency: from.homeCurrency,
				timeZone: from.timeZone,
				defaultSplit: from.defaultSplit,
				payNote: from.payNote,
				start: from.start,
				onboardedAt: from.onboardedAt,
			})
			.where(eq(khProfile.userId, toUserId));
	}
	await tx.delete(khProfile).where(eq(khProfile.userId, fromUserId));
	await mergePerson(tx, guest.id, account.id);
}

export const KHARCHA_GUEST_DATA: GuestData = {
	slug: "kharcha",
	section: "kharcha",
	seedGuestData: seedSample,
	claim,
	forget: forgetUsers,
};
