import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth";
import { khGroup } from "./group";
import { khPerson } from "./person";

/**
 * Kharcha's invites (docs/guides/kharcha.md "Invites and joining", decision 0284): a link
 * someone sends a friend who has no account yet. The link holds a random token; only its
 * SHA-256 is stored. It is single use and lasts 14 days: opened by a signed-in account
 * (after a confirm), it makes the invited person that account's (`mergePerson`). A friend
 * who signs in with the invited address, verified, joins without it.
 *
 * - `person_id` is who was invited, as the inviter added them; `email` the address it was
 *   sent to (a snapshot: the person's address can't change, but it may be merged away).
 * - `group_id` is the group the invite was sent from: the page shows its name.
 * - `sent_at` is set when it was emailed; a link can also be copied and shared by hand.
 */
export const khInvite = pgTable(
	"kh_invite",
	{
		id: uuid().primaryKey().defaultRandom(),
		personId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		email: text().notNull(),
		invitedBy: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		groupId: uuid().references(() => khGroup.id, { onDelete: "set null" }),
		/** SHA-256 of the link's token, hex. */
		tokenHash: text().notNull(),
		expiresAt: timestamp({ withTimezone: true }).notNull(),
		sentAt: timestamp({ withTimezone: true }),
		acceptedAt: timestamp({ withTimezone: true }),
		/** The account that took it (by the link, or by signing in with the address). */
		acceptedBy: text().references(() => user.id, { onDelete: "set null" }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("kh_invite_token_unique").on(table.tokenHash),
		index("kh_invite_person_idx").on(table.personId),
		index("kh_invite_invited_by_idx").on(table.invitedBy),
		index("kh_invite_group_idx").on(table.groupId),
		check("kh_invite_email_lower", sql`${table.email} = lower(${table.email})`),
	],
);

export type KhInviteRow = typeof khInvite.$inferSelect;
