import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { NotificationData, NotifyEmail, NotifyKind } from "@/features/kharcha/notifications";
import { user } from "../auth";
import { khExpense } from "./expense";
import { khGroup } from "./group";
import { khPerson } from "./person";

/**
 * Kharcha's conversations (Task 92, decision 0286; docs/guides/kharcha.md "Conversations
 * and notifications"): comments in a thread, their reactions, how far each person has read
 * each thread, and the notifications the app's writes produce.
 *
 * A thread is a group's (`group_id`), the thread of two people (`person_lo` < `person_hi`,
 * as `kh_activity`) or an expense's (`expense_id`). Outside the tables it is named by a key
 * from the reader's side (`threadKey` in src/features/kharcha/notifications.ts):
 * `g:<group>`, `f:<the other person>`, `e:<expense>`.
 */

export const khComment = pgTable(
	"kh_comment",
	{
		id: uuid().primaryKey().defaultRandom(),
		groupId: uuid().references(() => khGroup.id, { onDelete: "cascade" }),
		personLo: uuid().references(() => khPerson.id, { onDelete: "cascade" }),
		personHi: uuid().references(() => khPerson.id, { onDelete: "cascade" }),
		expenseId: uuid().references(() => khExpense.id, { onDelete: "cascade" }),
		/** Who wrote it; null once that person is gone (the comment stays, unsigned). */
		authorId: uuid().references(() => khPerson.id, { onDelete: "set null" }),
		/** Plain text: links and @mentions are found when it is shown, never stored as markup. */
		body: text().notNull(),
		/** The people it mentions who could read it when it was written (the server's reading). */
		mentions: uuid().array().notNull().default(sql`'{}'::uuid[]`),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		editedAt: timestamp({ withTimezone: true }),
		deletedAt: timestamp({ withTimezone: true }),
	},
	(table) => [
		index("kh_comment_group_idx").on(table.groupId, table.createdAt),
		index("kh_comment_pair_idx").on(table.personLo, table.personHi, table.createdAt),
		index("kh_comment_expense_idx").on(table.expenseId, table.createdAt),
		index("kh_comment_author_idx").on(table.authorId),
		check(
			"kh_comment_one_thread",
			sql`num_nonnulls(${table.groupId}, ${table.personLo}, ${table.expenseId}) = 1 and (${table.personLo} is null) = (${table.personHi} is null)`,
		),
		check("kh_comment_pair_ordered", sql`${table.personLo} is null or ${table.personLo} < ${table.personHi}`),
	],
);

/** A reaction from the fixed set (`REACTIONS`): one of each per person per comment. */
export const khReaction = pgTable(
	"kh_reaction",
	{
		commentId: uuid()
			.notNull()
			.references(() => khComment.id, { onDelete: "cascade" }),
		personId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		emoji: text().notNull(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.commentId, table.personId, table.emoji] }),
		index("kh_reaction_person_idx").on(table.personId),
	],
);

/** How far a person has read a thread (`thread` is the key from their side). */
export const khRead = pgTable(
	"kh_read",
	{
		personId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		thread: text().notNull(),
		readAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [primaryKey({ columns: [table.personId, table.thread] })],
);

/**
 * A notification belongs to an account (Home's Updates and the bell), as Taskline's (0214).
 * `thread` is where it points, from the recipient's side; `group_id` and `expense_id` take
 * it away with what it is about. `email` says, from the recipient's settings when it was
 * made, whether it goes out at once, in the daily digest or not at all; `emailed_at` when it went.
 */
export const khNotification = pgTable(
	"kh_notification",
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		kind: text().$type<NotifyKind>().notNull(),
		thread: text().notNull(),
		groupId: uuid().references(() => khGroup.id, { onDelete: "cascade" }),
		expenseId: uuid().references(() => khExpense.id, { onDelete: "cascade" }),
		actorId: uuid().references(() => khPerson.id, { onDelete: "set null" }),
		/** A snapshot for the sentence: the actor's name, a title, the group, an amount, an excerpt. */
		data: jsonb().$type<NotificationData>().notNull().default({}),
		email: text().$type<NotifyEmail>().notNull().default("none"),
		emailedAt: timestamp({ withTimezone: true }),
		readAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("kh_notification_inbox_idx").on(table.userId, table.readAt, table.createdAt.desc()),
		index("kh_notification_outbox_idx")
			.on(table.email, table.createdAt)
			.where(sql`${table.emailedAt} is null and ${table.email} <> 'none'`),
		index("kh_notification_thread_idx").on(table.userId, table.thread),
		index("kh_notification_group_idx").on(table.groupId),
		index("kh_notification_expense_idx").on(table.expenseId),
		index("kh_notification_actor_idx").on(table.actorId),
		check("kh_notification_email_valid", sql`${table.email} in ('instant', 'digest', 'none')`),
	],
);

export type KhCommentRow = typeof khComment.$inferSelect;
export type KhNotificationRow = typeof khNotification.$inferSelect;
