import "@tanstack/react-start/server-only";
import { eq, inArray, isNotNull, or, type SQL, sql } from "drizzle-orm";
import type { ChaalAdminBlock, ChaalAdminBlockPage, ChaalBlockInput } from "@/features/chaal/admin/schema";
import type { ChaalBlockListInput } from "@/features/chaal/admin/search";
import { AppError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { listPage, withAudit } from "@/server/db/crud";
import { allOf, textSearch } from "@/server/db/list";
import { chBlock, chConnection, user } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { revokeConnections } from "./connections";
import type { ChaalAdminServices } from "./context";

/**
 * /admin/chaal/blocks (PLAN Task 79, decision 0268): the Lichess accounts and site users
 * Chaal refuses. A blocked site user's personal calls are refused and neither can connect
 * (src/server/chaal/context.ts, connect/service.ts); blocking also revokes the connection
 * it names, so a player already connected loses it at once. Unblocking deletes the row.
 */

type Row = typeof chBlock.$inferSelect;

/** Users' names and emails by id, for the target and "blocked by". */
async function peopleOf(db: Db | Tx, ids: ReadonlyArray<string | null>) {
	const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
	if (wanted.length === 0) return new Map<string, { name: string; email: string | null }>();
	const rows = await db
		.select({ id: user.id, name: user.name, email: user.email, guest: user.isAnonymous })
		.from(user)
		.where(inArray(user.id, wanted));
	return new Map(rows.map((row) => [row.id, { name: row.name, email: row.guest ? null : row.email }]));
}

async function toAdmin(db: Db | Tx, rows: ReadonlyArray<Row>): Promise<ChaalAdminBlock[]> {
	const people = await peopleOf(
		db,
		rows.flatMap((row) => [row.userId, row.blockedBy]),
	);
	return rows.map((row) => {
		const target = row.userId ? people.get(row.userId) : undefined;
		return {
			id: row.id,
			kind: row.lichessId ? "lichess" : "user",
			target: row.lichessId ?? target?.name ?? "",
			email: target?.email ?? null,
			reason: row.reason,
			blockedBy: row.blockedBy ? (people.get(row.blockedBy)?.name ?? null) : null,
			createdAt: row.createdAt.toISOString(),
		};
	});
}

/** A search finds the reason, the Lichess username, or the site user's name or email. */
function search(q: string): SQL | undefined {
	if (!q) return undefined;
	const person = textSearch(q, [user.name, user.email]);
	return or(
		textSearch(q, [chBlock.reason, chBlock.lichessId]),
		sql`exists (select 1 from ${user} where ${user.id} = ${chBlock.userId} and ${person})`,
	);
}

export function listBlocks({ db }: { db: Db }, input: ChaalBlockListInput): Promise<ChaalAdminBlockPage> {
	const kind =
		input.kind === "lichess"
			? isNotNull(chBlock.lichessId)
			: input.kind === "user"
				? isNotNull(chBlock.userId)
				: undefined;
	return listPage(db, chBlock, {
		input,
		where: allOf(kind, search(input.q)),
		sort: { columns: { created: chBlock.createdAt }, fallback: "created" },
		map: (rows) => toAdmin(db, rows),
	});
}

const fieldError = (message: string) =>
	new AppError("CONFLICT", `Chaal block: ${message}`, { fieldErrors: { target: [message] } });

const targetOf = (block: ChaalAdminBlock) => ({
	type: "chaal-block" as const,
	id: block.id,
	label: block.email ?? block.target,
});

/**
 * Blocks a Lichess account (by its username) or a site user (by their email), then revokes
 * the connection it names. Blocking the same one twice, or an email no account has, is a
 * field error on the target.
 */
export async function createBlock(services: ChaalAdminServices, input: ChaalBlockInput): Promise<ChaalAdminBlock> {
	const { db, actor, controls } = services;
	const created = await withAudit(db, actor, async (tx, audit) => {
		let values: { userId: string } | { lichessId: string };
		if (input.kind === "user") {
			const [found] = await tx
				.select({ id: user.id })
				.from(user)
				.where(eq(sql`lower(${user.email})`, input.target.toLowerCase()));
			if (!found) throw fieldError(m.ch_admin_block_no_account());
			values = { userId: found.id };
		} else {
			values = { lichessId: input.target.toLowerCase() };
		}
		// On conflict, nothing: a second block is a field error without a failed statement.
		const [row] = await tx
			.insert(chBlock)
			.values({ ...values, reason: input.reason, blockedBy: actor.id })
			.onConflictDoNothing()
			.returning();
		if (!row) throw fieldError(m.ch_admin_block_exists());
		const [item] = await toAdmin(tx, [row]);
		if (!item) throw fieldError(m.ch_admin_block_exists());
		audit({ action: "chaal.block.create", target: targetOf(item), after: { kind: item.kind, reason: row.reason } });
		return { item, row };
	});
	controls.invalidate();
	// The connection the block names goes too (its own audit entry): a blocked player can't keep playing.
	const connections = await db
		.select({ userId: chConnection.userId })
		.from(chConnection)
		.where(
			created.row.userId
				? eq(chConnection.userId, created.row.userId)
				: eq(chConnection.lichessId, created.row.lichessId ?? ""),
		);
	if (connections.length > 0) {
		await revokeConnections(
			services,
			connections.map((row) => row.userId),
		);
	}
	return created.item;
}

/** Unblocks: the account or user may connect again (their revoked connection stays revoked until they reconnect). */
export async function deleteBlocks(
	{ db, actor, controls }: ChaalAdminServices,
	ids: ReadonlyArray<string>,
): Promise<{ deleted: number }> {
	const deleted = await withAudit(db, actor, async (tx, audit) => {
		const rows = await tx
			.delete(chBlock)
			.where(inArray(chBlock.id, [...ids]))
			.returning();
		const items = await toAdmin(tx, rows);
		audit(
			...items.map((item) => ({
				action: "chaal.block.delete" as const,
				target: targetOf(item),
				before: { kind: item.kind, reason: item.reason },
			})),
		);
		return rows.length;
	});
	controls.invalidate();
	return { deleted };
}
