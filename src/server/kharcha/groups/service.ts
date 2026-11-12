import "@tanstack/react-start/server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { simplify } from "@/features/kharcha/money/simplify";
import type { CreateGroupInput, UpdateGroupInput } from "@/features/kharcha/schema";
import {
	GROUP_KIND_ICON,
	type GroupSettings,
	type GroupSummary,
	type GroupView,
	type KharchaColor,
} from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { notFound } from "@/server/db/crud";
import { type KhGroupMemberRow, type KhGroupRow, khGroup, khGroupMember, khPerson } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import {
	assertGroupCan,
	type GroupAccess,
	type KharchaServices,
	type Me,
	resolveFriend,
	resolveGroup,
	resolveMe,
} from "../access";
import { fieldChanges, recordActivity } from "../activity";
import { friendsAmong } from "../expenses/repository";
import { byCurrency, groupNetOf, groupNets, netsByGroup } from "../ledger";
import { loadPeople } from "../people";
import { bumpRevs, saveVersioned } from "../rev";
import { amountList, assertCurrencyOffered, currentMemberIds } from "../rules";
import { assertQuota, getSettings, quotaError, quotasFor } from "../settings";

/**
 * Kharcha's groups and their members (docs/guides/kharcha.md "Groups"). Any current
 * member changes the group's details and adds people; removing someone and archiving are
 * the owner's. Nobody leaves or is removed while they owe or are owed in the group.
 */

const settingsOf = (stored: GroupSettings): Required<GroupSettings> => ({
	defaultSplit: stored.defaultSplit ?? "equal",
	simplify: stored.simplify ?? true,
});

const summary = (
	group: KhGroupRow,
	member: Pick<KhGroupMemberRow, "leftAt">,
	members: number,
	balances: GroupSummary["balances"],
): GroupSummary => ({
	id: group.id,
	name: group.name,
	kind: group.kind,
	color: group.color,
	icon: group.icon,
	currency: group.currency,
	archived: group.archivedAt !== null,
	left: member.leftAt !== null,
	members,
	balances,
});

/** The caller's groups, newest first: those they are in, and those they left (read only). */
export async function listGroups({ db, user }: KharchaServices): Promise<GroupSummary[]> {
	const me = await resolveMe(db, user);
	const rows = await db
		.select({ group: khGroup, member: khGroupMember })
		.from(khGroupMember)
		.innerJoin(khGroup, eq(khGroup.id, khGroupMember.groupId))
		.where(eq(khGroupMember.personId, me.personId))
		.orderBy(desc(khGroup.createdAt), asc(khGroup.id));
	if (rows.length === 0) return [];
	const counts = await db
		.select({ groupId: khGroupMember.groupId, count: sql<number>`count(*)`.mapWith(Number) })
		.from(khGroupMember)
		.where(
			and(
				inArray(
					khGroupMember.groupId,
					rows.map((row) => row.group.id),
				),
				isNull(khGroupMember.leftAt),
			),
		)
		.groupBy(khGroupMember.groupId);
	const members = new Map(counts.map((row) => [row.groupId, row.count]));
	const nets = await netsByGroup(db, me.personId);
	return rows.map((row) =>
		summary(row.group, row.member, members.get(row.group.id) ?? 0, nets.get(row.group.id) ?? []),
	);
}

async function groupView(tx: Tx, me: Me, access: GroupAccess): Promise<GroupView> {
	const { group } = access;
	const rows = await tx
		.select()
		.from(khGroupMember)
		.where(eq(khGroupMember.groupId, group.id))
		.orderBy(asc(khGroupMember.joinedAt), asc(khGroupMember.personId));
	const people = new Map(
		(
			await loadPeople(
				tx,
				me.personId,
				rows.map((row) => row.personId),
			)
		).map((person) => [person.id, person]),
	);
	const order = new Map(rows.map((row, index) => [row.personId, index]));
	const all = await groupNets(tx, group.id);
	const settings = settingsOf(group.settings);
	const nets = [...new Set(all.map((net) => net.currency))].sort().map((currency) => {
		const ofCurrency = all
			.filter((net) => net.currency === currency)
			.sort((a, b) => (order.get(a.personId) ?? 0) - (order.get(b.personId) ?? 0));
		return {
			currency,
			people: ofCurrency.map((net) => ({ personId: net.personId, netMinor: net.netMinor })),
			suggested: settings.simplify
				? simplify(ofCurrency.map((net) => ({ person: net.personId, net: net.netMinor })))
				: [],
		};
	});
	const mine = all
		.filter((net) => net.personId === me.personId)
		.map((net) => ({ currency: net.currency, amountMinor: net.netMinor }))
		.sort(byCurrency);
	return {
		...summary(group, access.member, rows.filter((row) => row.leftAt === null).length, mine),
		startOn: group.startOn,
		endOn: group.endOn,
		settings,
		version: group.version,
		members: rows.flatMap((row) => {
			const person = people.get(row.personId);
			return person
				? [{ person, role: row.role, joinedAt: row.joinedAt.toISOString(), leftAt: row.leftAt?.toISOString() ?? null }]
				: [];
		}),
		nets,
		can: access.can,
	};
}

