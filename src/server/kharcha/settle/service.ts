import "@tanstack/react-start/server-only";
import { waitUntil } from "@vercel/functions";
import { and, desc, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { KHARCHA_NAME } from "@/features/kharcha/brand";
import type { SettleUpInput } from "@/features/kharcha/schema";
import { REMIND_WINDOW_MS } from "@/features/kharcha/settle/remind";
import type { Amount, RemindResult, RemindState, SettleChoice, SettleUp } from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import { localizedUrl } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { getLocale, isLocale, type Locale } from "@/paraglide/runtime";
import { type KhPersonRow, khActivity, khGroup, khGroupMember, khLedger, khProfile, user } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { sendEmail } from "@/server/email/send";
import { errorFields, log } from "@/server/log";
import {
	assertGroupCan,
	type KharchaServices,
	type KharchaUser,
	type Me,
	type ReminderEmail,
	resolveFriend,
	resolveGroup,
	resolveMe,
} from "../access";
import { pairOf, recordActivity } from "../activity";
import { friendsOf } from "../friends/service";
import { groupSettlementsOf } from "../groups/service";
import { byCurrency, pairBalances } from "../ledger";
import { loadPeople } from "../people";
import { bumpRevs } from "../rev";
import { getSettings } from "../settings";

/**
 * Kharcha's settling up (docs/guides/kharcha.md "Balances and settling up", Task 91,
 * decision 0285): what the settle-up dialog offers (each open debt as the payment that would
 * clear it, in its group or outside groups), and reminding a friend of what they owe, by
 * email, once a day. Recording the payment itself is the payments service's.
 */

/** The caller's choices first, then the rest, each list in the order it came. */
const mineFirst = (me: Me, choices: SettleChoice[]) => [
	...choices.filter((choice) => choice.fromId === me.personId || choice.toId === me.personId),
	...choices.filter((choice) => choice.fromId !== me.personId && choice.toId !== me.personId),
];

/** A balance between the caller and someone as the payment that clears it. */
const clearing = (
	me: Me,
	other: string,
	scope: { groupId: string | null; group: string | null },
	amount: Amount,
): SettleChoice =>
	amount.amountMinor > 0
		? { ...scope, fromId: other, toId: me.personId, amountMinor: amount.amountMinor, currency: amount.currency }
		: { ...scope, fromId: me.personId, toId: other, amountMinor: -amount.amountMinor, currency: amount.currency };

/** How people asked to be paid: their profiles' pay notes, only the ones they wrote. */
async function payNotesOf(db: Db | Tx, personIds: ReadonlyArray<string>): Promise<Record<string, string>> {
	if (personIds.length === 0) return {};
	const rows = await db
		.select({ personId: khProfile.personId, payNote: khProfile.payNote })
		.from(khProfile)
		.where(and(inArray(khProfile.personId, [...new Set(personIds)]), ne(khProfile.payNote, "")));
	return Object.fromEntries(rows.map((row) => [row.personId, row.payNote]));
}

/** One person's pay note, or empty. */
export async function payNoteOf(db: Db | Tx, personId: string): Promise<string> {
	return (await payNotesOf(db, [personId]))[personId] ?? "";
}

/**
 * The groups the caller is a current member of that aren't archived, among `ids`, by id:
 * where a payment can still be recorded.
 */
async function openGroupsOf(tx: Tx, me: Me, ids: ReadonlyArray<string>) {
	if (ids.length === 0) return new Map<string, typeof khGroup.$inferSelect>();
	const rows = await tx
		.select({ group: khGroup })
		.from(khGroupMember)
		.innerJoin(khGroup, eq(khGroup.id, khGroupMember.groupId))
		.where(
			and(
				eq(khGroupMember.personId, me.personId),
				isNull(khGroupMember.leftAt),
				isNull(khGroup.archivedAt),
				inArray(khGroupMember.groupId, [...ids]),
			),
		);
	return new Map(rows.map((row) => [row.group.id, row.group]));
}

/**
 * The settle-up dialog's options (Task 91):
 * - in a group (a current member's): its suggestions, simplified or pair by pair;
 * - with a friend: the balance between the two outside groups, and in each open group both are in;
 * - neither (the + menu): every balance the caller has outside groups, and each open group's
 *   suggestions that name them.
 * The pickers offer a group's current members, or the caller and their friends.
 */
export async function getSettleUp({ db, user }: KharchaServices, input: SettleUpInput): Promise<SettleUp> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		if (input.groupId) {
			const access = await resolveGroup(tx, me, input.groupId);
			assertGroupCan(access, "edit");
			const { group } = access;
			const { memberIds, nets } = await groupSettlementsOf(tx, group);
			const scope = { groupId: group.id, group: group.name };
			const choices = nets.flatMap((net) =>
				net.suggested.map(
					(transfer): SettleChoice => ({
						...scope,
						fromId: transfer.from,
						toId: transfer.to,
						amountMinor: transfer.amount,
						currency: net.currency,
					}),
				),
			);
			const people = await loadPeople(tx, me.personId, [...memberIds, ...choices.flatMap((c) => [c.fromId, c.toId])]);
			return {
				group: { id: group.id, name: group.name, currency: group.currency },
				choices: mineFirst(me, choices),
				people,
				pickable: memberIds,
				payNotes: await payNotesOf(tx, memberIds),
			};
		}

		const friends = await friendsOf(tx, me);
		const choices: SettleChoice[] = [];
		if (input.personId) {
			const { person } = await resolveFriend(tx, me, input.personId);
			const rows = await tx
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
					or(
						and(eq(khLedger.creditorId, me.personId), eq(khLedger.debtorId, person.id)),
						and(eq(khLedger.creditorId, person.id), eq(khLedger.debtorId, me.personId)),
					),
				)
				.groupBy(khLedger.groupId, khLedger.currency);
			const groupIds = [...new Set(rows.flatMap((row) => (row.groupId ? [row.groupId] : [])))];
			const open = await openGroupsOf(tx, me, groupIds);
			const theirs = new Set(
				groupIds.length === 0
					? []
					: (
							await tx
								.select({ groupId: khGroupMember.groupId })
								.from(khGroupMember)
								.where(
									and(
										eq(khGroupMember.personId, person.id),
										isNull(khGroupMember.leftAt),
										inArray(khGroupMember.groupId, groupIds),
									),
								)
						).map((row) => row.groupId),
			);
			for (const row of rows.sort(byCurrency)) {
				if (row.amount === 0) continue;
				const group = row.groupId ? open.get(row.groupId) : null;
				if (row.groupId && (!group || !theirs.has(row.groupId))) continue;
				const scope = { groupId: group?.id ?? null, group: group?.name ?? null };
				choices.push(clearing(me, person.id, scope, { currency: row.currency, amountMinor: row.amount }));
			}
			// Outside groups first, then the groups by name.
			choices.sort((a, b) => (a.group ?? "").localeCompare(b.group ?? ""));
		} else {
			for (const balance of (await pairBalances(tx, me.personId, { groupId: null })).sort(byCurrency)) {
				choices.push(clearing(me, balance.personId, { groupId: null, group: null }, balance));
			}
			const mine = await tx
				.selectDistinct({ groupId: khLedger.groupId })
				.from(khLedger)
				.where(
					and(
						isNotNull(khLedger.groupId),
						or(eq(khLedger.creditorId, me.personId), eq(khLedger.debtorId, me.personId)),
					),
				);
			const open = await openGroupsOf(
				tx,
				me,
				mine.flatMap((row) => (row.groupId ? [row.groupId] : [])),
			);
			for (const group of [...open.values()].sort((a, b) => a.name.localeCompare(b.name))) {
				const { nets } = await groupSettlementsOf(tx, group);
				for (const net of nets) {
					for (const transfer of net.suggested) {
						if (transfer.from !== me.personId && transfer.to !== me.personId) continue;
						choices.push({
							groupId: group.id,
							group: group.name,
							fromId: transfer.from,
							toId: transfer.to,
							amountMinor: transfer.amount,
							currency: net.currency,
						});
					}
				}
			}
		}
		const pickable = [me.personId, ...friends.map((friend) => friend.person.id)];
		const people = await loadPeople(tx, me.personId, [...pickable, ...choices.flatMap((c) => [c.fromId, c.toId])]);
		return {
			group: null,
			choices,
			people,
			pickable,
			payNotes: await payNotesOf(
				tx,
				people.map((person) => person.id),
			),
		};
	});
}

