import "@tanstack/react-start/server-only";
import { and, desc, eq, inArray, isNull, lte, or, type SQL, sql } from "drizzle-orm";
import {
	COMMENT_LIMIT,
	excerptOf,
	type NotificationData,
	parseThread,
	REACTIONS,
	type Reaction,
	type ThreadKey,
	threadKey,
} from "@/features/kharcha/notifications";
import type { CreateCommentInput, ReactInput, UpdateCommentInput } from "@/features/kharcha/schema";
import type { CommentView, MentionHandle, ThreadState, ThreadTalk } from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { notFound } from "@/server/db/crud";
import {
	type KhCommentRow,
	khActivity,
	khComment,
	khGroupMember,
	khNotification,
	khPerson,
	khReaction,
	khRead,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { enforceRateLimit } from "@/server/http/rate-limit";
import {
	assertGroupCan,
	assertSourceCan,
	type ExpenseAccess,
	type GroupAccess,
	type KharchaServices,
	type Me,
	resolveExpense,
	resolveFriend,
	resolveGroup,
	resolveMe,
} from "../access";
import { pairOf } from "../activity";
import * as expenses from "../expenses/repository";
import { deliverAfter, type NotifyEvent, produce } from "../notify/produce";
import { loadPeople } from "../people";
import { bumpRevs } from "../rev";
import { currentMemberIds, touched } from "../rules";

/**
 * Kharcha's conversations (Task 92, decision 0286; docs/guides/kharcha.md "Conversations and
 * notifications"): comments in a group's thread, a friend's and an expense's, their
 * reactions, and how far each person has read each thread. Who may read and write a thread
 * is its group's, friend's or expense's access (the resolvers); a comment is edited and
 * deleted by its author only.
 */

type Conn = Db | Tx;

/** A thread as the caller reaches it: where its rows live, who is in it, and whether they may write. */
export type ThreadScope = {
	key: ThreadKey;
	groupId: string | null;
	pair: readonly [string, string] | null;
	expenseId: string | null;
	/** The group a notification about it belongs to (a group's thread, or a group's expense). */
	notifyGroupId: string | null;
	/** Everyone in it: a group's current members, the two friends, the people on the expense. */
	people: string[];
	/** For the notification's sentence: the group's name, the expense's title. */
	title: string | null;
	group: string | null;
	/** A former member reads up to when they left. */
	until: Date | null;
	/** When reading starts counting for the caller: joining the group. */
	since: Date | null;
	group_: GroupAccess | null;
	expense_: ExpenseAccess | null;
};

/** The thread `key` names, as the caller may reach it; NOT_FOUND otherwise (the resolvers'). */
export async function resolveThread(tx: Conn, me: Me, key: ThreadKey): Promise<ThreadScope> {
	const { kind, id } = parseThread(key);
	if (kind === "g") {
		const access = await resolveGroup(tx, me, id);
		return {
			key,
			groupId: id,
			pair: null,
			expenseId: null,
			notifyGroupId: id,
			people: await currentMemberIds(tx, id),
			title: access.group.name,
			group: access.group.name,
			until: access.current ? null : access.member.leftAt,
			since: access.member.joinedAt,
			group_: access,
			expense_: null,
		};
	}
	if (kind === "f") {
		await resolveFriend(tx, me, id);
		return {
			key,
			groupId: null,
			pair: pairOf([me.personId, id]),
			expenseId: null,
			notifyGroupId: null,
			people: [me.personId, id],
			title: null,
			group: null,
			until: null,
			since: null,
			group_: null,
			expense_: null,
		};
	}
	const access = await resolveExpense(tx, me, id);
	const people = expenses.partsPeople(await expenses.partsOf(tx, id));
	return {
		key,
		groupId: null,
		pair: null,
		expenseId: id,
		notifyGroupId: access.expense.groupId,
		people,
		title: access.expense.title || access.expense.merchant,
		group: access.group?.group.name ?? null,
		until: access.group && !access.group.current ? access.group.member.leftAt : null,
		since: null,
		group_: null,
		expense_: access,
	};
}

/** Whether the caller can write in the thread now: a current member of a group that isn't archived, an expense outside the trash. */
const writable = (scope: ThreadScope) =>
	scope.group_ ? scope.group_.can.edit : scope.expense_ ? scope.expense_.can.edit : true;

function assertWritable(scope: ThreadScope): void {
	if (scope.group_) assertGroupCan(scope.group_, "edit");
	if (scope.expense_) assertSourceCan(scope.expense_, "edit");
}

/** Where a thread's comments are: its group, its pair or its expense. */
const commentsWhere = (scope: ThreadScope): SQL | undefined =>
	scope.groupId
		? eq(khComment.groupId, scope.groupId)
		: scope.pair
			? and(eq(khComment.personLo, scope.pair[0]), eq(khComment.personHi, scope.pair[1]))
			: scope.expenseId
				? eq(khComment.expenseId, scope.expenseId)
				: undefined;

/** Everyone who hears about a thread's change and whose pages refresh: its people, and a group's expense's members. */
const audience = (tx: Tx, scope: ThreadScope) => touched(tx, scope.groupId ?? scope.notifyGroupId, scope.people);

/** The thread's key from the other side, for a notification: a friend's thread is the actor's to them. */
const keyFor = (scope: ThreadScope, me: Me): ThreadKey => (scope.pair ? threadKey("f", me.personId) : scope.key);

/** The newest comments of a thread the caller may read, oldest first; a former member's up to leaving. */
export async function commentsOf(tx: Conn, me: Me, scope: ThreadScope, limit = 500): Promise<CommentView[]> {
	const rows = await tx
		.select()
		.from(khComment)
		.where(
			and(
				commentsWhere(scope),
				isNull(khComment.deletedAt),
				scope.until ? lte(khComment.createdAt, scope.until) : undefined,
			),
		)
		.orderBy(desc(khComment.createdAt), desc(khComment.id))
		.limit(limit);
	return views(tx, me, rows.reverse(), writable(scope));
}

async function views(tx: Conn, me: Me, rows: KhCommentRow[], canWrite: boolean): Promise<CommentView[]> {
	if (rows.length === 0) return [];
	const authors = await loadPeople(
		tx,
		me.personId,
		rows.flatMap((row) => (row.authorId ? [row.authorId] : [])),
	);
	const mentioned = await handlesOf(
		tx,
		rows.flatMap((row) => row.mentions),
	);
	const reactions = await tx
		.select({
			commentId: khReaction.commentId,
			emoji: khReaction.emoji,
			count: sql<number>`count(*)`.mapWith(Number),
			mine: sql<boolean>`bool_or(${khReaction.personId} = ${me.personId})`,
		})
		.from(khReaction)
		.where(
			inArray(
				khReaction.commentId,
				rows.map((row) => row.id),
			),
		)
		.groupBy(khReaction.commentId, khReaction.emoji);
	return rows.map((row) => {
		const own = row.authorId === me.personId;
		return {
			id: row.id,
			author: authors.find((person) => person.id === row.authorId) ?? null,
			body: row.body,
			mentions: row.mentions.flatMap((id) => mentioned.filter((handle) => handle.id === id)),
			createdAt: row.createdAt.toISOString(),
			editedAt: row.editedAt?.toISOString() ?? null,
			reactions: REACTIONS.flatMap((emoji) => {
				const hit = reactions.find((reaction) => reaction.commentId === row.id && reaction.emoji === emoji);
				return hit ? [{ emoji, count: hit.count, mine: hit.mine === true }] : [];
			}),
			can: { edit: own && canWrite, delete: own && canWrite, react: canWrite },
		};
	});
}

/** People's handles: their own name, the same for every reader (a nickname is the caller's alone). */
async function handlesOf(tx: Conn, ids: ReadonlyArray<string>): Promise<MentionHandle[]> {
	const wanted = [...new Set(ids)];
	if (wanted.length === 0) return [];
	const rows = await tx
		.select({ id: khPerson.id, handle: khPerson.displayName })
		.from(khPerson)
		.where(inArray(khPerson.id, wanted));
	return rows;
}

/** A thread's conversation for the caller: whether they can write, whom they can mention, what they haven't read. */
export async function talkOf(tx: Conn, me: Me, scope: ThreadScope): Promise<ThreadTalk> {
	const others = scope.people.filter((id) => id !== me.personId);
	const people = (await loadPeople(tx, me.personId, others)).filter((person) => person.hasAccount);
	const handles = await handlesOf(
		tx,
		people.map((person) => person.id),
	);
	const { kind, id } = parseThread(scope.key);
	const states = await threadStates(tx, me, kind, [id]);
	return {
		thread: scope.key,
		canComment: writable(scope),
		mentionable: people.map((person) => ({
			...person,
			handle: handles.find((handle) => handle.id === person.id)?.handle ?? person.name,
		})),
		unread: states.get(scope.key)?.unread ?? 0,
	};
}

/** The mentions a comment may keep: people in the thread other than its author. */
const keptMentions = (scope: ThreadScope, me: Me, mentions: ReadonlyArray<string>) =>
	[...new Set(mentions)].filter((id) => id !== me.personId && scope.people.includes(id));

const notificationData = (scope: ThreadScope, body: string): NotificationData => ({
	...(scope.title ? { title: scope.title } : {}),
	...(scope.group ? { group: scope.group } : {}),
	excerpt: excerptOf(body),
});

/** The caller has read the thread up to now (writing in it counts). */
async function touchRead(tx: Conn, me: Me, key: ThreadKey, now = new Date()): Promise<void> {
	await tx
		.insert(khRead)
		.values({ personId: me.personId, thread: key, readAt: now })
		.onConflictDoUpdate({ target: [khRead.personId, khRead.thread], set: { readAt: now } });
}

/** A comment in a thread the caller can write in: mentions first, then everyone else in it hears. */
export async function createComment(services: KharchaServices, input: CreateCommentInput): Promise<CommentView> {
	const { db, user } = services;
	await enforceRateLimit(db, `kharcha-comment:${user.id}`, COMMENT_LIMIT);
	const { view, instant } = await db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const scope = await resolveThread(tx, me, input.thread as ThreadKey);
		assertWritable(scope);
		const mentions = keptMentions(scope, me, input.mentions ?? []);
		const [row] = await tx
			.insert(khComment)
			.values({
				...(input.id ? { id: input.id } : {}),
				groupId: scope.groupId,
				personLo: scope.pair?.[0] ?? null,
				personHi: scope.pair?.[1] ?? null,
				expenseId: scope.expenseId,
				authorId: me.personId,
				body: input.body.trim(),
				mentions,
			})
			.returning();
		if (!row) throw new Error("Kharcha: the comment wasn't written");
		const people = await audience(tx, scope);
		await bumpRevs(tx, people);
		await touchRead(tx, me, scope.key);
		const data = notificationData(scope, row.body);
		const thread = keyFor(scope, me);
		const base = { thread, groupId: scope.notifyGroupId, expenseId: scope.expenseId, data };
		const { instant } = await produce(tx, { personId: me.personId, name: me.person.displayName }, [
			{ kind: "comment.mention", to: mentions, ...base },
			{ kind: "comment.thread", to: scope.people, ...base },
		] satisfies NotifyEvent[]);
		const [view] = await views(tx, me, [row], true);
		if (!view) throw new Error("Kharcha: the comment wasn't read back");
		return { view, instant };
	});
	deliverAfter(services.deliver, instant);
	return view;
}

