import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type { SplitMethod } from "@/features/kharcha/money/split";
import type { KharchaColor } from "@/features/kharcha/types";
import { user } from "../auth";

/**
 * Kharcha's people (docs/guides/kharcha.md, decision 0277): anyone money can be owed to or
 * by. A person is a user (`user_id`), or a contact somebody added: a name, perhaps an
 * address. Everything else points at people, never at users, so a balance with a friend
 * exists before the friend has an account and survives the account going.
 *
 * - `email` is unique (lowercase): two users who add the same address share one person, so
 *   both see their balances once that friend signs in with it, verified.
 * - A contact with a name only is private to whoever created it (`created_by`).
 * - `user_id` is set null when the account is deleted; the name stays for the others.
 */
export const khPerson = pgTable(
	"kh_person",
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: text().references(() => user.id, { onDelete: "set null" }),
		email: text(),
		/** The name others see: a snapshot of the account's, or what the contact was called. */
		displayName: text().notNull(),
		/** A palette name (src/features/kharcha/types.ts). */
		color: text().$type<KharchaColor>().notNull(),
		/** The person who added this contact; null for a user's own person. */
		createdBy: uuid().references((): AnyPgColumn => khPerson.id, { onDelete: "set null" }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("kh_person_user_unique").on(table.userId),
		uniqueIndex("kh_person_email_unique").on(table.email),
		index("kh_person_created_by_idx").on(table.createdBy),
		check("kh_person_email_lower", sql`${table.email} = lower(${table.email})`),
	],
);

/**
 * A user's own settings in Kharcha, made with their person on first use. `rev` goes up
 * with every change that touches the person, in the change's transaction: open pages poll
 * it and refetch when it moved (PLAN 14.5 "Freshness").
 */
export const khProfile = pgTable(
	"kh_profile",
	{
		userId: text()
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
		personId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		/** DEFAULT_CURRENCY and APP_TIME_ZONE (src/lib/i18n/intl.ts), until onboarding asks. */
		homeCurrency: text().notNull().default("NPR"),
		timeZone: text().notNull().default("Asia/Kathmandu"),
		/** The language of their emails (Task 92); null: the app's base language. */
		locale: text(),
		defaultSplit: text().$type<SplitMethod>().notNull().default("equal"),
		/** Per notification kind, how they hear about it (Task 92). */
		notify: jsonb().$type<Partial<Record<string, string>>>().notNull().default({}),
		/** Focus mode: only unread and unsettled conversations (Task 92). */
		focus: boolean().notNull().default(false),
		onboardedAt: timestamp({ withTimezone: true }),
		/** How friends can pay them, in their own words. */
		payNote: text().notNull().default(""),
		/** Set by the admin: this person can't send invites or reminders (Task 96). */
		invitesBlockedAt: timestamp({ withTimezone: true }),
		rev: integer().notNull().default(0),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [uniqueIndex("kh_profile_person_unique").on(table.personId)],
);

/**
 * Who a person keeps as a friend. Rows are made both ways, by adding someone or by the
 * first debt between two people; the nickname and `hidden` are the owner's own.
 */
export const khFriend = pgTable(
	"kh_friend",
	{
		ownerId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		friendId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		nickname: text().notNull().default(""),
		hidden: boolean().notNull().default(false),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.ownerId, table.friendId] }),
		index("kh_friend_friend_idx").on(table.friendId),
		check("kh_friend_not_self", sql`${table.ownerId} <> ${table.friendId}`),
	],
);

export type KhPersonRow = typeof khPerson.$inferSelect;
export type KhProfileRow = typeof khProfile.$inferSelect;
export type KhFriendRow = typeof khFriend.$inferSelect;