/** The real email, in the background after the commit; a failure is logged. */
export function sendReminderEmail(email: ReminderEmail): void {
	waitUntil(
		sendEmail({
			to: email.to,
			template: "kharcha-reminder",
			locale: email.locale,
			siteName: KHARCHA_NAME,
			data: email.data,
		})
			.then(() => undefined)
			.catch((error: unknown) => {
				log("error", "kharcha reminder email failed", errorFields(error));
			}),
	);
}

/** Where a reminder can go: the account's address, or the one the contact was added with. */
async function addressOf(db: Db | Tx, person: KhPersonRow): Promise<{ email: string; locale: Locale | null } | null> {
	if (person.userId) {
		const [row] = await db
			.select({ email: user.email, anonymous: user.isAnonymous, locale: khProfile.locale })
			.from(user)
			.leftJoin(khProfile, eq(khProfile.userId, user.id))
			.where(eq(user.id, person.userId));
		if (!row || row.anonymous) return null;
		return { email: row.email, locale: row.locale && isLocale(row.locale) ? row.locale : null };
	}
	return person.email ? { email: person.email, locale: null } : null;
}

/** The caller's latest reminder to someone. */
async function lastReminder(db: Db | Tx, me: Me, personId: string): Promise<Date | null> {
	const [row] = await db
		.select({ at: khActivity.at })
		.from(khActivity)
		.where(
			and(
				eq(khActivity.kind, "friend.reminded"),
				eq(khActivity.actorId, me.personId),
				eq(khActivity.subjectId, personId),
			),
		)
		.orderBy(desc(khActivity.at))
		.limit(1);
	return row?.at ?? null;
}

