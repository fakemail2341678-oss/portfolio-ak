import "@tanstack/react-start/server-only";
import { and, count, desc, eq, gte, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import type { LinkItem, LinkState, Tally } from "@/features/apps/links/types";
import { ownedBy } from "@/server/apps/ownership";
import { type LinkRow, link, linkClick, user } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import type { ClickFacts } from "./clicks";

/**
 * Links' data access (decision 0191). Every function of the app takes the owner and
 * scopes by it (`ownedBy`); the redirect reads by slug, and moderation (/admin/links)
 * reads across owners under its own permission.
 */

/** Why a link doesn't redirect now, in the order the redirect checks (src/routes/l/$slug.ts). */
export function linkState(
	row: Pick<LinkRow, "active" | "expiresAt" | "blockedAt">,
	ownerIsGuest: boolean,
	now: Date,
): LinkState {
	if (row.blockedAt) return "blocked";
	if (ownerIsGuest) return "guest";
	if (!row.active) return "paused";
	if (row.expiresAt && row.expiresAt <= now) return "expired";
	return "live";
}

const clickCounts = (db: Db | Tx) =>
	db
		.select({ linkId: linkClick.linkId, total: count().as("clicks") })
		.from(linkClick)
		.groupBy(linkClick.linkId)
		.as("click_counts");

export const toLinkItem = (row: LinkRow & { clicks: number }, ownerIsGuest: boolean, now: Date): LinkItem => ({
	id: row.id,
	slug: row.slug,
	target: row.target,
	title: row.title,
	active: row.active,
	expiresAt: row.expiresAt?.toISOString() ?? null,
	blocked: row.blockedAt !== null,
	state: linkState(row, ownerIsGuest, now),
	clicks: row.clicks,
	createdAt: row.createdAt.toISOString(),
});

/** The owner's links, newest first, with their click counts. */
export async function listLinks(db: Db, ownerId: string): Promise<Array<LinkRow & { clicks: number }>> {
	const clicks = clickCounts(db);
	const rows = await db
		.select({ link, clicks: sql<number>`coalesce(${clicks.total}, 0)`.mapWith(Number) })
		.from(link)
		.leftJoin(clicks, eq(clicks.linkId, link.id))
		.where(ownedBy(link, ownerId))
		.orderBy(desc(link.createdAt), desc(link.id));
	return rows.map((row) => ({ ...row.link, clicks: row.clicks }));
}

export async function getLink(
	db: Db | Tx,
	ownerId: string,
	id: string,
): Promise<(LinkRow & { clicks: number }) | null> {
	const [row] = await db
		.select({
			link,
			clicks: sql<number>`(select count(*) from ${linkClick} where ${linkClick.linkId} = "link"."id")`.mapWith(Number),
		})
		.from(link)
		.where(and(eq(link.id, id), ownedBy(link, ownerId)));
	return row ? { ...row.link, clicks: row.clicks } : null;
}

export const countLinks = async (tx: Tx, ownerId: string) =>
	(await tx.select({ total: count() }).from(link).where(ownedBy(link, ownerId)))[0]?.total ?? 0;

export const slugTaken = async (db: Db | Tx, slug: string) =>
	(await db.select({ id: link.id }).from(link).where(eq(link.slug, slug))).length > 0;

export type NewLink = { slug: string; target: string; title?: string; expiresAt?: Date | null };

export async function insertLinks(tx: Tx, ownerId: string, links: ReadonlyArray<NewLink>): Promise<LinkRow[]> {
	if (links.length === 0) return [];
	return tx
		.insert(link)
		.values(links.map((each) => ({ ...each, ownerId })))
		.returning();
}

export async function updateLink(
	tx: Tx,
	ownerId: string,
	id: string,
	set: Partial<Pick<LinkRow, "target" | "title" | "active" | "expiresAt">>,
): Promise<LinkRow | null> {
	const [row] = await tx
		.update(link)
		.set(set)
		.where(and(eq(link.id, id), ownedBy(link, ownerId)))
		.returning();
	return row ?? null;
}

export async function deleteLink(tx: Tx, ownerId: string, id: string): Promise<boolean> {
	const rows = await tx
		.delete(link)
		.where(and(eq(link.id, id), ownedBy(link, ownerId)))
		.returning({ id: link.id });
	return rows.length > 0;
}

/** Calendar days in `timeZone` as "YYYY-MM-DD", with their clicks, from `since` on. */
export async function clicksPerDay(db: Db, linkId: string, since: Date, timeZone: string): Promise<Tally[]> {
	const day = sql<string>`to_char(${linkClick.at} at time zone ${timeZone}, 'YYYY-MM-DD')`;
	return (
		db
			.select({ key: day, clicks: count() })
			.from(linkClick)
			.where(and(eq(linkClick.linkId, linkId), gte(linkClick.at, since)))
			// By position: the zone is a bound parameter, so the SELECT and GROUP BY expressions would differ.
			.groupBy(sql`1`)
	);
}

/** The largest groups of one column, most clicks first; null becomes "" (direct, unknown). */
export async function topClicks(
	db: Db,
	linkId: string,
	column: typeof linkClick.referrerHost | typeof linkClick.country | typeof linkClick.device,
	limit = 8,
): Promise<Tally[]> {
	const key = sql<string>`coalesce(${column}, '')`;
	return db
		.select({ key, clicks: count() })
		.from(linkClick)
		.where(eq(linkClick.linkId, linkId))
		.groupBy(key)
		.orderBy(desc(count()), key)
		.limit(limit);
}

/**
 * The link a short URL names when it may redirect now: active, not blocked, not
 * expired, and owned by an account (a guest's links never go live, decision 0186).
 */
export async function resolveSlug(db: Db, slug: string, now: Date) {
	const [row] = await db
		.select({ id: link.id, ownerId: link.ownerId, target: link.target })
		.from(link)
		.innerJoin(user, eq(user.id, link.ownerId))
		.where(
			and(
				eq(link.slug, slug),
				eq(link.active, true),
				isNull(link.blockedAt),
				or(isNull(link.expiresAt), sql`${link.expiresAt} > ${now.toISOString()}::timestamptz`),
				sql`not coalesce(${user.isAnonymous}, false)`,
			),
		);
	return row ?? null;
}

export async function recordClick(
	db: Db,
	target: { linkId: string; ownerId: string },
	facts: ClickFacts,
	at = new Date(),
) {
	await db.insert(linkClick).values({ ...target, ...facts, at });
}

// ---------------------------------------------------------------------------
// Moderation (/admin/links)
// ---------------------------------------------------------------------------

/** Every link (accounts' and guests'), with its owner and clicks; `where` from the admin list's filters. */
export function moderationRows(db: Db | Tx, where: SQL | undefined) {
	const clicks = clickCounts(db);
	return db
		.select({
			link,
			clicks: sql<number>`coalesce(${clicks.total}, 0)`.mapWith(Number),
			ownerName: user.name,
			ownerEmail: user.email,
			ownerIsGuest: sql<boolean>`coalesce(${user.isAnonymous}, false)`,
		})
		.from(link)
		.innerJoin(user, eq(user.id, link.ownerId))
		.leftJoin(clicks, eq(clicks.linkId, link.id))
		.where(where)
		.$dynamic();
}

export async function countModerationRows(db: Db, where: SQL | undefined): Promise<number> {
	const [row] = await db.select({ total: count() }).from(link).innerJoin(user, eq(user.id, link.ownerId)).where(where);
	return row?.total ?? 0;
}

/** Sets or clears `blocked_at` on links; returns the rows changed (for the audit log). */
export async function setBlocked(tx: Tx, ids: ReadonlyArray<string>, blocked: boolean, now = new Date()) {
	return tx
		.update(link)
		.set({ blockedAt: blocked ? now : null })
		.where(and(inArray(link.id, [...ids]), blocked ? isNull(link.blockedAt) : sql`${link.blockedAt} is not null`))
		.returning();
}

export async function deleteLinksById(tx: Tx, ids: ReadonlyArray<string>) {
	return tx
		.delete(link)
		.where(inArray(link.id, [...ids]))
		.returning();
}

// ---------------------------------------------------------------------------
// Guests and /admin/apps
// ---------------------------------------------------------------------------

/** Moves every link and click of a guest to an account (decision 0186); the links can go live from now on. */
export async function transferLinks(tx: Tx, fromUserId: string, toUserId: string): Promise<void> {
	await tx.update(linkClick).set({ ownerId: toUserId }).where(ownedBy(linkClick, fromUserId));
	await tx.update(link).set({ ownerId: toUserId }).where(ownedBy(link, fromUserId));
}

export async function insertClicks(
	tx: Tx,
	ownerId: string,
	clicks: ReadonlyArray<ClickFacts & { linkId: string; at: Date }>,
) {
	if (clicks.length > 0) await tx.insert(linkClick).values(clicks.map((click) => ({ ...click, ownerId })));
}

/** Usage for /admin/apps: how many accounts and guests have a link, and the rows. */
export async function linksUsage(db: Db) {
	const [owners] = await db
		.select({
			accounts:
				sql<number>`count(distinct ${link.ownerId}) filter (where not coalesce(${user.isAnonymous}, false))`.mapWith(
					Number,
				),
			guests: sql<number>`count(distinct ${link.ownerId}) filter (where ${user.isAnonymous})`.mapWith(Number),
			links: count(),
		})
		.from(link)
		.innerJoin(user, eq(user.id, link.ownerId));
	const [clicks] = await db.select({ total: count() }).from(linkClick);
	return {
		accounts: owners?.accounts ?? 0,
		guests: owners?.guests ?? 0,
		rows: { links: owners?.links ?? 0, clicks: clicks?.total ?? 0 },
	};
}
