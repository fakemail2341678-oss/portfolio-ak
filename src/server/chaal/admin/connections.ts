import "@tanstack/react-start/server-only";
import { and, eq, gt, inArray, isNotNull, isNull, lte, or, type SQL, sql } from "drizzle-orm";
import type { ChaalAdminConnection, ChaalAdminConnectionPage, ConnectionState } from "@/features/chaal/admin/schema";
import type { ChaalConnectionListInput } from "@/features/chaal/admin/search";
import { withAudit } from "@/server/db/crud";
import { allOf, orderBySort, paginate, textSearch } from "@/server/db/list";
import { chBlock, chConnection, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { log } from "@/server/log";
import { revokeSealed } from "../connect/service";
import type { ChaalAdminServices } from "./context";

/**
 * /admin/chaal/connections (PLAN Task 79, decision 0268): every connected Lichess account,
 * with its site user, scopes, dates and state; never the token. Revoking asks Lichess to
 * end the token (best effort) and marks the connection revoked, so its player sees
 * "Reconnect"; the row stays for the record until they reconnect or disconnect.
 */

type Joined = {
	connection: typeof chConnection.$inferSelect;
	userName: string;
	userEmail: string;
	guest: boolean | null;
};

/** The state at `now`: revoked (by Lichess or an admin), past its expiry, or active. */
export function connectionState(
	row: Pick<typeof chConnection.$inferSelect, "revokedAt" | "expiresAt">,
	now: number,
): ConnectionState {
	if (row.revokedAt) return "revoked";
	if (row.expiresAt && row.expiresAt.getTime() <= now) return "expired";
	return "active";
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

function stateFilter(state: ChaalConnectionListInput["state"], now: Date): SQL | undefined {
	if (state === "revoked") return isNotNull(chConnection.revokedAt);
	if (state === "expired") return and(isNull(chConnection.revokedAt), lte(chConnection.expiresAt, now));
	if (state === "active") {
		return and(isNull(chConnection.revokedAt), or(isNull(chConnection.expiresAt), gt(chConnection.expiresAt, now)));
	}
	return undefined;
}

function whoFilter(who: ChaalConnectionListInput["who"]): SQL | undefined {
	if (who === "guests") return eq(user.isAnonymous, true);
	if (who === "members") return or(isNull(user.isAnonymous), eq(user.isAnonymous, false));
	return undefined;
}

/** Blocked site users and Lichess accounts among a page's rows. */
async function blockedAmong(db: Db, rows: ReadonlyArray<Joined>) {
	if (rows.length === 0) return { users: new Set<string>(), lichess: new Set<string>() };
	const found = await db
		.select({ userId: chBlock.userId, lichessId: chBlock.lichessId })
		.from(chBlock)
		.where(
			or(
				inArray(
					chBlock.userId,
					rows.map((row) => row.connection.userId),
				),
				inArray(
					chBlock.lichessId,
					rows.map((row) => row.connection.lichessId),
				),
			),
		);
	return {
		users: new Set(found.flatMap((row) => (row.userId ? [row.userId] : []))),
		lichess: new Set(found.flatMap((row) => (row.lichessId ? [row.lichessId] : []))),
	};
}

export async function listConnections(
	{ db }: { db: Db },
	input: ChaalConnectionListInput,
	now: number = Date.now(),
): Promise<ChaalAdminConnectionPage> {
	const where = allOf(
		stateFilter(input.state, new Date(now)),
		whoFilter(input.who),
		textSearch(input.q, [chConnection.username, user.name, user.email]),
	);
	const order = orderBySort(
		input.sort,
		{ connected: chConnection.connectedAt, used: chConnection.lastUsedAt, username: chConnection.lichessId },
		{ tiebreaker: chConnection.userId, fallback: "connected" },
	);
	const page = await paginate(
		input,
		{
			count: async () => {
				const [result] = await db
					.select({ total: sql<number>`count(*)::int` })
					.from(chConnection)
					.innerJoin(user, eq(user.id, chConnection.userId))
					.where(where);
				return result?.total ?? 0;
			},
			rows: ({ limit, offset }) =>
				db
					.select({ connection: chConnection, userName: user.name, userEmail: user.email, guest: user.isAnonymous })
					.from(chConnection)
					.innerJoin(user, eq(user.id, chConnection.userId))
					.where(where)
					.orderBy(...order)
					.limit(limit)
					.offset(offset),
		},
		(row): Joined => row,
	);
	const blocked = await blockedAmong(db, page.items);
	return {
		...page,
		items: page.items.map(({ connection, userName, userEmail, guest }): ChaalAdminConnection => {
			const cooling = connection.cooldownUntil && connection.cooldownUntil.getTime() > now;
			return {
				id: connection.userId,
				userName,
				// A guest's address is made up: it isn't anyone's.
				userEmail: guest ? null : userEmail,
				guest: guest === true,
				lichessId: connection.lichessId,
				username: connection.username,
				title: connection.title,
				scopes: connection.scopes,
				connectedAt: connection.connectedAt.toISOString(),
				lastUsedAt: iso(connection.lastUsedAt),
				expiresAt: iso(connection.expiresAt),
				state: connectionState(connection, now),
				cooldownUntil: cooling ? iso(connection.cooldownUntil) : null,
				blocked: blocked.users.has(connection.userId) || blocked.lichess.has(connection.lichessId),
			};
		}),
	};
}

/**
 * Revokes connections (by their site users' ids): each token is ended at Lichess (best
 * effort: Lichess may be down, and the connection is revoked here either way), then marked
 * revoked. Those already revoked are left alone. Returns how many were revoked now.
 */
export async function revokeConnections(
	services: ChaalAdminServices,
	userIds: ReadonlyArray<string>,
	now: number = Date.now(),
): Promise<{ revoked: number }> {
	const { db, actor } = services;
	const rows = await db
		.select()
		.from(chConnection)
		.where(and(inArray(chConnection.userId, [...userIds]), isNull(chConnection.revokedAt)));
	if (rows.length === 0) return { revoked: 0 };
	const deps = await services.connect();
	// Outside the transaction: a slow Lichess mustn't hold it open.
	for (const row of rows) await revokeSealed(deps, row.token, row.userId);
	const revoked = await withAudit(db, actor, async (tx, audit) => {
		const marked = await tx
			.update(chConnection)
			.set({ revokedAt: new Date(now) })
			.where(
				and(
					inArray(
						chConnection.userId,
						rows.map((row) => row.userId),
					),
					isNull(chConnection.revokedAt),
				),
			)
			.returning({ userId: chConnection.userId, username: chConnection.username, lichessId: chConnection.lichessId });
		audit(
			...marked.map((row) => ({
				action: "chaal.connection.revoke" as const,
				target: { type: "chaal-connection" as const, id: row.userId, label: row.username },
				before: { lichess: row.lichessId },
			})),
		);
		return marked.length;
	});
	log("info", "chaal connections revoked by an admin", { count: revoked });
	return { revoked };
}
