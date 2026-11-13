import "@tanstack/react-start/server-only";
import { and, desc, eq, inArray, isNull, lte, notInArray, or, type SQL, sql } from "drizzle-orm";
import { threadKey } from "@/features/kharcha/notifications";
import type { PeopleInput } from "@/features/kharcha/schema";
import type { CommentView, ThreadState } from "@/features/kharcha/types";
import {
	type ActivityKind,
	type Amount,
	type FriendGroupBalance,
	type FriendThread,
	type GroupThread,
	type PeoplePage,
	THREAD_LIMIT,
	type ThreadItem,
} from "@/features/kharcha/types";
import { type IsoDate, todayInZone } from "@/lib/i18n/date-only";
import {
	khActivity,
	khExpense,
	khExpensePayer,
	khExpenseShare,
	khGroup,
	khGroupMember,
	khLedger,
	khPayment,
	khProfile,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { type KharchaServices, type Me, resolveFriend, resolveGroup, resolveMe } from "../access";
import { pairOf } from "../activity";
import { activityLines } from "../activity-lines";
import { commentsOf, resolveThread, talkOf, threadStates } from "../conversations/service";
import { friendsOf, oneFriend } from "../friends/service";
import { groupView, listGroups } from "../groups/service";
import { byCurrency } from "../ledger";
import { payNoteOf, remindState } from "../settle/service";
import { paymentCards, spendRows } from "../spend/service";

/**
 * Kharcha's people page and threads (docs/guides/kharcha.md "People and threads", Task 90;
 * PLAN 14.5 "Conversations"): each group and each friend is a page of the book holding the
 * cards of its expenses and payments and the system lines of its history, in the order they
 * happened, with its comments (Task 92). What a thread shows is what the caller may see: a
 * former member's group stops when they left (the access table in the guide).
 */

/** The kinds a card stands for: their system line would say the same twice. */
const CARDED: ActivityKind[] = ["expense.created", "payment.created"];

/**
 * `/people`: the caller's friends and groups whose name has `q`, any case. Hidden friends
 * are left out (counted) unless asked for; groups the caller left stay, read only.
 */
export async function listPeople(services: KharchaServices, input: PeopleInput): Promise<PeoplePage> {
	const me = await resolveMe(services.db, services.user);
	const q = (input.q ?? "").trim().toLocaleLowerCase();
	const has = (name: string) => q === "" || name.toLocaleLowerCase().includes(q);
	const friends = (await friendsOf(services.db, me)).filter((friend) => has(friend.person.name));
	const groups = (await listGroups(services)).filter((group) => has(group.name));
	const shown = input.hidden ? friends : friends.filter((friend) => !friend.hidden);
	// Task 92: each conversation's unread lines and last move; the list runs newest first, and
	// focus mode keeps only those unread or unsettled.
	const threads = new Map<string, ThreadState>([
		...(await threadStates(services.db, me, "g")),
		...(await threadStates(services.db, me, "f")),
	]);
	const [profile] = await services.db
		.select({ focus: khProfile.focus })
		.from(khProfile)
		.where(eq(khProfile.userId, me.id));
	const focus = profile?.focus === true;
	const stateOf = (key: string) => threads.get(key) ?? { unread: 0, latestAt: null };
	const newest = (a: string, b: string) => (stateOf(b).latestAt ?? "").localeCompare(stateOf(a).latestAt ?? "");
	const keep = (key: string, balances: ReadonlyArray<{ amountMinor: number }>) =>
		!focus || stateOf(key).unread > 0 || balances.some((balance) => balance.amountMinor !== 0);
	const keptGroups = groups
		.filter((group) => keep(threadKey("g", group.id), group.balances))
		.sort((a, b) => newest(threadKey("g", a.id), threadKey("g", b.id)));
	const keptFriends = shown
		.filter((friend) => keep(threadKey("f", friend.person.id), friend.balances))
		.sort((a, b) => newest(threadKey("f", a.person.id), threadKey("f", b.person.id)));
	const listed = [
		...keptGroups.map((group) => threadKey("g", group.id)),
		...keptFriends.map((friend) => threadKey("f", friend.person.id)),
	];
	return {
		friends: keptFriends,
		groups: keptGroups,
		hiddenCount: friends.filter((friend) => friend.hidden).length,
		threads: Object.fromEntries(listed.map((key) => [key, stateOf(key)])),
		focus,
		focusHidden: groups.length + shown.length - keptGroups.length - keptFriends.length,
	};
}

async function timeZoneOf(db: Db | Tx, me: Me): Promise<string> {
	const [profile] = await db.select({ zone: khProfile.timeZone }).from(khProfile).where(eq(khProfile.userId, me.id));
	return profile?.zone ?? "Asia/Kathmandu";
}

/**
 * A thread's lines from what matched: the newest `THREAD_LIMIT` of the expenses, payments
 * and system lines together, oldest first. `more` says older ones were left out.
 */
async function threadItems(
	db: Db | Tx,
	me: Me,
	sources: {
		expenses: Array<{ id: string; day: IsoDate; at: Date }>;
		payments: Array<{ id: string; day: IsoDate; at: Date }>;
		activity: SQL | undefined;
		comments: CommentView[];
	},
): Promise<{ items: ThreadItem[]; more: boolean }> {
	const zone = await timeZoneOf(db, me);
	const lines = await activityLines(db, me.personId, sources.activity, THREAD_LIMIT + 1);
	type Entry = { type: ThreadItem["type"]; id: string; day: IsoDate; at: string };
	const entries: Entry[] = [
		...sources.expenses.map((row) => ({
			type: "expense" as const,
			id: row.id,
			day: row.day,
			at: row.at.toISOString(),
		})),
		...sources.payments.map((row) => ({
			type: "payment" as const,
			id: row.id,
			day: row.day,
			at: row.at.toISOString(),
		})),
		...lines.map((line) => ({
			type: "system" as const,
			id: line.id,
			day: todayInZone(zone, new Date(line.at)),
			at: line.at,
		})),
		...sources.comments.map((comment) => ({
			type: "comment" as const,
			id: comment.id,
			day: todayInZone(zone, new Date(comment.createdAt)),
			at: comment.createdAt,
		})),
	];
	// Newest first to cut, then oldest first to read.
	entries.sort((a, b) => (a.day === b.day ? b.at.localeCompare(a.at) : b.day.localeCompare(a.day)));
	const kept = entries.slice(0, THREAD_LIMIT).reverse();
	const expenses = new Map(
		(
			await spendRows(
				db,
				me,
				kept.filter((entry) => entry.type === "expense").map((entry) => entry.id),
			)
		).map((row) => [row.id, row]),
	);
	const payments = await paymentCards(
		db,
		me,
		kept.filter((entry) => entry.type === "payment").map((entry) => entry.id),
	);
	const byId = new Map(lines.map((line) => [line.id, line]));
	const comments = new Map(sources.comments.map((comment) => [comment.id, comment]));
	const items = kept.flatMap((entry): ThreadItem[] => {
		if (entry.type === "expense") {
			const expense = expenses.get(entry.id);
			return expense ? [{ ...entry, type: "expense", expense }] : [];
		}
		if (entry.type === "payment") {
			const payment = payments.get(entry.id);
			return payment ? [{ ...entry, type: "payment", payment }] : [];
		}
		if (entry.type === "comment") {
			const comment = comments.get(entry.id);
			return comment ? [{ ...entry, type: "comment", comment }] : [];
		}
		const line = byId.get(entry.id);
		return line ? [{ ...entry, type: "system", line }] : [];
	});
	return { items, more: entries.length > THREAD_LIMIT };
}

/**
 * A group's thread: its expenses and payments outside the trash (a deleted one leaves its
 * system line), and its history but the lines a card stands for. A former member reads it
 * up to when they left.
 */
export async function getGroupThread({ db, user }: KharchaServices, groupId: string): Promise<GroupThread> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveGroup(tx, me, groupId);
		const until = access.current ? null : access.member.leftAt;
		const expenses = await tx
			.select({ id: khExpense.id, day: khExpense.spentOn, at: khExpense.createdAt })
			.from(khExpense)
			.where(
				and(
					eq(khExpense.groupId, groupId),
					isNull(khExpense.deletedAt),
					until ? lte(khExpense.createdAt, until) : undefined,
				),
			)
			.orderBy(desc(khExpense.spentOn), desc(khExpense.createdAt))
			.limit(THREAD_LIMIT + 1);
		const payments = await tx
			.select({ id: khPayment.id, day: khPayment.paidOn, at: khPayment.createdAt })
			.from(khPayment)
			.where(
				and(
					eq(khPayment.groupId, groupId),
					isNull(khPayment.deletedAt),
					until ? lte(khPayment.createdAt, until) : undefined,
				),
			)
			.orderBy(desc(khPayment.paidOn), desc(khPayment.createdAt))
			.limit(THREAD_LIMIT + 1);
		const activity = and(
			eq(khActivity.groupId, groupId),
			notInArray(khActivity.kind, CARDED),
			until ? lte(khActivity.at, until) : undefined,
		);
		const thread = await resolveThread(tx, me, threadKey("g", groupId));
		const comments = await commentsOf(tx, me, thread, THREAD_LIMIT);
		const { items, more } = await threadItems(tx, me, { expenses, payments, activity, comments });
		return { group: await groupView(tx, me, access), items, more, talk: await talkOf(tx, me, thread) };
	});
}