/** The comment and its thread, as the caller reaches them; a deleted one, or one written after a former member left, is NOT_FOUND. */
async function resolveComment(tx: Tx, me: Me, commentId: string): Promise<{ row: KhCommentRow; scope: ThreadScope }> {
	const [row] = await tx.select().from(khComment).where(eq(khComment.id, commentId));
	if (!row || row.deletedAt) throw notFound("Comment");
	const key = row.groupId
		? threadKey("g", row.groupId)
		: row.expenseId
			? threadKey("e", row.expenseId)
			: row.personLo === me.personId && row.personHi
				? threadKey("f", row.personHi)
				: row.personHi === me.personId && row.personLo
					? threadKey("f", row.personLo)
					: null;
	if (!key) throw notFound("Comment");
	const scope = await resolveThread(tx, me, key);
	if (scope.until && row.createdAt > scope.until) throw notFound("Comment");
	return { row, scope };
}

function assertAuthor(row: KhCommentRow, me: Me): void {
	if (row.authorId !== me.personId) {
		throw ruleError("FORBIDDEN", "Kharcha: someone else's comment", m.kharcha_error_comment_author());
	}
}

/** Its author's edit: the text and the mentions; someone newly mentioned hears. */
export async function updateComment(services: KharchaServices, input: UpdateCommentInput): Promise<CommentView> {
	const { db, user } = services;
	const { view, instant } = await db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const { row, scope } = await resolveComment(tx, me, input.commentId);
		assertWritable(scope);
		assertAuthor(row, me);
		const mentions = keptMentions(scope, me, input.mentions ?? []);
		const [saved] = await tx
			.update(khComment)
			.set({ body: input.body.trim(), mentions, editedAt: new Date() })
			.where(eq(khComment.id, row.id))
			.returning();
		if (!saved) throw notFound("Comment");
		await bumpRevs(tx, await audience(tx, scope));
		const fresh = mentions.filter((id) => !row.mentions.includes(id));
		const { instant } = await produce(tx, { personId: me.personId, name: me.person.displayName }, [
			{
				kind: "comment.mention",
				to: fresh,
				thread: keyFor(scope, me),
				groupId: scope.notifyGroupId,
				expenseId: scope.expenseId,
				data: notificationData(scope, saved.body),
			},
		]);
		const [view] = await views(tx, me, [saved], true);
		if (!view) throw notFound("Comment");
		return { view, instant };
	});
	deliverAfter(services.deliver, instant);
	return view;
}