export async function getGroup({ db, user }: KharchaServices, groupId: string): Promise<GroupView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		return groupView(tx, me, await resolveGroup(tx, me, groupId));
	});
}

export type NewGroup = {
	id?: string | undefined;
	name: string;
	kind: KhGroupRow["kind"];
	color: KharchaColor;
	icon?: KhGroupRow["icon"] | undefined;
	currency: string;
	startOn: string | null;
	endOn: string | null;
	memberIds: string[];
};

/** Writes a new group with its owner and first members, once access is settled (the service, and the sample data). */
export async function addGroup(tx: Tx, ownerId: string, input: NewGroup): Promise<KhGroupRow> {
	const [group] = await tx
		.insert(khGroup)
		.values({
			...(input.id ? { id: input.id } : {}),
			name: input.name,
			kind: input.kind,
			color: input.color,
			icon: input.icon ?? GROUP_KIND_ICON[input.kind],
			currency: input.currency,
			startOn: input.startOn,
			endOn: input.endOn,
			createdBy: ownerId,
		})
		.returning();
	if (!group) throw new Error("kh_group: nothing inserted");
	const others = [...new Set(input.memberIds)].filter((id) => id !== ownerId);
	await tx
		.insert(khGroupMember)
		.values([
			{ groupId: group.id, personId: ownerId, role: "owner" as const },
			...others.map((personId) => ({ groupId: group.id, personId, role: "member" as const })),
		]);
	await recordActivity(
		tx,
		ownerId,
		{ groupId: group.id, pair: null },
		{ kind: "group.created", data: { title: group.name } },
		...others.map((subjectId) => ({ kind: "member.added" as const, subjectId })),
	);
	await bumpRevs(tx, [ownerId, ...others]);
	return group;
}

export async function createGroup({ db, user }: KharchaServices, input: CreateGroupInput): Promise<GroupView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const settings = await getSettings(tx);
		const quotas = quotasFor(settings, user);
		assertCurrencyOffered(settings, input.currency);
		const others = [...new Set(input.memberIds)].filter((id) => id !== me.personId);
		const friends = await friendsAmong(tx, me.personId, others);
		if (!others.every((id) => friends.has(id))) {
			throw ruleError("BAD_REQUEST", "Kharcha: not a friend", m.kharcha_error_not_friend());
		}
		if (others.length + 1 > quotas.groupMembers) throw quotaError("group members", quotas.groupMembers);
		await assertQuota(tx, `${me.personId}:groups`, {
			table: khGroup,
			where: eq(khGroup.createdBy, me.personId),
			max: quotas.groups,
		});
		const group = await addGroup(tx, me.personId, { ...input, memberIds: others });
		return groupView(tx, me, await resolveGroup(tx, me, group.id));
	});
}

/** The group form's save, at the `version` it was loaded with. */
export async function updateGroup({ db, user }: KharchaServices, input: UpdateGroupInput): Promise<GroupView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveGroup(tx, me, input.groupId);
		assertGroupCan(access, "edit");
		const before = access.group;
		if (input.currency !== before.currency) assertCurrencyOffered(await getSettings(tx), input.currency);
		const group = await saveVersioned(tx, khGroup, {
			id: before.id,
			version: input.version,
			what: "Group",
			set: {
				name: input.name,
				kind: input.kind,
				color: input.color,
				icon: input.icon ?? before.icon,
				currency: input.currency,
				startOn: input.startOn,
				endOn: input.endOn,
				settings: { defaultSplit: input.defaultSplit, simplify: input.simplify },
			},
		});
		const scalars = (row: KhGroupRow) => ({
			name: row.name,
			kind: row.kind,
			currency: row.currency,
			startOn: row.startOn,
			endOn: row.endOn,
			simplify: settingsOf(row.settings).simplify,
		});
		await recordActivity(
			tx,
			me.personId,
			{ groupId: group.id, pair: null },
			...fieldChanges("group.updated", scalars(before), scalars(group)),
		);
		await bumpRevs(tx, await currentMemberIds(tx, group.id));
		return groupView(tx, me, { ...access, group });
	});
}

/** Archiving stops new expenses and payments; the history stays. The owner's, and theirs to undo. */
export async function archiveGroup(
	{ db, user }: KharchaServices,
	groupId: string,
	archived: boolean,
): Promise<GroupView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveGroup(tx, me, groupId);
		assertGroupCan(access, "manage");
		if ((access.group.archivedAt !== null) === archived) return groupView(tx, me, access);
		const [group] = await tx
			.update(khGroup)
			.set({ archivedAt: archived ? new Date() : null })
			.where(eq(khGroup.id, groupId))
			.returning();
		if (!group) throw notFound("Group");
		await recordActivity(
			tx,
			me.personId,
			{ groupId, pair: null },
			{ kind: archived ? "group.archived" : "group.unarchived" },
		);
		await bumpRevs(tx, await currentMemberIds(tx, groupId));
		return groupView(tx, me, await resolveGroup(tx, me, groupId));
	});
}

