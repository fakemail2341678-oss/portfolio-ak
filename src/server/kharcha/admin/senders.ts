import "@tanstack/react-start/server-only";
import { desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { KharchaSender, SuspendKharchaSenderInput } from "@/features/kharcha/admin/schema";
import { notFound, withAudit } from "@/server/db/crud";
import { khInvite, khPerson, khProfile, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { Services } from "@/server/services";

/**
 * /admin/kharcha/senders (PLAN Task 96, decision 0290): who sent the most invites in the
 * last 30 days, as counts (never whom they invited), and everyone suspended. Suspending
 * sets `kh_profile.invites_blocked_at`, which the invite and reminder services refuse on
 * (Tasks 90 and 91); both directions are audited.
 */

const DAY_MS = 86_400_000;
/** How many senders the page lists, the busiest first. */
export const TOP_SENDERS = 20;

type Counts = { day: number; month: number; accepted: number };

export async function listSenders(db: Db, now: Date = new Date()): Promise<KharchaSender[]> {
	const month = new Date(now.getTime() - 30 * DAY_MS);
	const day = new Date(now.getTime() - DAY_MS);
	const top = await db
		.select({
			userId: khPerson.userId,
			month: sql<number>`(count(*))::int`,
			day: sql<number>`(count(*) filter (where ${khInvite.createdAt} >= ${day}))::int`,
			accepted: sql<number>`(count(*) filter (where ${khInvite.acceptedAt} is not null))::int`,
		})
		.from(khInvite)
		.innerJoin(khPerson, eq(khPerson.id, khInvite.invitedBy))
		.where(gte(khInvite.createdAt, month))
		.groupBy(khPerson.userId)
		.orderBy(desc(sql`2`))
		.limit(TOP_SENDERS);
	const counts = new Map<string, Counts>();
	for (const { userId, ...row } of top) if (userId) counts.set(userId, row);
	const suspended = await db
		.select({ userId: khProfile.userId })
		.from(khProfile)
		.where(isNotNull(khProfile.invitesBlockedAt));
	const ids = [...new Set([...counts.keys(), ...suspended.map((row) => row.userId)])];
	if (ids.length === 0) return [];
	const accounts = await db
		.select({
			userId: user.id,
			name: user.name,
			email: user.email,
			guest: user.isAnonymous,
			suspendedAt: khProfile.invitesBlockedAt,
		})
		.from(user)
		.leftJoin(khProfile, eq(khProfile.userId, user.id))
		.where(inArray(user.id, ids));
	return accounts
		.map((account) => ({
			id: account.userId,
			name: account.name,
			email: account.email,
			guest: account.guest ?? false,
			...(counts.get(account.userId) ?? { day: 0, month: 0, accepted: 0 }),
			suspendedAt: account.suspendedAt?.toISOString() ?? null,
		}))
		.sort((a, b) => b.month - a.month || a.email.localeCompare(b.email));
}

export async function suspendSender(
	{ db, actor }: Pick<Services, "db" | "actor">,
	{ userId, suspend }: SuspendKharchaSenderInput,
	now: Date = new Date(),
): Promise<void> {
	await withAudit(db, actor, async (tx, audit) => {
		const [found] = await tx
			.select({ email: user.email, blockedAt: khProfile.invitesBlockedAt })
			.from(khProfile)
			.innerJoin(user, eq(user.id, khProfile.userId))
			.where(eq(khProfile.userId, userId));
		if (!found) throw notFound("Kharcha sender");
		if (Boolean(found.blockedAt) === suspend) return;
		await tx
			.update(khProfile)
			.set({ invitesBlockedAt: suspend ? now : null })
			.where(eq(khProfile.userId, userId));
		audit({
			action: suspend ? "kharcha.sender.suspend" : "kharcha.sender.restore",
			target: { type: "user", id: userId, label: found.email },
			before: { suspended: !suspend },
			after: { suspended: suspend },
		});
	});
}