/** Its author's delete: it leaves the thread (its reactions with it). */
export async function deleteComment({ db, user }: KharchaServices, commentId: string): Promise<void> {
	await db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const { row, scope } = await resolveComment(tx, me, commentId);
		assertWritable(scope);
		assertAuthor(row, me);
		await tx.update(khComment).set({ deletedAt: new Date() }).where(eq(khComment.id, row.id));
		await tx.delete(khReaction).where(eq(khReaction.commentId, row.id));
		await bumpRevs(tx, await audience(tx, scope));
	});
}

/** A reaction from the fixed set, on or off, by anyone who can write in the thread. Nobody is notified. */
export async function react({ db, user }: KharchaServices, input: ReactInput): Promise<CommentView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const { row, scope } = await resolveComment(tx, me, input.commentId);
		assertWritable(scope);
		const emoji = input.emoji as Reaction;
		if (input.on) {
			await tx.insert(khReaction).values({ commentId: row.id, personId: me.personId, emoji }).onConflictDoNothing();
		} else {
			await tx
				.delete(khReaction)
				.where(
					and(eq(khReaction.commentId, row.id), eq(khReaction.personId, me.personId), eq(khReaction.emoji, emoji)),
				);
		}
		await bumpRevs(tx, await audience(tx, scope));
		const [view] = await views(tx, me, [row], true);
		if (!view) throw notFound("Comment");
		return view;
	});
}