/** Whether reminders can be sent at all by the caller: on, not a guest, not blocked. */
async function mayRemind(db: Db | Tx, me: Me, caller: KharchaUser): Promise<"ok" | "off" | "guest" | "blocked"> {
	if (caller.isGuest) return "guest";
	if (!(await getSettings(db)).reminders) return "off";
	const [profile] = await db
		.select({ blocked: khProfile.invitesBlockedAt })
		.from(khProfile)
		.where(eq(khProfile.userId, me.id));
	return profile?.blocked ? "blocked" : "ok";
}

/** What a friend owes the caller in all, per currency (only what they owe). */
async function owedBy(db: Db | Tx, me: Me, personId: string): Promise<Amount[]> {
	return (await pairBalances(db, me.personId, { otherId: personId }))
		.filter((balance) => balance.amountMinor > 0)
		.map((balance) => ({ currency: balance.currency, amountMinor: balance.amountMinor }))
		.sort(byCurrency);
}

/** The friend's page's Remind button (Task 91): whether it shows, and the caller's last reminder. */
export async function remindState(tx: Tx, me: Me, caller: KharchaUser, person: KhPersonRow): Promise<RemindState> {
	const last = await lastReminder(tx, me, person.id);
	const available =
		(await mayRemind(tx, me, caller)) === "ok" &&
		(await addressOf(tx, person)) !== null &&
		(await owedBy(tx, me, person.id)).length > 0;
	return { available, lastAt: last?.toISOString() ?? null };
}

/**
 * Reminds a friend of what they owe the caller (Task 91): an email to their account's
 * address, or a contact's, with the amounts and the caller's pay note. Once a day per
 * friend, while the admin has reminders on; never from a guest or a blocked sender. It
 * writes a line in the two people's thread.
 */
export async function remindFriend(
	{ db, user: caller, sendReminder = sendReminderEmail }: KharchaServices,
	personId: string,
	now = new Date(),
): Promise<RemindResult> {
	const email = await db.transaction(async (tx) => {
		const me = await resolveMe(tx, caller);
		const { person } = await resolveFriend(tx, me, personId);
		const allowed = await mayRemind(tx, me, caller);
		if (allowed === "guest") {
			throw ruleError("FORBIDDEN", "Kharcha: guests don't remind", m.kharcha_error_guest_remind());
		}
		if (allowed === "off") throw ruleError("FORBIDDEN", "Kharcha: reminders are off", m.kharcha_error_reminders_off());
		if (allowed === "blocked") {
			throw ruleError("FORBIDDEN", "Kharcha: reminders blocked", m.kharcha_error_reminders_blocked());
		}
		const amounts = await owedBy(tx, me, person.id);
		if (amounts.length === 0) {
			throw ruleError("BAD_REQUEST", "Kharcha: nothing owed", m.kharcha_error_remind_nothing());
		}
		const address = await addressOf(tx, person);
		if (!address) throw ruleError("BAD_REQUEST", "Kharcha: no address", m.kharcha_error_no_email());
		// One a day: the row lock on the caller's profile makes two at once wait for each other.
		await tx.select({ id: khProfile.userId }).from(khProfile).where(eq(khProfile.userId, me.id)).for("update");
		const [recent] = await tx
			.select({ id: khActivity.id })
			.from(khActivity)
			.where(
				and(
					eq(khActivity.kind, "friend.reminded"),
					eq(khActivity.actorId, me.personId),
					eq(khActivity.subjectId, person.id),
					gt(khActivity.at, new Date(now.getTime() - REMIND_WINDOW_MS)),
				),
			)
			.limit(1);
		if (recent) throw ruleError("RATE_LIMITED", "Kharcha: reminded today", m.kharcha_error_reminded_today());
		await recordActivity(
			tx,
			me.personId,
			{ groupId: null, pair: pairOf([me.personId, person.id]) },
			{ kind: "friend.reminded", subjectId: person.id },
		);
		await bumpRevs(tx, [me.personId, person.id]);
		const locale = address.locale ?? getLocale();
		const payNote = await payNoteOf(tx, me.personId);
		return {
			to: address.email,
			locale,
			data: {
				sender: me.person.displayName,
				amounts,
				payNote: payNote || undefined,
				url: localizedUrl(person.userId ? `/app/kharcha/f/${me.personId}` : "/app/kharcha", locale),
			},
		} satisfies ReminderEmail;
	});
	sendReminder(email);
	return { remindedAt: now.toISOString() };
}
