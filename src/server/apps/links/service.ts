import "@tanstack/react-start/server-only";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { LinkModerationInput, LinkModerationItem, LinkModerationPage } from "@/features/apps/links/admin/schema";
import type { CreateLinkInput, UpdateLinkInput } from "@/features/apps/links/schema";
import { LINKS_QUOTAS, type LinkItem, type LinkList, type LinkStats, type Tally } from "@/features/apps/links/types";
import { ruleError } from "@/lib/errors";
import { addDays, startOfDayInZone, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import type { AppServices } from "@/server/apps/ownership";
import { notFound, uniqueViolation, withAudit } from "@/server/db/crud";
import { allOf, orderBySort, paginate, textSearch } from "@/server/db/list";
import { lockQuota } from "@/server/db/quota";
import { link, linkClick, user } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import { enforceRateLimit } from "@/server/http/rate-limit";
import type { Services } from "@/server/services";
import type { ClickFacts } from "./clicks";
import * as repo from "./repository";

/**
 * Links' rules (decision 0191): every call of the app acts on the caller's own links
 * (the repository scopes by owner), quotas and a create rate limit per user, slugs
 * unique across everyone. A guest's links never redirect until the guest signs up
 * (0186). Moderation is an admin action under `links:moderate`, audited.
 */

const quotaError = () =>
	ruleError("CONFLICT", "Links quota reached", m.links_quota({ max: formatNumber(LINKS_QUOTAS.links) }));

const slugTakenError = (error: unknown) =>
	uniqueViolation(error, { link_slug_unique: { field: "slug", message: m.links_error_slug_taken } });

export async function listLinks({ db, user }: AppServices): Promise<LinkList> {
	const now = new Date();
	const rows = await repo.listLinks(db, user.id);
	return { links: rows.map((row) => repo.toLinkItem(row, user.isGuest, now)), now: now.toISOString() };
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** Seven characters without look-alikes (no l, o, 0, 1): about 34 billion slugs. */
const randomSlug = () =>
	Array.from(crypto.getRandomValues(new Uint8Array(7)), (byte) => ALPHABET[byte % ALPHABET.length]).join("");

async function freeRandomSlug(tx: Tx): Promise<string> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const slug = randomSlug();
		if (!(await repo.slugTaken(tx, slug))) return slug;
	}
	throw new Error("No free random slug after 5 attempts");
}

export async function createLink(
	{ db, user }: AppServices,
	input: CreateLinkInput,
	now = new Date(),
): Promise<LinkItem> {
	const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
	if (expiresAt && expiresAt <= now) {
		throw ruleError("BAD_REQUEST", "Expiry in the past", m.links_error_expiry_past());
	}
	await enforceRateLimit(db, `links-create:${user.id}`, { max: LINKS_QUOTAS.createsPerHour, windowSeconds: 3600 });
	try {
		return await db.transaction(async (tx) => {
			await lockQuota(tx, `links:${user.id}`);
			if ((await repo.countLinks(tx, user.id)) >= LINKS_QUOTAS.links) throw quotaError();
			const slug = input.slug || (await freeRandomSlug(tx));
			const [row] = await repo.insertLinks(tx, user.id, [
				{ slug, target: input.target, title: input.title, expiresAt },
			]);
			if (!row) throw new Error("Link insert returned no row");
			return repo.toLinkItem({ ...row, clicks: 0 }, user.isGuest, now);
		});
	} catch (error) {
		throw slugTakenError(error);
	}
}

export async function updateLink({ db, user }: AppServices, { id, ...changes }: UpdateLinkInput): Promise<LinkItem> {
	const now = new Date();
	return db.transaction(async (tx) => {
		const row = await repo.updateLink(tx, user.id, id, {
			...changes,
			expiresAt: changes.expiresAt === undefined ? undefined : changes.expiresAt ? new Date(changes.expiresAt) : null,
		});
		if (!row) throw notFound("Link");
		const withClicks = await repo.getLink(tx, user.id, id);
		return repo.toLinkItem({ ...row, clicks: withClicks?.clicks ?? 0 }, user.isGuest, now);
	});
}

export async function deleteLink({ db, user }: AppServices, id: string): Promise<void> {
	await db.transaction(async (tx) => {
		if (!(await repo.deleteLink(tx, user.id, id))) throw notFound("Link");
	});
}

/** Days shown on a link's page, today included. */
export const STATS_DAYS = 30;

/** A link's page: the last 30 days by day (the app's time zone), then where clicks came from. */
export async function getLinkStats({ db, user }: AppServices, id: string, now = new Date()): Promise<LinkStats> {
	const row = await repo.getLink(db, user.id, id);
	if (!row) throw notFound("Link");
	const first = addDays(todayInZone(APP_TIME_ZONE, now), -(STATS_DAYS - 1));
	const since = startOfDayInZone(first, APP_TIME_ZONE) ?? now;
	const [perDay, referrers, countries, devices] = await Promise.all([
		repo.clicksPerDay(db, id, since, APP_TIME_ZONE),
		repo.topClicks(db, id, linkClick.referrerHost),
		repo.topClicks(db, id, linkClick.country),
		repo.topClicks(db, id, linkClick.device),
	]);
	const byDay = new Map(perDay.map((tally) => [tally.key, tally.clicks]));
	const days: Tally[] = Array.from({ length: STATS_DAYS }, (_, index) => {
		const key = addDays(first, index);
		return { key, clicks: byDay.get(key) ?? 0 };
	});
	return { link: repo.toLinkItem(row, user.isGuest, now), days, referrers, countries, devices, total: row.clicks };
}