/** The caller read the thread: its read mark moves to now, and their notifications about it are read. */
export async function markThreadRead({ db, user }: KharchaServices, key: ThreadKey, now = new Date()): Promise<void> {
	const me = await resolveMe(db, user);
	await resolveThread(db, me, key);
	await touchRead(db, me, key, now);
	await db
		.update(khNotification)
		.set({ readAt: now })
		.where(and(eq(khNotification.userId, user.id), eq(khNotification.thread, key), isNull(khNotification.readAt)));
}

type Lines = { table: "activity" | "comment"; kind: "g" | "f" | "e" };

/**
 * Per thread of one kind: the lines from others since the caller last read it (history and
 * comments), and when it last moved. In a group, reading starts when the caller joined and
 * stops when they left; without a read mark, everything from others is unread.
 */
export async function threadStates(
	db: Conn,
	me: Me,
	kind: "g" | "f" | "e",
	ids?: ReadonlyArray<string>,
): Promise<Map<string, ThreadState>> {
	const result = new Map<string, ThreadState>();
	if (ids && ids.length === 0) return result;
	const parts = await Promise.all(
		(["activity", "comment"] as const).map((table) => linesOf(db, me, { table, kind }, ids)),
	);
	for (const rows of parts) {
		for (const row of rows) {
			if (!row.id) continue;
			const key = threadKey(kind, row.id);
			const before = result.get(key) ?? { unread: 0, latestAt: null };
			const latest = row.latest ? new Date(row.latest).toISOString() : null;
			result.set(key, {
				unread: before.unread + row.unread,
				latestAt: !before.latestAt || (latest && latest > before.latestAt) ? latest : before.latestAt,
			});
		}
	}
	return result;
}

