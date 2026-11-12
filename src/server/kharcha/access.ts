import "@tanstack/react-start/server-only";
import { and, eq } from "drizzle-orm";
import { type ExpenseCan, type GroupCan, TRASH_DAYS } from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { notFound } from "@/server/db/crud";
import {
	type KhExpenseRow,
	type KhFriendRow,
	type KhGroupMemberRow,
	type KhGroupRow,
	type KhPaymentRow,
	type KhPersonRow,
	khExpense,
	khExpensePayer,
	khExpenseShare,
	khFriend,
	khGroup,
	khGroupMember,
	khPayment,
	khPerson,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { ensurePerson } from "./people";

/**
 * Who may do what in Kharcha (docs/guides/kharcha.md "Access", decision 0277): resolvers
 * that every service runs before anything else. What the caller can't see is NOT_FOUND
 * (as the apps, 0187); what they can see but not change is FORBIDDEN, with why (0204).
 *
 * | Caller                         | Personal expense | Shared, no group      | A group and what is in it        |
 * | Its owner or a participant     | everything       | everything            | —                                |
 * | A current group member         | —                | —                     | everything; removing and archiving are the owner's |
 * | A former member                | —                | their own, as before  | the history up to leaving, read only |
 * | Anyone else, guests and admins | NOT_FOUND        | NOT_FOUND             | NOT_FOUND                        |
 *
 * An admin's `kharcha:` permissions open /admin/kharcha's counts, never anyone's data (0186).
 */

/** The caller, as `requireKharchaUser` puts them in the context. */
export type KharchaUser = { id: string; isGuest: boolean; permissions: ReadonlyArray<string> };

/**
 * What a Kharcha service works with. Tests pass their own. `imageStore` is Cloudinary's
 * (receipts, Task 89): null when uploads aren't configured.
 */
export type KharchaServices = { db: Db; user: KharchaUser; imageStore?: ImageStore | null };

/** The caller as a person: who they are in every expense, group and balance. */
export type Me = KharchaUser & { personId: string; person: KhPersonRow };

type Conn = Db | Tx;

/** The caller's person, made on first use (src/server/kharcha/people.ts). */
export async function resolveMe(db: Conn, user: KharchaUser): Promise<Me> {
	const person = await ensurePerson(db, user.id);
	return { ...user, personId: person.id, person };
}

export type GroupAccess = {
	group: KhGroupRow;
	member: KhGroupMemberRow;
	/** False once they left or were removed: the history up to then, read only. */
	current: boolean;
	can: GroupCan;
};

const groupAccess = (group: KhGroupRow, member: KhGroupMemberRow): GroupAccess => {
	const current = member.leftAt === null;
	return {
		group,
		member,
		current,
		can: { edit: current && group.archivedAt === null, manage: current && member.role === "owner" },
	};
};

/** The group, with the caller's place in it. NOT_FOUND unless they are or were a member. */
export async function resolveGroup(db: Conn, me: Me, groupId: string, what = "Group"): Promise<GroupAccess> {
	const [row] = await db
		.select({ group: khGroup, member: khGroupMember })
		.from(khGroup)
		.innerJoin(khGroupMember, and(eq(khGroupMember.groupId, khGroup.id), eq(khGroupMember.personId, me.personId)))
		.where(eq(khGroup.id, groupId));
	if (!row) throw notFound(what);
	return groupAccess(row.group, row.member);
}

/** Why a member can't change the group now: they left it, or it is archived. */
const groupRefusal = (access: GroupAccess, action: string) =>
	access.current
		? ruleError("FORBIDDEN", `Kharcha group archived: ${action}`, m.kharcha_error_group_archived())
		: ruleError("FORBIDDEN", `Kharcha former member: ${action}`, m.kharcha_error_left_group());

/**
 * Refuses what the caller may see but not do in a group: `edit` (its expenses, payments,
 * members and details) needs a current member and a group that isn't archived; `manage`
 * (removing someone, archiving and restoring) needs its owner.
 */
export function assertGroupCan(access: GroupAccess, action: keyof GroupCan): void {
	if (!access.current) throw groupRefusal(access, action);
	if (action === "manage") {
		if (!access.can.manage) {
			throw ruleError("FORBIDDEN", "Kharcha: the group owner's", m.kharcha_error_owner_only());
		}
		return;
	}
	if (!access.can.edit) throw groupRefusal(access, action);
}

/** Whether a trashed row can still be restored (the daily job purges it after). */
const inTrashWindow = (deletedAt: Date, now: Date) =>
	now.getTime() - deletedAt.getTime() <= TRASH_DAYS * 24 * 60 * 60 * 1000;

/** What someone may do to an expense or a payment they can see. */
const sourceCan = (editable: boolean, deletedAt: Date | null): ExpenseCan => ({
	edit: editable && deletedAt === null,
	delete: editable && deletedAt === null,
	restore: editable && deletedAt !== null,
});

type SourceAccess = { group: GroupAccess | null; can: ExpenseCan };

/**
 * A group's expense or payment as the caller reaches it: a current member everything, a
 * former member what was there when they left. NOT_FOUND for the rest.
 */
async function throughGroup(db: Conn, me: Me, groupId: string, createdAt: Date, what: string): Promise<GroupAccess> {
	const group = await resolveGroup(db, me, groupId, what);
	if (!group.current && group.member.leftAt && createdAt > group.member.leftAt) throw notFound(what);
	return group;
}

export type ExpenseAccess = SourceAccess & { expense: KhExpenseRow };

/**
 * The expense, with what the caller may do to it. NOT_FOUND unless they are on it (a payer
 * or a share), or it is in a group of theirs. One in the trash stays reachable for 30 days
 * by those who could edit it, to restore it.
 */
export async function resolveExpense(db: Conn, me: Me, expenseId: string, now = new Date()): Promise<ExpenseAccess> {
	const [expense] = await db.select().from(khExpense).where(eq(khExpense.id, expenseId));
	if (!expense) throw notFound("Expense");
	if (expense.deletedAt && !inTrashWindow(expense.deletedAt, now)) throw notFound("Expense");
	if (expense.groupId) {
		const group = await throughGroup(db, me, expense.groupId, expense.createdAt, "Expense");
		return { expense, group, can: sourceCan(group.can.edit, expense.deletedAt) };
	}
	const [paid] = await db
		.select({ id: khExpensePayer.personId })
		.from(khExpensePayer)
		.where(and(eq(khExpensePayer.expenseId, expenseId), eq(khExpensePayer.personId, me.personId)));
	const [owes] = paid
		? [paid]
		: await db
				.select({ id: khExpenseShare.personId })
				.from(khExpenseShare)
				.where(and(eq(khExpenseShare.expenseId, expenseId), eq(khExpenseShare.personId, me.personId)));
	if (!owes) throw notFound("Expense");
	return { expense, group: null, can: sourceCan(true, expense.deletedAt) };
}

export type PaymentAccess = SourceAccess & { payment: KhPaymentRow };

/** The payment, with what the caller may do to it: one they made or received, or one in a group of theirs. */
export async function resolvePayment(db: Conn, me: Me, paymentId: string, now = new Date()): Promise<PaymentAccess> {
	const [payment] = await db.select().from(khPayment).where(eq(khPayment.id, paymentId));
	if (!payment) throw notFound("Payment");
	if (payment.deletedAt && !inTrashWindow(payment.deletedAt, now)) throw notFound("Payment");
	if (payment.groupId) {
		const group = await throughGroup(db, me, payment.groupId, payment.createdAt, "Payment");
		return { payment, group, can: sourceCan(group.can.edit, payment.deletedAt) };
	}
	if (payment.fromPerson !== me.personId && payment.toPerson !== me.personId) throw notFound("Payment");
	return { payment, group: null, can: sourceCan(true, payment.deletedAt) };
}

/**
 * Refuses what the caller may see but not do to an expense or a payment, with why: they
 * left its group, the group is archived, or it is (or isn't) in the trash.
 */
export function assertSourceCan(access: SourceAccess, action: keyof ExpenseCan): void {
	if (access.can[action]) return;
	if (access.group && !access.group.can.edit) throw groupRefusal(access.group, action);
	throw action === "restore"
		? ruleError("FORBIDDEN", "Kharcha: not in the trash", m.kharcha_error_not_in_trash())
		: ruleError("FORBIDDEN", "Kharcha: in the trash", m.kharcha_error_in_trash());
}

export type FriendAccess = { person: KhPersonRow; friend: KhFriendRow };

/** One of the caller's friends. NOT_FOUND for anyone else, whoever they are. */
export async function resolveFriend(db: Conn, me: Me, personId: string): Promise<FriendAccess> {
	const [row] = await db
		.select({ person: khPerson, friend: khFriend })
		.from(khFriend)
		.innerJoin(khPerson, eq(khPerson.id, khFriend.friendId))
		.where(and(eq(khFriend.ownerId, me.personId), eq(khFriend.friendId, personId)));
	if (!row) throw notFound("Person");
	return row;
}
