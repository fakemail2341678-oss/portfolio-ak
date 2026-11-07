import "@tanstack/react-start/server-only";
import { and, inArray, isNotNull, isNull, type SQL } from "drizzle-orm";
import {
	type ContactMessageItem,
	type ContactMessagePage,
	contactMessageItem,
	type MessageStateInput,
} from "@/features/portfolio/schema";
import type { MessageListInput } from "@/features/portfolio/search";
import { listPage } from "@/server/db/crud";
import { allOf, textSearch } from "@/server/db/list";
import { portfolioContactMessage } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/** Contact messages: written by the public form, read and archived in the admin inbox. */

const table = portfolioContactMessage;

const STATE: Record<MessageListInput["state"], SQL | undefined> = {
	inbox: isNull(table.archivedAt),
	unread: and(isNull(table.archivedAt), isNull(table.readAt)),
	archived: isNotNull(table.archivedAt),
	all: undefined,
};

export function listMessages(db: Db, input: MessageListInput): Promise<ContactMessagePage> {
	return listPage(db, table, {
		input,
		where: allOf(STATE[input.state], textSearch(input.q, [table.name, table.email, table.message])),
		sort: { columns: { received: table.createdAt }, fallback: "received" },
		map: (rows) => rows.map((row) => contactMessageItem.parse(row)),
	});
}

export async function insertMessage(
	db: Db,
	values: { name: string; email: string; message: string; locale: string; ipHash: string | null },
): Promise<ContactMessageItem> {
	const [row] = await db.insert(table).values(values).returning();
	if (!row) throw new Error("Contact message insert returned no row");
	return contactMessageItem.parse(row);
}

/**
 * Marks messages read, unread, archived or back in the inbox. Returns the ones
 * that changed (setting what they already are changes nothing).
 */
export async function setMessageState(
	tx: Tx,
	{ ids, set }: MessageStateInput,
	now = new Date(),
): Promise<ContactMessageItem[]> {
	const changes = {
		read: { values: { readAt: now }, unless: isNull(table.readAt) },
		unread: { values: { readAt: null }, unless: isNotNull(table.readAt) },
		archived: { values: { archivedAt: now }, unless: isNull(table.archivedAt) },
		inbox: { values: { archivedAt: null }, unless: isNotNull(table.archivedAt) },
	}[set];
	const rows = await tx
		.update(table)
		.set(changes.values)
		.where(and(inArray(table.id, ids), changes.unless))
		.returning();
	return rows.map((row) => contactMessageItem.parse(row));
}

export async function deleteMessages(tx: Tx, ids: ReadonlyArray<string>): Promise<ContactMessageItem[]> {
	const rows = await tx
		.delete(table)
		.where(inArray(table.id, [...ids]))
		.returning();
	return rows.map((row) => contactMessageItem.parse(row));
}