function linesOf(db: Conn, me: Me, { table, kind }: Lines, ids?: ReadonlyArray<string>) {
	const t =
		table === "activity"
			? {
					from: khActivity,
					groupId: khActivity.groupId,
					lo: khActivity.personLo,
					hi: khActivity.personHi,
					expenseId: khActivity.expenseId,
					actor: khActivity.actorId,
					at: khActivity.at,
					live: undefined,
				}
			: {
					from: khComment,
					groupId: khComment.groupId,
					lo: khComment.personLo,
					hi: khComment.personHi,
					expenseId: khComment.expenseId,
					actor: khComment.authorId,
					at: khComment.createdAt,
					live: isNull(khComment.deletedAt),
				};
	const other = sql<string>`case when ${t.lo} = ${me.personId} then ${t.hi} else ${t.lo} end`;
	const id = kind === "g" ? sql<string>`${t.groupId}` : kind === "e" ? sql<string>`${t.expenseId}` : other;
	const baseline =
		kind === "g"
			? sql`coalesce(${khRead.readAt}, ${khGroupMember.joinedAt})`
			: sql`coalesce(${khRead.readAt}, 'epoch'::timestamptz)`;
	const where =
		kind === "g"
			? and(
					ids ? inArray(t.groupId, [...ids]) : sql`true`,
					or(isNull(khGroupMember.leftAt), lte(t.at, khGroupMember.leftAt)),
				)
			: kind === "e"
				? inArray(t.expenseId, [...(ids ?? [])])
				: and(
						table === "activity" ? isNull(khActivity.groupId) : sql`${khComment.personLo} is not null`,
						or(eq(t.lo, me.personId), eq(t.hi, me.personId)),
						ids ? inArray(other, [...ids]) : undefined,
					);
	const select = {
		id,
		unread:
			sql<number>`count(*) filter (where ${t.actor} is distinct from ${me.personId} and ${t.at} > ${baseline})`.mapWith(
				Number,
			),
		latest: sql<string | null>`max(${t.at})`,
	};
	const base = table === "activity" ? db.select(select).from(khActivity) : db.select(select).from(khComment);
	const joined =
		kind === "g"
			? base.innerJoin(
					khGroupMember,
					and(eq(khGroupMember.groupId, t.groupId), eq(khGroupMember.personId, me.personId)),
				)
			: base;
	return joined
		.leftJoin(
			khRead,
			and(eq(khRead.personId, me.personId), eq(khRead.thread, sql`${`${kind}:`}::text || (${id})::text`)),
		)
		.where(and(where, t.live))
		.groupBy(sql`1`);
}
