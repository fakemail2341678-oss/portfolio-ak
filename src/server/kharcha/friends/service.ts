import "@tanstack/react-start/server-only";
import { and, asc, eq } from "drizzle-orm";
import type { AddFriendInput, FriendEmailInput, UpdateFriendInput } from "@/features/kharcha/schema";
import type { Amount, FriendView } from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { type KhFriendRow, type KhPersonRow, khFriend, khPerson } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { type KharchaServices, type KharchaUser, type Me, resolveFriend, resolveMe } from "../access";
import { pairOf, recordActivity } from "../activity";
import { assertCanInvite, makeInvite, openInvites, sendInviteEmail } from "../invites/service";
import { byCurrency, pairBalances } from "../ledger";
import { befriend, insertContact, mergePerson, personByEmail, personDto } from "../people";
import { bumpRevs } from "../rev";
import { assertQuota, getSettings, quotasFor } from "../settings";

/**
 * Kharcha's friends (docs/guides/kharcha.md "People"): the people the caller splits with.
 * A friend is added by name only (a contact private to the caller) or by address (one
 * person per address, shared by everyone who adds it); the first debt between two people
 * makes them friends too. Balances with a friend are per currency, over everything
 * between the two, in groups and outside. Someone with an address and no account can be
 * invited (src/server/kharcha/invites/service.ts).
 */

type FriendRow = { person: KhPersonRow; friend: KhFriendRow };
type OpenInvite = FriendView["invite"];

const friendView = (me: Me, row: FriendRow, balances: Amount[], invite: OpenInvite): FriendView => {
	const mine = row.person.createdBy === me.personId;
	const joined = row.person.userId !== null;
	return {
		person: personDto(row.person, me.personId, row.friend.nickname),
		nickname: row.friend.nickname,
		hidden: row.friend.hidden,
		// The address only goes back to whoever typed it: the contact's creator.
		email: mine ? row.person.email : null,
		balances,
		canInvite: !me.isGuest && !joined && row.person.email !== null,
		canAddEmail: !me.isGuest && mine && !joined && row.person.email === null,
		invite: joined ? null : invite,
	};
};

/** The caller's friends by name, each with what is between the two per currency. */
export async function friendsOf(db: Db | Tx, me: Me): Promise<FriendView[]> {
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
	const invites = await openInvites(
		db,
		me.personId,
		rows.map((row) => row.person.id),
	);
	return rows
		.map((row) =>
			friendView(me, row, (balances.get(row.person.id) ?? []).sort(byCurrency), invites.get(row.person.id) ?? null),
		)
		.sort((a, b) => a.person.name.localeCompare(b.person.name));
}

export async function listFriends({ db, user }: KharchaServices): Promise<FriendView[]> {
	return friendsOf(db, await resolveMe(db, user));
}

/** One friend as the caller sees them (their page's header). */
export async function oneFriend(tx: Db | Tx, me: Me, personId: string): Promise<FriendView> {
	const row = await resolveFriend(tx, me, personId);
	const balances = await pairBalances(tx, me.personId, { otherId: personId });
	const invites = await openInvites(tx, me.personId, [personId]);
	return friendView(
		me,
		row,
		balances.map((balance) => ({ currency: balance.currency, amountMinor: balance.amountMinor })).sort(byCurrency),
		invites.get(personId) ?? null,
	);
}

export async function getFriend({ db, user }: KharchaServices, personId: string): Promise<FriendView> {
	return db.transaction(async (tx) => oneFriend(tx, await resolveMe(tx, user), personId));
}

/**
 * Makes someone the caller's friend in their transaction (adding a friend, or someone new
 * in a group). By name only, a new contact private to the caller. By address, the one
 * person that address has: if somebody added it before, the caller's `name` becomes their
 * own nickname for them, so neither the account's name nor whether anyone else added the
 * address shows. Whether the person has joined Kharcha does (`hasAccount`): it decides
 * between "invite" and nothing. Guests add names only (PLAN 14.2: a closed world).
 */
export async function befriendNew(
	tx: Tx,
	me: Me,
	user: KharchaUser,
	input: { name: string; email?: string | undefined },
): Promise<KhPersonRow> {
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
	return person;
}

/** Adds a friend; with `invite`, someone with an address and no account is emailed an invite too. */
export async function addFriend(
	{ db, user, sendInvite = sendInviteEmail }: KharchaServices,
	input: AddFriendInput,
): Promise<FriendView> {
	const inviting = Boolean(input.invite && input.email);
	if (inviting) await assertCanInvite(db, user);
	const { view, email } = await db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const person = await befriendNew(tx, me, user, input);
		const made =
			inviting && person.userId === null
				? await makeInvite(tx, me, person, { groupId: null, group: null, send: true })
				: null;
		return { view: await oneFriend(tx, me, person.id), email: made?.email ?? null };
	});
	if (email) sendInvite(email);
	return view;
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

/**
 * An address for a contact the caller added by name (Task 90). When somebody already has
 * that address, the contact is merged into them (`mergePerson`): one person per address,
 * so whoever it is sees what the caller split with them once they join. The caller's
 * name for the contact stays theirs, as a nickname. Only the contact's creator, never a
 * guest, and never for someone who has joined.
 */
export async function setFriendEmail(
	{ db, user, sendInvite = sendInviteEmail }: KharchaServices,
	input: FriendEmailInput,
): Promise<FriendView> {
	if (user.isGuest) throw ruleError("FORBIDDEN", "Kharcha: guests add names only", m.kharcha_error_guest_email());
	if (input.invite) await assertCanInvite(db, user);
	const { view, email } = await db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const { person, friend } = await resolveFriend(tx, me, input.personId);
		if (person.createdBy !== me.personId || person.email !== null || person.userId !== null) {
			throw ruleError("FORBIDDEN", "Kharcha: not a contact of the caller's", m.kharcha_error_not_contact());
		}
		const address = input.email.trim().toLowerCase();
		const [owner] = await tx.select().from(khPerson).where(eq(khPerson.email, address));
		if (owner?.id === me.personId) {
			throw ruleError("BAD_REQUEST", "Kharcha: the caller's own address", m.kharcha_error_self());
		}
		let target: KhPersonRow;
		if (owner) {
			await mergePerson(tx, person.id, owner.id);
			// The caller keeps calling them what they did.
			await tx
				.update(khFriend)
				.set({ nickname: friend.nickname || person.displayName })
				.where(and(eq(khFriend.ownerId, me.personId), eq(khFriend.friendId, owner.id), eq(khFriend.nickname, "")));
			target = owner;
		} else {
			const [updated] = await tx.update(khPerson).set({ email: address }).where(eq(khPerson.id, person.id)).returning();
			target = updated ?? person;
		}
		await bumpRevs(tx, [me.personId, target.id]);
		const made =
			input.invite && target.userId === null
				? await makeInvite(tx, me, { ...target, email: address }, { groupId: null, group: null, send: true })
				: null;
		return { view: await oneFriend(tx, me, target.id), email: made?.email ?? null };
	});
	if (email) sendInvite(email);
	return view;
}