/** The redirect's lookup: the target when the link may redirect now, else null (the 404). */
export const resolveShortLink = (db: AppServices["db"], slug: string, now = new Date()) =>
	repo.resolveSlug(db, slug, now);

/** Records one redirect (called in the background: the redirect never waits for it). */
export const recordClick = (db: AppServices["db"], target: { linkId: string; ownerId: string }, facts: ClickFacts) =>
	repo.recordClick(db, target, facts);

// ---------------------------------------------------------------------------
// Moderation (/admin/links, `links:moderate`)
// ---------------------------------------------------------------------------

const SORT_COLUMNS = { created: link.createdAt, slug: link.slug };

/** Every link, filtered by slug, target, title or owner and by state. */
export async function listForModeration(
	{ db }: Pick<Services, "db">,
	input: LinkModerationInput,
): Promise<LinkModerationPage> {
	const now = new Date();
	const guest = sql`coalesce(${user.isAnonymous}, false)`;
	const live = and(
		eq(link.active, true),
		isNull(link.blockedAt),
		or(isNull(link.expiresAt), sql`${link.expiresAt} > ${now.toISOString()}::timestamptz`),
		sql`not ${guest}`,
	);
	const where = allOf(
		textSearch(input.q, [link.slug, link.target, link.title, user.email, user.name]),
		input.state === "live" ? live : undefined,
		input.state === "blocked" ? sql`${link.blockedAt} is not null` : undefined,
		input.state === "guest" ? sql`${guest}` : undefined,
	);
	const order = orderBySort(input.sort, SORT_COLUMNS, { tiebreaker: link.id, fallback: "created" });
	return paginate(
		input,
		{
			count: () => repo.countModerationRows(db, where),
			rows: ({ limit, offset }) =>
				repo
					.moderationRows(db, where)
					.orderBy(...order)
					.limit(limit)
					.offset(offset),
		},
		(row): LinkModerationItem => ({
			...repo.toLinkItem({ ...row.link, clicks: row.clicks }, row.ownerIsGuest, now),
			owner: { name: row.ownerName, email: row.ownerEmail, guest: row.ownerIsGuest },
		}),
	);
}

/** Blocks (or unblocks) links: a blocked link stops redirecting and its owner can't turn it back on. */
export async function setLinksBlocked(
	{ db, actor }: Pick<Services, "db" | "actor">,
	input: { ids: string[]; blocked: boolean },
): Promise<void> {
	await withAudit(db, actor, async (tx, audit) => {
		const changed = await repo.setBlocked(tx, input.ids, input.blocked);
		audit(
			...changed.map((row) => ({
				action: input.blocked ? ("link.block" as const) : ("link.unblock" as const),
				target: { type: "link" as const, id: row.id, label: row.slug },
				after: { target: row.target },
			})),
		);
	});
}

export async function deleteLinks({ db, actor }: Pick<Services, "db" | "actor">, ids: string[]): Promise<void> {
	await withAudit(db, actor, async (tx, audit) => {
		const removed = await repo.deleteLinksById(tx, ids);
		audit(
			...removed.map((row) => ({
				action: "link.delete" as const,
				target: { type: "link" as const, id: row.id, label: row.slug },
				before: { target: row.target, title: row.title },
			})),
		);
	});
}

// ---------------------------------------------------------------------------
// Guests and /admin/apps
// ---------------------------------------------------------------------------

const SAMPLE_REFERRERS = [null, "news.ycombinator.com", "linkedin.com", null, "github.com", "facebook.com"];
const SAMPLE_COUNTRIES = ["NP", "NP", "IN", "US", "NP", "GB", null];
const SAMPLE_DEVICES = ["mobile", "desktop", "mobile", "tablet", "mobile"] as const;

/**
 * A new guest's sample links (decision 0186), in the language they started in, with
 * two weeks of made-up clicks so the charts have something to show. They never
 * redirect while the owner is a guest.
 */
export async function seedLinks(tx: Tx, userId: string, locale: Locale, now = new Date()): Promise<void> {
	const t = { locale };
	const rows = await repo.insertLinks(tx, userId, [
		{ slug: await freeRandomSlug(tx), target: "https://tanstack.com/start", title: m.links_seed_docs({}, t) },
		{
			slug: await freeRandomSlug(tx),
			target: "https://www.openstreetmap.org/#map=12/27.7172/85.3240",
			title: m.links_seed_map({}, t),
		},
	]);
	const [docs, map] = rows;
	if (!docs || !map) return;
	const clicks = Array.from({ length: 40 }, (_, index) => ({
		linkId: index % 3 === 0 ? map.id : docs.id,
		// Spread over 14 days, more of them recently.
		at: new Date(now.getTime() - ((index * index) % 14) * 86_400_000 - index * 3_600_000),
		referrerHost: SAMPLE_REFERRERS[index % SAMPLE_REFERRERS.length] ?? null,
		country: SAMPLE_COUNTRIES[index % SAMPLE_COUNTRIES.length] ?? null,
		device: SAMPLE_DEVICES[index % SAMPLE_DEVICES.length] ?? "desktop",
	}));
	await repo.insertClicks(tx, userId, clicks);
}

export const claimLinks = (tx: Tx, fromUserId: string, toUserId: string) =>
	repo.transferLinks(tx, fromUserId, toUserId);

export const linksUsage = repo.linksUsage;
