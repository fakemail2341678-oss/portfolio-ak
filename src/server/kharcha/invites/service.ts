import "@tanstack/react-start/server-only";
import { createHash, randomBytes } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { KHARCHA_NAME } from "@/features/kharcha/brand";
import type { InviteResult, JoinedInvite, JoinInvite } from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import { localizedUrl } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { notFound } from "@/server/db/crud";
import { type KhPersonRow, khGroup, khInvite, khPerson, khProfile, user } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { sendEmail } from "@/server/email/send";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { errorFields, log } from "@/server/log";
import {
	assertGroupCan,
	type InviteEmail,
	type KharchaServices,
	type KharchaUser,
	type Me,
	resolveFriend,
	resolveGroup,
	resolveMe,
} from "../access";
import { pairOf, recordActivity } from "../activity";
import { claimContactMail, unsubscribeHeaders, unsubscribeUrl } from "../notify/contact-mail";
import { ensurePerson, mergePerson, personOfUser } from "../people";
import { bumpRevs } from "../rev";
import { currentMemberIds } from "../rules";
import { getSettings } from "../settings";

/**
 * Kharcha's invites and joining (docs/guides/kharcha.md "Invites and joining", decision
 * 0284). A friend with an address and no account can be sent a link: single use, 14 days,
 * only its SHA-256 stored. Whoever opens it signed in, and confirms, becomes that person
 * (`mergePerson`), with every balance that was waiting. Signing in with the address,
 * verified, joins without a link. Guests neither send nor take invites (PLAN 14.2).
 */

export const INVITE_DAYS = 14;
/** Invites one person sends: 20 a day (PLAN 14.5 "Rate limits"). */
export const INVITE_LIMIT = { max: 20, windowSeconds: 24 * 60 * 60 };
/** Lookups of `/join/$token` per visitor, before anyone is signed in. */
export const JOIN_LOOKUP_LIMIT = { max: 30, windowSeconds: 10 * 60 };

/** 24 random bytes: 32 characters of base64url (`JOIN_TOKEN` in src/features/kharcha/search.ts). */
export const newInviteToken = () => randomBytes(24).toString("base64url");
export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** The real email, in the background after the commit; a failure is logged (the link can still be shared). */
export function sendInviteEmail(email: InviteEmail): void {
	waitUntil(
		sendEmail({
			to: email.to,
			template: "kharcha-invite",
			locale: email.locale,
			siteName: KHARCHA_NAME,
			data: email.data,
			...(email.data.unsubscribeUrl ? { headers: unsubscribeHeaders(email.data.unsubscribeUrl) } : {}),
		})
			.then(() => undefined)
			.catch((error: unknown) => {
				log("error", "kharcha invite email failed", errorFields(error));
			}),
	);
}

const refuseGuest = () => ruleError("FORBIDDEN", "Kharcha: guests don't invite", m.kharcha_error_guest_invite());

/** Before an invite's transaction: guests send none, and nobody more than 20 a day. */
export async function assertCanInvite(db: Db, user: KharchaUser): Promise<void> {
	if (user.isGuest) throw refuseGuest();
	await enforceRateLimit(db, `kharcha-invite:${user.id}`, INVITE_LIMIT);
}

type Made = { result: InviteResult; email: InviteEmail | null };

/**
 * Makes an invite for `person` (a friend of the caller's, checked) in the caller's
 * transaction. Refused when invites are off, the caller is blocked from sending them, the
 * person has joined already or has no address. An older open invite of the caller's to
 * them stops working. `send` emails it, unless they unsubscribed or got an email from Kharcha
 * in the last day, an invite or a reminder (PLAN 14.5: "never more than one a day"); the link works either way.
 */
export async function makeInvite(
	tx: Tx,
	me: Me,
	person: KhPersonRow,
	options: { groupId: string | null; group: string | null; send: boolean },
	now = new Date(),
): Promise<Made> {
	const settings = await getSettings(tx);
	if (!settings.invites) throw ruleError("FORBIDDEN", "Kharcha: invites are off", m.kharcha_error_invites_off());
	const [profile] = await tx
		.select({ blocked: khProfile.invitesBlockedAt })
		.from(khProfile)
		.where(eq(khProfile.userId, me.id));
	if (profile?.blocked) throw ruleError("FORBIDDEN", "Kharcha: invites blocked", m.kharcha_error_invites_blocked());
	if (person.userId !== null) throw ruleError("CONFLICT", "Kharcha: already joined", m.kharcha_error_joined());
	if (!person.email) throw ruleError("BAD_REQUEST", "Kharcha: no address", m.kharcha_error_no_email());

	await tx
		.update(khInvite)
		.set({ expiresAt: now })
		.where(
			and(
				eq(khInvite.personId, person.id),
				eq(khInvite.invitedBy, me.personId),
				isNull(khInvite.acceptedAt),
				gt(khInvite.expiresAt, now),
			),
		);
	// One email a day to someone without an account, of any kind, and none once they unsubscribed (Task 92).
	const sent = options.send && (await claimContactMail(tx, person.id, now)) === "ok";
	const token = newInviteToken();
	const expiresAt = new Date(now.getTime() + INVITE_DAYS * 86_400_000);
	await tx.insert(khInvite).values({
		personId: person.id,
		email: person.email,
		invitedBy: me.personId,
		groupId: options.groupId,
		tokenHash: hashInviteToken(token),
		expiresAt,
		sentAt: sent ? now : null,
	});
	await bumpRevs(tx, [me.personId]);
	const locale = getLocale();
	const url = localizedUrl(`/app/kharcha/join/${token}`, locale);
	return {
		result: { url, expiresAt: expiresAt.toISOString(), sent },
		email: sent
			? {
					to: person.email,
					locale,
					data: {
						inviter: me.person.displayName,
						group: options.group ?? undefined,
						url,
						expiresInDays: INVITE_DAYS,
						unsubscribeUrl: unsubscribeUrl(person.id, locale),
					},
				}
			: null,
	};
}

