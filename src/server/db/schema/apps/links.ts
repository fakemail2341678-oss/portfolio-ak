import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth";

/**
 * Links (/apps/links, decision 0191): short links at /l/<slug> and their clicks. Every
 * row has `owner_id` (the user, a guest included), deleted with them; the repository
 * scopes every query by it (`ownedBy`), except the redirect, which reads by slug.
 */
const owner = () =>
	text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" });

export const link = pgTable(
	"link",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: owner(),
		/** Unique across every owner: the path of the short link. */
		slug: text().notNull().unique(),
		target: text().notNull(),
		title: text().notNull().default(""),
		/** The owner's switch. */
		active: boolean().notNull().default(true),
		expiresAt: timestamp({ withTimezone: true }),
		/** Set by a moderator (/admin/links): the link stops, and its owner can't turn it back on. */
		blockedAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("link_owner_idx").on(table.ownerId, table.createdAt)],
);

/** One redirect. No IP and no full user agent: the referrer's host, a country code and a device class only. */
export const linkClick = pgTable(
	"link_click",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: owner(),
		linkId: uuid()
			.notNull()
			.references(() => link.id, { onDelete: "cascade" }),
		at: timestamp({ withTimezone: true }).defaultNow().notNull(),
		/** "news.ycombinator.com"; null for a direct visit (no or an unreadable Referer). */
		referrerHost: text(),
		/** ISO 3166 alpha-2 from Vercel's `x-vercel-ip-country`; null when unknown. */
		country: text(),
		/** "mobile", "tablet", "desktop" or "bot", from the User-Agent. */
		device: text().notNull(),
	},
	(table) => [index("link_click_link_idx").on(table.linkId, table.at), index("link_click_owner_idx").on(table.ownerId)],
);

export type LinkRow = typeof link.$inferSelect;
export type LinkClickRow = typeof linkClick.$inferSelect;
