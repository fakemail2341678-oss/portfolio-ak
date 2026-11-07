import "@tanstack/react-start/server-only";
import { and, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import type { AdminTakedown, AdminTakedownPage, TakedownInput } from "@/features/parda/admin/schema";
import type { PardaTakedownListInput } from "@/features/parda/admin/search";
import { AppError } from "@/lib/errors";
import type { Localized } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { listPage, withAudit } from "@/server/db/crud";
import { allOf, textSearch } from "@/server/db/list";
import { type PardaMedia, pdBlockedTitle, pdTitle, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { PardaAdminServices } from "./context";

/**
 * /admin/parda/titles (PLAN Task 65, decision 0237): the takedown list. A blocked title
 * is a 404 and leaves every list from the next read (src/server/parda/catalog/service.ts
 * applies it; the sitemap reads the table itself). Unblocking deletes the row.
 */

const WHAT = "Parda takedown";

type Row = typeof pdBlockedTitle.$inferSelect;

/** Each title's name from the snapshot, by "media:id". */
export async function titleNames(db: Db, rows: ReadonlyArray<{ media: PardaMedia; tmdbId: number }>) {
	const names = new Map<string, Localized>();
	if (rows.length === 0) return names;
	const found = await db
		.select({ media: pdTitle.media, id: pdTitle.tmdbId, title: pdTitle.title })
		.from(pdTitle)
		.where(or(...rows.map((row) => and(eq(pdTitle.media, row.media), eq(pdTitle.tmdbId, row.tmdbId)))));
	for (const row of found) names.set(`${row.media}:${row.id}`, row.title);
	return names;
}

/** Users' names by id, for "blocked by" and "resolved by". */
export async function userNames(db: Db, ids: ReadonlyArray<string | null>) {
	const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
	if (wanted.length === 0) return new Map<string, string>();
	const rows = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, wanted));
	return new Map(rows.map((row) => [row.id, row.name]));
}

async function toAdmin(db: Db, rows: ReadonlyArray<Row>): Promise<AdminTakedown[]> {
	const [names, people] = await Promise.all([
		titleNames(db, rows),
		userNames(
			db,
			rows.map((row) => row.blockedBy),
		),
	]);
	return rows.map((row) => ({
		id: row.id,
		media: row.media,
		tmdbId: row.tmdbId,
		title: names.get(`${row.media}:${row.tmdbId}`) ?? null,
		reason: row.reason,
		blockedBy: row.blockedBy ? (people.get(row.blockedBy) ?? null) : null,
		createdAt: row.createdAt.toISOString(),
	}));
}

/** A search finds the reason, the title in either language, or the TMDB id. */
function search(q: string): SQL | undefined {
	if (!q) return undefined;
	const titled = textSearch(q, [sql`${pdTitle.title}->>'en'`, sql`${pdTitle.title}->>'ne'`]);
	return or(
		textSearch(q, [pdBlockedTitle.reason]),
		sql`exists (select 1 from ${pdTitle} where ${pdTitle.media} = ${pdBlockedTitle.media} and ${pdTitle.tmdbId} = ${pdBlockedTitle.tmdbId} and ${titled})`,
		/^\d{1,9}$/.test(q) ? eq(pdBlockedTitle.tmdbId, Number(q)) : undefined,
	);
}

export function listTakedowns({ db }: { db: Db }, input: PardaTakedownListInput): Promise<AdminTakedownPage> {
	return listPage(db, pdBlockedTitle, {
		input,
		where: allOf(input.media === "all" ? undefined : eq(pdBlockedTitle.media, input.media), search(input.q)),
		sort: { columns: { created: pdBlockedTitle.createdAt }, fallback: "created" },
		map: (rows) => toAdmin(db, rows),
	});
}

const target = (row: { id: string; media: string; tmdbId: number }, title?: Localized | null) => ({
	type: "parda-title" as const,
	id: row.id,
	label: title?.en || `${row.media}/${row.tmdbId}`,
});

/** Blocks a title. Blocking it twice is a field error on the id. */
export async function blockTitle({ db, actor, controls }: PardaAdminServices, input: TakedownInput) {
	const created = await withAudit(db, actor, async (tx, audit) => {
		// On conflict, nothing: a second block is a field error without a failed statement (decision 0237).
		const [row] = await tx
			.insert(pdBlockedTitle)
			.values({ media: input.media, tmdbId: input.tmdbId, reason: input.reason, blockedBy: actor.id })
			.onConflictDoNothing({ target: [pdBlockedTitle.media, pdBlockedTitle.tmdbId] })
			.returning();
		if (!row) {
			throw new AppError("CONFLICT", `${WHAT}: already blocked`, {
				fieldErrors: { tmdbId: [m.pd_admin_takedown_exists()] },
			});
		}
		const [item] = await toAdmin(tx, [row]);
		audit({
			action: "parda.title.block",
			target: target(row, item?.title),
			after: { media: row.media, tmdbId: row.tmdbId, reason: row.reason },
		});
		return item as AdminTakedown;
	});
	controls.invalidate();
	return created;
}

/** Unblocks titles: their pages and places in lists come back on the next read. */
export async function unblockTitles(
	{ db, actor, controls }: PardaAdminServices,
	ids: ReadonlyArray<string>,
): Promise<{ deleted: number }> {
	const deleted = await withAudit(db, actor, async (tx, audit) => {
		const rows = await tx
			.delete(pdBlockedTitle)
			.where(inArray(pdBlockedTitle.id, [...ids]))
			.returning();
		const items = await toAdmin(tx, rows);
		audit(
			...rows.map((row, index) => ({
				action: "parda.title.unblock" as const,
				target: target(row, items[index]?.title),
				before: { media: row.media, tmdbId: row.tmdbId, reason: row.reason },
			})),
		);
		return rows.length;
	});
	controls.invalidate();
	return { deleted };
}