/** A link for one of the caller's friends, from one of their groups or not; `send` emails it. */
export async function inviteFriend(
	{ db, user, sendInvite = sendInviteEmail }: KharchaServices,
	input: { personId: string; groupId?: string | null | undefined; send?: boolean | undefined },
): Promise<InviteResult> {
	await assertCanInvite(db, user);
	const made = await db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const { person } = await resolveFriend(tx, me, input.personId);
		let group: string | null = null;
		if (input.groupId) {
			const access = await resolveGroup(tx, me, input.groupId);
			assertGroupCan(access, "edit");
			if (!(await currentMemberIds(tx, input.groupId)).includes(person.id)) {
				throw ruleError("BAD_REQUEST", "Kharcha: not a member of the group", m.kharcha_error_not_member());
			}
			group = access.group.name;
		}
		return makeInvite(tx, me, person, { groupId: input.groupId ?? null, group, send: input.send ?? false });
	});
	if (made.email) sendInvite(made.email);
	return made.result;
}

/** The invite behind a token, whatever its state; null when no invite has it. */
async function inviteByToken(db: Db | Tx, token: string) {
	const [row] = await db
		.select()
		.from(khInvite)
		.where(eq(khInvite.tokenHash, hashInviteToken(token)));
	return row ?? null;
}

/**
 * What `/join/$token` shows anyone holding the link (rate limited per visitor): who sent
 * it, the group it came from, and whether it can still be used. Nothing else: not the
 * address, not the balances. NOT_FOUND when no invite has the token.
 */
export async function lookupInvite(
	{ db }: { db: Db },
	token: string,
	visitor: string | null,
	now = new Date(),
): Promise<JoinInvite> {
	await enforceRateLimit(db, `kharcha-join:${visitor ?? "unknown"}`, JOIN_LOOKUP_LIMIT);
	const invite = await inviteByToken(db, token);
	if (!invite) throw notFound("Invite");
	const [inviter] = await db
		.select({ name: khPerson.displayName, color: khPerson.color })
		.from(khPerson)
		.where(eq(khPerson.id, invite.invitedBy));
	const [group] = invite.groupId
		? await db
				.select({ name: khGroup.name, color: khGroup.color, icon: khGroup.icon })
				.from(khGroup)
				.where(eq(khGroup.id, invite.groupId))
		: [];
	if (!inviter) throw notFound("Invite");
	return {
		inviter,
		group: group ?? null,
		status: invite.acceptedAt ? "accepted" : invite.expiresAt <= now ? "expired" : "open",
		expiresAt: invite.expiresAt.toISOString(),
	};
}

/** "Asha joined": in the thread with each inviter, and in the group an invite came from. */
async function recordJoined(
	tx: Tx,
	personId: string,
	invites: ReadonlyArray<{ invitedBy: string; groupId: string | null }>,
): Promise<string[]> {
	const touched = new Set<string>([personId]);
	const inviters = [...new Set(invites.map((invite) => invite.invitedBy))].filter((id) => id !== personId);
	for (const inviter of inviters) {
		await recordActivity(
			tx,
			personId,
			{ groupId: null, pair: pairOf([personId, inviter]) },
			{ kind: "friend.joined", subjectId: personId },
		);
		touched.add(inviter);
	}
	for (const groupId of [...new Set(invites.flatMap((invite) => (invite.groupId ? [invite.groupId] : [])))]) {
		const members = await currentMemberIds(tx, groupId);
		if (!members.includes(personId)) continue;
		await recordActivity(tx, personId, { groupId, pair: null }, { kind: "friend.joined", subjectId: personId });
		for (const id of members) touched.add(id);
	}
	return [...touched];
}

/**
 * Takes an invite, after the page's confirm: the person it was sent to becomes the caller,
 * with everything that was theirs (`mergePerson`). Single use; refused once used, once
 * expired, for the inviter themselves, for a person someone else already joined as, and
 * for guests (they sign up first).
 */
