import "@tanstack/react-start/server-only";
import { and, asc, eq } from "drizzle-orm";
import type { AddFriendInput, UpdateFriendInput } from "@/features/kharcha/schema";
import type { Amount, FriendView } from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { type KhFriendRow, type KhPersonRow, khFriend, khPerson } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import { type KharchaServices, type Me, resolveFriend, resolveMe } from "../access";
import { pairOf, recordActivity } from "../activity";
import { byCurrency, pairBalances } from "../ledger";
import { befriend, insertContact, personByEmail, personDto } from "../people";
import { bumpRevs } from "../rev";
import { assertQuota, getSettings, quotasFor } from "../settings";

/**
 * Kharcha's friends (docs/guides/kharcha.md "People"): the people the caller splits with.
 * A friend is added by name only (a contact private to the caller) or by address (one
 * person per address, shared by everyone who adds it); the first debt between two people
 * makes them friends too. Balances with a friend are per currency, over everything
 * between the two, in groups and outside.
 */

const friendView = (me: Me, row: { person: KhPersonRow; friend: KhFriendRow }, balances: Amount[]): FriendView => ({
	person: personDto(row.person, me.personId, row.friend.nickname),
	nickname: row.friend.nickname,
	hidden: row.friend.hidden,
	// The address only goes back to whoever typed it: the contact's creator.
	email: row.person.createdBy === me.personId ? row.person.email : null,
	balances,
});

/** The caller's friends by name, each with what is between the two per currency. */
export async function listFriends({ db, user }: KharchaServices): Promise<FriendView[]> {
	const me = await resolveMe(db, user);
	const rows = await db
		.select({ person: khPerson, friend: khFriend })
		.from(khFriend)
		.innerJoin(khPerson, eq(khPerson.id, khFriend.friendId))
		.where(eq(khFriend.ownerId, me.personId))
		.orderBy(asc(khPerson.displayName), asc(khPerson.id));
	const balances = new Map<string, Amount[]>();
	for (const balance of await pairBalances(db, me.personId)) {
		const amounts = balances.get(balance.personId) ?? [];
		amounts.push({ currency: balance.currency, amountMinor: balance.amountMinor });
		balances.set(balance.personId, amounts);
	}
	return rows.map((row) => friendView(me, row, (balances.get(row.person.id) ?? []).sort(byCurrency)));
}

async function oneFriend(tx: Tx, me: Me, personId: string): Promise<FriendView> {
	const row = await resolveFriend(tx, me, personId);
	const balances = await pairBalances(tx, me.personId, { otherId: personId });
	return friendView(
		me,
		row,
		balances.map((balance) => ({ currency: balance.currency, amountMinor: balance.amountMinor })).sort(byCurrency),
	);
}

export async function getFriend({ db, user }: KharchaServices, personId: string): Promise<FriendView> {
	return db.transaction(async (tx) => oneFriend(tx, await resolveMe(tx, user), personId));
}

/**
 * Adds a friend. By name only, a new contact private to the caller. By address, the one
 * person that address has: if somebody added it before, the caller's `name` becomes their
 * own nickname for them, so neither the account's name nor whether anyone else added the
 * address shows. Whether the person has joined Kharcha does (`hasAccount`), as in any
 * bill splitter: it decides between "invite" and nothing (Task 90).
 * Guests add names only (PLAN 14.2: a guest's Kharcha is a closed world).
 */
export async function addFriend({ db, user }: KharchaServices, input: AddFriendInput): Promise<FriendView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		if (input.email && user.isGuest) {
			throw ruleError("FORBIDDEN", "Kharcha: guests add names only", m.kharcha_error_guest_email());
		}
		await assertQuota(tx, `${me.personId}:friends`, {
			table: khFriend,
			where: eq(khFriend.ownerId, me.personId),
			max: quotasFor(await getSettings(tx), user).friends,
		});
		const person = input.email
			? await personByEmail(tx, me.personId, input.email, input.name)
			: await insertContact(tx, me.personId, input.name);
		if (person.id === me.personId) {
			throw ruleError("BAD_REQUEST", "Kharcha: the caller's own address", m.kharcha_error_self());
		}
		const [known] = await tx
			.select({ ownerId: khFriend.ownerId })
			.from(khFriend)
			.where(and(eq(khFriend.ownerId, me.personId), eq(khFriend.friendId, person.id)));
		if (!known) {
			await befriend(tx, [[me.personId, person.id]]);
			if (person.displayName !== input.name) {
				await tx
					.update(khFriend)
					.set({ nickname: input.name })
					.where(and(eq(khFriend.ownerId, me.personId), eq(khFriend.friendId, person.id)));
			}
			await recordActivity(
				tx,
				me.personId,
				{ groupId: null, pair: pairOf([me.personId, person.id]) },
				{ kind: "friend.added", subjectId: person.id },
			);
			await bumpRevs(tx, [me.personId, person.id]);
		}
		return oneFriend(tx, me, person.id);
	});
}

/** The caller's own nickname for a friend, and whether they hide them from their lists. */
export async function updateFriend({ db, user }: KharchaServices, input: UpdateFriendInput): Promise<FriendView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		await resolveFriend(tx, me, input.personId);
		const set = {
			...(input.nickname === undefined ? {} : { nickname: input.nickname }),
			...(input.hidden === undefined ? {} : { hidden: input.hidden }),
		};
		if (Object.keys(set).length > 0) {
			await tx
				.update(khFriend)
				.set(set)
				.where(and(eq(khFriend.ownerId, me.personId), eq(khFriend.friendId, input.personId)));
			await bumpRevs(tx, [me.personId]);
		}
		return oneFriend(tx, me, input.personId);
	});
}