/** Adds one of the caller's friends to the group; someone who left comes back as a member. */
export async function addMember({ db, user }: KharchaServices, groupId: string, personId: string): Promise<GroupView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveGroup(tx, me, groupId);
		assertGroupCan(access, "edit");
		await resolveFriend(tx, me, personId);
		const [existing] = await tx
			.select()
			.from(khGroupMember)
			.where(and(eq(khGroupMember.groupId, groupId), eq(khGroupMember.personId, personId)));
		if (existing && existing.leftAt === null) {
			throw ruleError("CONFLICT", "Kharcha: already a member", m.kharcha_error_member_exists());
		}
		await assertQuota(tx, `${groupId}:members`, {
			table: khGroupMember,
			where: and(eq(khGroupMember.groupId, groupId), isNull(khGroupMember.leftAt)),
			max: quotasFor(await getSettings(tx), user).groupMembers,
		});
		if (existing) {
			await tx
				.update(khGroupMember)
				.set({ leftAt: null, role: "member" })
				.where(and(eq(khGroupMember.groupId, groupId), eq(khGroupMember.personId, personId)));
		} else {
			await tx.insert(khGroupMember).values({ groupId, personId, role: "member" });
		}
		await recordActivity(tx, me.personId, { groupId, pair: null }, { kind: "member.added", subjectId: personId });
		await bumpRevs(tx, await currentMemberIds(tx, groupId));
		return groupView(tx, me, access);
	});
}

/**
 * Refused while the person owes or is owed in the group, with the amounts. Leaving is stamped
 * with the database's clock, as `created_at` is: what a former member still sees is what was
 * made before it (src/server/kharcha/access.ts).
 */
async function assertSettledIn(tx: Tx, groupId: string, personId: string, mine: boolean): Promise<void> {
	const open = await groupNetOf(tx, groupId, personId);
	if (open.length === 0) return;
	throw ruleError(
		"FORBIDDEN",
		"Kharcha: not settled in the group",
		mine
			? m.kharcha_error_unsettled_self({ amounts: amountList(open) })
			: m.kharcha_error_unsettled_member({ amounts: amountList(open) }),
	);
}

/** The owner removes a member who is settled in the group. They keep its history up to now, read only. */
export async function removeMember(
	{ db, user }: KharchaServices,
	groupId: string,
	personId: string,
): Promise<GroupView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveGroup(tx, me, groupId);
		assertGroupCan(access, "manage");
		const [member] = await tx
			.select()
			.from(khGroupMember)
			.where(
				and(eq(khGroupMember.groupId, groupId), eq(khGroupMember.personId, personId), isNull(khGroupMember.leftAt)),
			)
			.for("update");
		// Leaving is its own action (the owner hands the group on).
		if (!member || personId === me.personId) throw notFound("Person");
		await assertSettledIn(tx, groupId, personId, false);
		const before = await currentMemberIds(tx, groupId);
		await tx
			.update(khGroupMember)
			.set({ leftAt: sql`now()` })
			.where(and(eq(khGroupMember.groupId, groupId), eq(khGroupMember.personId, personId)));
		await recordActivity(tx, me.personId, { groupId, pair: null }, { kind: "member.removed", subjectId: personId });
		await bumpRevs(tx, before);
		return groupView(tx, me, access);
	});
}

/**
 * The caller leaves a group they are settled in. An owner hands the group to the member
 * who has been in it longest, one with an account first; the last one out leaves it ownerless.
 */
export async function leaveGroup({ db, user }: KharchaServices, groupId: string): Promise<void> {
	await db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveGroup(tx, me, groupId);
		if (!access.current) {
			throw ruleError("FORBIDDEN", "Kharcha former member: leave", m.kharcha_error_left_group());
		}
		await assertSettledIn(tx, groupId, me.personId, true);
		const before = await currentMemberIds(tx, groupId);
		await tx
			.update(khGroupMember)
			.set({ leftAt: sql`now()`, role: "member" })
			.where(and(eq(khGroupMember.groupId, groupId), eq(khGroupMember.personId, me.personId)));
		if (access.member.role === "owner") {
			const [next] = await tx
				.select({ personId: khGroupMember.personId })
				.from(khGroupMember)
				.innerJoin(khPerson, eq(khPerson.id, khGroupMember.personId))
				.where(and(eq(khGroupMember.groupId, groupId), isNull(khGroupMember.leftAt)))
				.orderBy(sql`${khPerson.userId} is null`, asc(khGroupMember.joinedAt), asc(khGroupMember.personId))
				.limit(1);
			if (next) {
				await tx
					.update(khGroupMember)
					.set({ role: "owner" })
					.where(and(eq(khGroupMember.groupId, groupId), eq(khGroupMember.personId, next.personId)));
			}
		}
		await recordActivity(tx, me.personId, { groupId, pair: null }, { kind: "member.left", subjectId: me.personId });
		await bumpRevs(tx, before);
	});
}