/** The expenses a person is on: as a payer or with a share (everyone a split names has one). */
const onExpense = (personId: string) =>
	sql`${khExpense.id} in (select ${khExpenseShare.expenseId} from ${khExpenseShare} where ${khExpenseShare.personId} = ${personId}
		union select ${khExpensePayer.expenseId} from ${khExpensePayer} where ${khExpensePayer.personId} = ${personId})`;

/**
 * A friend's thread: what is between the two outside groups (their shared expenses, the
 * payments between them, their pair's history), and, with links, the balance between the
 * two in each group both are or were in.
 */
export async function getFriendThread({ db, user }: KharchaServices, personId: string): Promise<FriendThread> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const friend = await oneFriend(tx, me, personId);
		const expenses = await tx
			.select({ id: khExpense.id, day: khExpense.spentOn, at: khExpense.createdAt })
			.from(khExpense)
			.where(and(isNull(khExpense.groupId), isNull(khExpense.deletedAt), onExpense(me.personId), onExpense(personId)))
			.orderBy(desc(khExpense.spentOn), desc(khExpense.createdAt))
			.limit(THREAD_LIMIT + 1);
		const payments = await tx
			.select({ id: khPayment.id, day: khPayment.paidOn, at: khPayment.createdAt })
			.from(khPayment)
			.where(
				and(
					isNull(khPayment.groupId),
					isNull(khPayment.deletedAt),
					or(
						and(eq(khPayment.fromPerson, me.personId), eq(khPayment.toPerson, personId)),
						and(eq(khPayment.fromPerson, personId), eq(khPayment.toPerson, me.personId)),
					),
				),
			)
			.orderBy(desc(khPayment.paidOn), desc(khPayment.createdAt))
			.limit(THREAD_LIMIT + 1);
		const [lo, hi] = pairOf([me.personId, personId]) ?? [me.personId, personId];
		const activity = and(
			isNull(khActivity.groupId),
			eq(khActivity.personLo, lo),
			eq(khActivity.personHi, hi),
			notInArray(khActivity.kind, CARDED),
		);
		const thread = await resolveThread(tx, me, threadKey("f", personId));
		const comments = await commentsOf(tx, me, thread, THREAD_LIMIT);
		const { items, more } = await threadItems(tx, me, { expenses, payments, activity, comments });
		const { person } = await resolveFriend(tx, me, personId);
		return {
			friend,
			items,
			more,
			groups: await sharedGroups(tx, me, personId),
			remind: await remindState(tx, me, user, person),
			payNote: await payNoteOf(tx, personId),
			talk: await talkOf(tx, me, thread),
		};
	});
}