export async function acceptInvite(
	{ db, user }: KharchaServices,
	token: string,
	now = new Date(),
): Promise<JoinedInvite> {
	if (user.isGuest) throw ruleError("FORBIDDEN", "Kharcha: guests join after signing up", m.kharcha_error_guest_join());
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const [invite] = await tx
			.select()
			.from(khInvite)
			.where(eq(khInvite.tokenHash, hashInviteToken(token)))
			.for("update");
		if (!invite) throw notFound("Invite");
		if (invite.acceptedAt) throw ruleError("FORBIDDEN", "Kharcha invite: used", m.kharcha_error_invite_used());
		if (invite.expiresAt <= now)
			throw ruleError("FORBIDDEN", "Kharcha invite: expired", m.kharcha_error_invite_expired());
		if (invite.invitedBy === me.personId) {
			throw ruleError("FORBIDDEN", "Kharcha invite: the inviter's own", m.kharcha_error_invite_own());
		}
		const [person] = await tx.select().from(khPerson).where(eq(khPerson.id, invite.personId));
		if (!person) throw notFound("Invite");
		if (person.userId !== null && person.userId !== user.id) {
			throw ruleError("FORBIDDEN", "Kharcha invite: someone joined as them", m.kharcha_error_invite_used());
		}
		if (person.id !== me.personId) await mergePerson(tx, person.id, me.personId);
		await tx.update(khInvite).set({ acceptedAt: now, acceptedBy: user.id }).where(eq(khInvite.id, invite.id));
		// Other links to the same person can't make anyone else them now.
		await tx
			.update(khInvite)
			.set({ expiresAt: now })
			.where(and(eq(khInvite.personId, me.personId), isNull(khInvite.acceptedAt), gt(khInvite.expiresAt, now)));
		await bumpRevs(tx, await recordJoined(tx, me.personId, [invite]));
		const inGroup = invite.groupId ? (await currentMemberIds(tx, invite.groupId)).includes(me.personId) : false;
		return { groupId: inGroup ? invite.groupId : null, inviterId: invite.invitedBy };
	});
}

/**
 * Joining on a verified sign-in (PLAN 14.5 "Joining"): a person somebody added with this
 * account's address becomes the account's. With no person of its own yet, `ensurePerson`
 * takes that one over; with one, the two are merged. Its open invites are marked taken.
 * Returns how many invites that took (0 when nobody was waiting).
 */
export async function joinOnSignIn(db: Db, userId: string, now = new Date()): Promise<number> {
	const [account] = await db
		.select({ email: user.email, verified: user.emailVerified, anonymous: user.isAnonymous })
		.from(user)
		.where(eq(user.id, userId));
	if (!account?.verified || account.anonymous) return 0;
	const address = account.email.trim().toLowerCase();
	const [waiting] = await db
		.select({ id: khPerson.id })
		.from(khPerson)
		.where(and(eq(khPerson.email, address), isNull(khPerson.userId)));
	if (!waiting) return 0;
	return db.transaction(async (tx) => {
		const own = await personOfUser(tx, userId);
		const personId = own ? own.id : (await ensurePerson(tx, userId)).id;
		if (own && own.id !== waiting.id) await mergePerson(tx, waiting.id, own.id);
		const taken = await tx
			.update(khInvite)
			.set({ acceptedAt: now, acceptedBy: userId })
			.where(and(eq(khInvite.personId, personId), isNull(khInvite.acceptedAt)))
			.returning({ invitedBy: khInvite.invitedBy, groupId: khInvite.groupId });
		await bumpRevs(tx, await recordJoined(tx, personId, taken));
		return taken.length;
	});
}

/** Better Auth's `session.create.after` (src/server/auth/auth.ts): never fails a sign-in. */
export async function joinKharchaOnSignIn(
	db: Db,
	session: { userId: string; impersonatedBy?: string | null | undefined },
): Promise<void> {
	// An admin looking as someone else doesn't join on their behalf.
	if (session.impersonatedBy) return;
	try {
		const joined = await joinOnSignIn(db, session.userId);
		if (joined > 0) log("info", "kharcha invite accepted on sign-in", { userId: session.userId, joined });
	} catch (error) {
		log("error", "kharcha join on sign-in failed", { userId: session.userId, ...errorFields(error) });
	}
}

/** The caller's latest open invite to each of `personIds` (FriendView's `invite`). */
export async function openInvites(
	db: Db | Tx,
	meId: string,
	personIds: ReadonlyArray<string>,
	now = new Date(),
): Promise<Map<string, { sentAt: string | null; expiresAt: string }>> {
	const result = new Map<string, { sentAt: string | null; expiresAt: string }>();
	if (personIds.length === 0) return result;
	const rows = await db
		.select({ personId: khInvite.personId, sentAt: khInvite.sentAt, expiresAt: khInvite.expiresAt })
		.from(khInvite)
		.where(
			and(
				eq(khInvite.invitedBy, meId),
				inArray(khInvite.personId, [...personIds]),
				isNull(khInvite.acceptedAt),
				gt(khInvite.expiresAt, now),
			),
		)
		.orderBy(desc(khInvite.createdAt));
	for (const row of rows) {
		if (result.has(row.personId)) continue;
		result.set(row.personId, { sentAt: row.sentAt?.toISOString() ?? null, expiresAt: row.expiresAt.toISOString() });
	}
	return result;
}
