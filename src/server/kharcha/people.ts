import "@tanstack/react-start/server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Split } from "@/features/kharcha/money/split";
import { KHARCHA_COLORS, type KharchaColor, type KharchaPerson } from "@/features/kharcha/types";
import { notFound } from "@/server/db/crud";
import {
	type KhPersonRow,
	khActivity,
	khExpense,
	khExpensePayer,
	khExpenseShare,
	khFriend,
	khPerson,
	khProfile,
	user,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { writeLedger } from "./ledger";
import { mergeLists } from "./lists/repository";
import { bumpRevs } from "./rev";

/**
 * Kharcha's people (docs/guides/kharcha.md "People", decision 0277): the identity
 * everything else points at. A user's own person is made on first use; a contact is made
 * by whoever adds one; two people who turn out to be one are merged.
 */

/** A database or a transaction: reads take either. */
export type Conn = Db | Tx;

/** A colour for a new person, steady for the same seed. */
export const colorFor = (seed: string): KharchaColor => {
	let hash = 0;
	for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 1_000_003;
	return KHARCHA_COLORS[hash % KHARCHA_COLORS.length] ?? "teal";
};

export async function personOfUser(db: Conn, userId: string): Promise<KhPersonRow | null> {
	const [row] = await db.select().from(khPerson).where(eq(khPerson.userId, userId));
	return row ?? null;
}

/**
 * The user's own person, made on first use together with their profile. An account with
 * a verified address takes over the person somebody already made for that address (their
 * balances were waiting for them); an unverified or guest account never claims an address.
 */
export async function ensurePerson(db: Conn, userId: string): Promise<KhPersonRow> {
	const existing = await personOfUser(db, userId);
	if (existing) return existing;
	return db.transaction(async (tx) => {
		const [account] = await tx
			.select({ name: user.name, email: user.email, emailVerified: user.emailVerified, isAnonymous: user.isAnonymous })
			.from(user)
			.where(eq(user.id, userId));
		if (!account) throw notFound("User");
		const address = account.emailVerified && !account.isAnonymous ? account.email.trim().toLowerCase() : null;
		const own = { userId, displayName: account.name, color: colorFor(userId) };

		let person: KhPersonRow | null = null;
		if (address) {
			const [waiting] = await tx
				.update(khPerson)
				.set({ userId, displayName: account.name })
				.where(and(eq(khPerson.email, address), isNull(khPerson.userId)))
				.returning();
			person = waiting ?? null;
		}
		// A conflict is a request racing this one (the person exists by now), or the address
		// still on another account's person (then theirs is made without it).
		if (!person && address) {
			const [made] = await tx
				.insert(khPerson)
				.values({ ...own, email: address })
				.onConflictDoNothing()
				.returning();
			person = made ?? (await personOfUser(tx, userId));
		}
		if (!person) {
			const [made] = await tx.insert(khPerson).values(own).onConflictDoNothing().returning();
			person = made ?? (await personOfUser(tx, userId));
		}
		if (!person) throw notFound("Person");
		await tx.insert(khProfile).values({ userId, personId: person.id }).onConflictDoNothing();
		return person;
	});
}

/** A contact with a name only: private to `creatorId` until an address is added (Task 90). */
export async function insertContact(tx: Tx, creatorId: string, name: string): Promise<KhPersonRow> {
	const [row] = await tx
		.insert(khPerson)
		.values({ displayName: name, color: colorFor(`${creatorId}:${name}`), createdBy: creatorId })
		.returning();
	if (!row) throw notFound("Person");
	return row;
}

/**
 * The person with this address, made when nobody added it yet: one person per address, so
 * everyone who adds it shares them. Whether it already existed isn't told to the caller.
 */
export async function personByEmail(tx: Tx, creatorId: string, email: string, name: string): Promise<KhPersonRow> {
	const address = email.trim().toLowerCase();
	const [made] = await tx
		.insert(khPerson)
		.values({ email: address, displayName: name, color: colorFor(address), createdBy: creatorId })
		.onConflictDoNothing()
		.returning();
	if (made) return made;
	const [row] = await tx.select().from(khPerson).where(eq(khPerson.email, address));
	if (!row) throw notFound("Person");
	return row;
}

/** Makes two people friends, both ways; rows that exist stay as they are. */
export async function befriend(tx: Tx, pairs: ReadonlyArray<readonly [string, string]>): Promise<void> {
	const rows = pairs
		.filter(([a, b]) => a !== b)
		.flatMap(([a, b]) => [
			{ ownerId: a, friendId: b },
			{ ownerId: b, friendId: a },
		]);
	if (rows.length > 0) await tx.insert(khFriend).values(rows).onConflictDoNothing();
}

/**
 * People as the caller sees them: their own nickname for a friend when they set one, the
 * person's name otherwise. Addresses are never part of it.
 */
export async function loadPeople(db: Conn, meId: string, ids: Iterable<string>): Promise<KharchaPerson[]> {
	const wanted = [...new Set(ids)];
	if (wanted.length === 0) return [];
	const rows = await db
		.select({ person: khPerson, nickname: khFriend.nickname })
		.from(khPerson)
		.leftJoin(khFriend, and(eq(khFriend.ownerId, meId), eq(khFriend.friendId, khPerson.id)))
		.where(inArray(khPerson.id, wanted));
	const byId = new Map(rows.map((row) => [row.person.id, row]));
	return wanted.flatMap((id) => {
		const row = byId.get(id);
		return row ? [personDto(row.person, meId, row.nickname ?? "")] : [];
	});
}

export const personDto = (row: KhPersonRow, meId: string, nickname = ""): KharchaPerson => ({
	id: row.id,
	name: nickname || row.displayName,
	color: row.color,
	isMe: row.id === meId,
	hasAccount: row.userId !== null,
});

/**
 * Two people who are one: every reference to `fromId` becomes `toId`, then `fromId` is
 * deleted, in the caller's transaction. Used when a guest becomes an account, when a
 * contact gets an address that already has a person, and when someone joins (Task 90).
 *
 * - Where both were on one expense, their payer rows and their shares are added up, the
 *   split becomes exact amounts (its inputs named two people who are now one), and the
 *   expense's debts are worked out again.
 * - What one owed the other is gone with the merge, and so is a payment between them.
 * - A group both were in keeps one membership: the owner's role, the earlier joining, and
 *   current if either was.
 * - The person who stays keeps their own nickname for a friend, their account and their
 *   address, and takes the other's where they had none.
 *
 * A table that points at people adds its lines here (tests/server/kharcha-people.test.ts
 * checks every reference).
 */
export async function mergePerson(tx: Tx, fromId: string, toId: string): Promise<void> {
	if (fromId === toId) return;
	const people = await tx
		.select()
		.from(khPerson)
		.where(inArray(khPerson.id, [fromId, toId]))
		.orderBy(khPerson.id)
		.for("update");
	const from = people.find((row) => row.id === fromId);
	const to = people.find((row) => row.id === toId);
	if (!from || !to) throw notFound("Person");

	// Expenses that name both, before anything moves.
	const ofFrom = await expensesNaming(tx, fromId);
	const all = [...new Set([...ofFrom.payers, ...ofFrom.shares])];
	const ofTo = await expensesNaming(tx, toId, all);
	const sharedIds = all.filter((expenseId) => ofTo.payers.has(expenseId) || ofTo.shares.has(expenseId));
	// Where both had a share, the split's inputs named two people who are now one.
	const resplit = new Set(sharedIds.filter((expenseId) => ofFrom.shares.has(expenseId) && ofTo.shares.has(expenseId)));

	// Payers and shares: add up where both have a row, then move the rest.
	// Where both had one, the one who stays keeps their own method and category (Task 89), else takes the other's.
	await tx.execute(sql`
		update kh_expense_payer t set amount_minor = t.amount_minor + f.amount_minor,
			method_id = coalesce(t.method_id, f.method_id)
		from kh_expense_payer f
		where f.expense_id = t.expense_id and f.person_id = ${fromId} and t.person_id = ${toId}
	`);
	await tx.execute(sql`
		delete from kh_expense_payer f using kh_expense_payer t
		where f.expense_id = t.expense_id and f.person_id = ${fromId} and t.person_id = ${toId}
	`);
	await tx.update(khExpensePayer).set({ personId: toId }).where(eq(khExpensePayer.personId, fromId));
	await tx.execute(sql`
		update kh_expense_share t set owed_minor = t.owed_minor + f.owed_minor,
			category_id = coalesce(t.category_id, f.category_id), duplicate_ok = t.duplicate_ok or f.duplicate_ok
		from kh_expense_share f
		where f.expense_id = t.expense_id and f.person_id = ${fromId} and t.person_id = ${toId}
	`);
	await tx.execute(sql`
		delete from kh_expense_share f using kh_expense_share t
		where f.expense_id = t.expense_id and f.person_id = ${fromId} and t.person_id = ${toId}
	`);
	// The split's inputs name people by id: everyone a split names has a share row, so these are all of them.
	await tx.execute(sql`
		update kh_expense set split = replace(split::text, ${fromId}, ${toId})::jsonb
		where id in (select expense_id from kh_expense_share where person_id = ${fromId})
	`);
	await tx.update(khExpenseShare).set({ personId: toId }).where(eq(khExpenseShare.personId, fromId));
	// A share's tags: both people's, on the one share.
	await tx.execute(sql`
		insert into kh_share_tag (expense_id, person_id, tag_id)
		select expense_id, ${toId}, tag_id from kh_share_tag where person_id = ${fromId}
		on conflict do nothing
	`);
	await tx.execute(sql`delete from kh_share_tag where person_id = ${fromId}`);

	// The ledger: a debt between the two is no debt; the rest changes hands.
	await tx.execute(sql`
		delete from kh_ledger
		where (debtor_id = ${fromId} and creditor_id = ${toId}) or (debtor_id = ${toId} and creditor_id = ${fromId})
	`);
	await tx.execute(sql`update kh_ledger set debtor_id = ${toId} where debtor_id = ${fromId}`);
	await tx.execute(sql`update kh_ledger set creditor_id = ${toId} where creditor_id = ${fromId}`);

	// Payments: one between the two paid nobody.
	await tx.execute(sql`
		delete from kh_payment
		where (from_person = ${fromId} and to_person = ${toId}) or (from_person = ${toId} and to_person = ${fromId})
	`);
	await tx.execute(sql`update kh_payment set from_person = ${toId} where from_person = ${fromId}`);
	await tx.execute(sql`update kh_payment set to_person = ${toId} where to_person = ${fromId}`);
	await tx.execute(sql`update kh_payment set created_by = ${toId} where created_by = ${fromId}`);
	await tx.execute(sql`update kh_expense set created_by = ${toId} where created_by = ${fromId}`);

	// Groups and memberships.
	await tx.execute(sql`update kh_group set created_by = ${toId} where created_by = ${fromId}`);
	await tx.execute(sql`
		update kh_group_member t set
			role = case when f.role = 'owner' then 'owner' else t.role end,
			joined_at = least(t.joined_at, f.joined_at),
			left_at = case when t.left_at is null or f.left_at is null then null else greatest(t.left_at, f.left_at) end
		from kh_group_member f
		where f.group_id = t.group_id and f.person_id = ${fromId} and t.person_id = ${toId}
	`);
	await tx.execute(sql`
		delete from kh_group_member f using kh_group_member t
		where f.group_id = t.group_id and f.person_id = ${fromId} and t.person_id = ${toId}
	`);
	await tx.execute(sql`update kh_group_member set person_id = ${toId} where person_id = ${fromId}`);

	// Friends: nobody is their own friend; where both rows exist, the one that stays wins.
	await tx.execute(sql`
		delete from kh_friend
		where (owner_id = ${fromId} and friend_id = ${toId}) or (owner_id = ${toId} and friend_id = ${fromId})
	`);
	await tx.execute(sql`
		update kh_friend t set nickname = f.nickname
		from kh_friend f
		where f.owner_id = ${fromId} and t.owner_id = ${toId} and f.friend_id = t.friend_id and t.nickname = ''
	`);
	await tx.execute(sql`
		delete from kh_friend f using kh_friend t
		where f.owner_id = ${fromId} and t.owner_id = ${toId} and f.friend_id = t.friend_id
	`);
	await tx.execute(sql`update kh_friend set owner_id = ${toId} where owner_id = ${fromId}`);
	await tx.execute(sql`
		update kh_friend t set nickname = f.nickname, hidden = t.hidden and f.hidden
		from kh_friend f
		where f.friend_id = ${fromId} and t.friend_id = ${toId} and f.owner_id = t.owner_id and t.nickname = ''
	`);
	await tx.execute(sql`
		delete from kh_friend f using kh_friend t
		where f.friend_id = ${fromId} and t.friend_id = ${toId} and f.owner_id = t.owner_id
	`);
	await tx.execute(sql`update kh_friend set friend_id = ${toId} where friend_id = ${fromId}`);

	// History: the actor and the subject move; the thread of the two is no thread.
	await tx.update(khActivity).set({ actorId: toId }).where(eq(khActivity.actorId, fromId));
	await tx.update(khActivity).set({ subjectId: toId }).where(eq(khActivity.subjectId, fromId));
	await tx.execute(sql`
		delete from kh_activity
		where person_lo = least(${fromId}::uuid, ${toId}::uuid) and person_hi = greatest(${fromId}::uuid, ${toId}::uuid)
			and group_id is null and expense_id is null and payment_id is null
	`);
	await tx.execute(sql`
		update kh_activity set person_lo = null, person_hi = null
		where person_lo = least(${fromId}::uuid, ${toId}::uuid) and person_hi = greatest(${fromId}::uuid, ${toId}::uuid)
	`);
	await tx.execute(sql`
		update kh_activity set
			person_lo = least(case when person_lo = ${fromId} then person_hi else person_lo end, ${toId}::uuid),
			person_hi = greatest(case when person_lo = ${fromId} then person_hi else person_lo end, ${toId}::uuid)
		where person_lo = ${fromId} or person_hi = ${fromId}
	`);

	// Their own lists (Task 89): the same category, tag or method becomes one; the rest moves.
	await mergeLists(tx, fromId, toId);

	// Invites (Task 90): one of the two sent the other invited nobody; the rest move.
	await tx.execute(sql`
		delete from kh_invite
		where (person_id = ${fromId} and invited_by = ${toId}) or (person_id = ${toId} and invited_by = ${fromId})
	`);
	await tx.execute(sql`update kh_invite set person_id = ${toId} where person_id = ${fromId}`);
	await tx.execute(sql`update kh_invite set invited_by = ${toId} where invited_by = ${fromId}`);

	// Contacts the one who goes had added.
	await tx
		.update(khPerson)
		.set({ createdBy: null })
		.where(and(eq(khPerson.id, toId), eq(khPerson.createdBy, fromId)));
	await tx.update(khPerson).set({ createdBy: toId }).where(eq(khPerson.createdBy, fromId));

	// The account, its profile and the address go to the one who stays, when it has none.
	const takeUser = from.userId !== null && to.userId === null;
	const takeEmail = from.email !== null && to.email === null;
	if (takeUser || takeEmail) {
		await tx
			.update(khPerson)
			.set({ ...(takeUser ? { userId: null } : {}), ...(takeEmail ? { email: null } : {}) })
			.where(eq(khPerson.id, fromId));
		await tx
			.update(khPerson)
			.set({ ...(takeUser ? { userId: from.userId } : {}), ...(takeEmail ? { email: from.email } : {}) })
			.where(eq(khPerson.id, toId));
		if (takeUser) await tx.update(khProfile).set({ personId: toId }).where(eq(khProfile.personId, fromId));
	}
	await tx.delete(khPerson).where(eq(khPerson.id, fromId));

	// Expenses that named both: the debts are worked out again, and where the split's inputs
	// can't be told apart any more, the split becomes the shares it gave.
	for (const expenseId of sharedIds) {
		if (resplit.has(expenseId)) {
			const shares = await tx
				.select({ person: khExpenseShare.personId, amount: khExpenseShare.owedMinor })
				.from(khExpenseShare)
				.where(eq(khExpenseShare.expenseId, expenseId))
				.orderBy(khExpenseShare.position);
			const split: Split = { method: "exact", parts: shares };
			await tx.execute(sql`update kh_expense set split = ${JSON.stringify(split)}::jsonb where id = ${expenseId}`);
		}
		const [expense] = await tx.select().from(khExpense).where(eq(khExpense.id, expenseId));
		if (expense) await writeLedger(tx, { expense });
	}
	await bumpRevs(tx, [toId]);
}

/** The expenses a person paid for and has a share of: all of them, or those among `among`. */
async function expensesNaming(tx: Tx, personId: string, among?: ReadonlyArray<string>) {
	if (among?.length === 0) return { payers: new Set<string>(), shares: new Set<string>() };
	const payers = await tx
		.selectDistinct({ id: khExpensePayer.expenseId })
		.from(khExpensePayer)
		.where(and(eq(khExpensePayer.personId, personId), among ? inArray(khExpensePayer.expenseId, among) : undefined));
	const shares = await tx
		.selectDistinct({ id: khExpenseShare.expenseId })
		.from(khExpenseShare)
		.where(and(eq(khExpenseShare.personId, personId), among ? inArray(khExpenseShare.expenseId, among) : undefined));
	return { payers: new Set(payers.map((row) => row.id)), shares: new Set(shares.map((row) => row.id)) };
}