/** The groups the caller and a friend are (or were) both in, newest first, with the balance between the two in each. */
async function sharedGroups(tx: Tx, me: Me, personId: string): Promise<FriendGroupBalance[]> {
	const theirs = tx
		.select({ groupId: khGroupMember.groupId })
		.from(khGroupMember)
		.where(eq(khGroupMember.personId, personId));
	const rows = await tx
		.select({ group: khGroup, leftAt: khGroupMember.leftAt })
		.from(khGroupMember)
		.innerJoin(khGroup, eq(khGroup.id, khGroupMember.groupId))
		.where(and(eq(khGroupMember.personId, me.personId), inArray(khGroupMember.groupId, theirs)))
		.orderBy(desc(khGroup.createdAt), khGroup.id);
	if (rows.length === 0) return [];
	const sums = await tx
		.select({
			groupId: khLedger.groupId,
			currency: khLedger.currency,
			amount:
				sql<number>`sum(case when ${khLedger.creditorId} = ${me.personId} then ${khLedger.amountMinor} else -${khLedger.amountMinor} end)`.mapWith(
					Number,
				),
		})
		.from(khLedger)
		.where(
			and(
				inArray(
					khLedger.groupId,
					rows.map((row) => row.group.id),
				),
				or(
					and(eq(khLedger.creditorId, me.personId), eq(khLedger.debtorId, personId)),
					and(eq(khLedger.creditorId, personId), eq(khLedger.debtorId, me.personId)),
				),
			),
		)
		.groupBy(khLedger.groupId, khLedger.currency);
	return rows.map((row) => ({
		id: row.group.id,
		name: row.group.name,
		color: row.group.color,
		icon: row.group.icon,
		left: row.leftAt !== null,
		balances: sums
			.filter((sum) => sum.groupId === row.group.id && sum.amount !== 0)
			.map((sum): Amount => ({ currency: sum.currency, amountMinor: sum.amount }))
			.sort(byCurrency),
	}));
}
