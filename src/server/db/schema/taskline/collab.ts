import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { NotificationData, NotificationEmail, NotificationKind } from "../../../../features/taskline/types";
import { user } from "../auth";
import { tlProject } from "./project";
import { tlTask } from "./task";
import { tlMember, tlWorkspace } from "./workspace";

/**
 * Collaboration (Task 50, decision 0214): comments on tasks, and the notifications
 * the app's writes produce. A notification belongs to an account (it is the inbox's
 * row); `email` says, from the recipient's settings when it was made, whether it goes
 * out at once, in the daily digest, or not at all, and `emailed_at` when it went.
 */

export const tlComment = pgTable(
	"tl_comment",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		taskId: uuid()
			.notNull()
			.references(() => tlTask.id, { onDelete: "cascade" }),
		/** A member, so the name survives the account; null once the member row is gone. */
		authorId: uuid().references(() => tlMember.id, { onDelete: "set null" }),
		/** Task 56: written by this automation (its name then; the author is null). */
		automation: text(),
		bodyHtml: text().notNull(),
		bodyText: text().notNull().default(""),
		/** The members the sanitized body mentions who may see the task (the server's reading, never the browser's). */
		mentions: uuid().array().notNull().default(sql`'{}'::uuid[]`),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		editedAt: timestamp({ withTimezone: true }),
		deletedAt: timestamp({ withTimezone: true }),
	},
	(table) => [index("tl_comment_task_idx").on(table.taskId, table.createdAt)],
);

export const tlNotification = pgTable(
	"tl_notification",
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		kind: text().$type<NotificationKind>().notNull(),
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		taskId: uuid().references(() => tlTask.id, { onDelete: "cascade" }),
		actorId: uuid().references(() => tlMember.id, { onDelete: "set null" }),
		/** A snapshot for the sentence: names, the ref, the title, the new status, an excerpt. */
		data: jsonb().$type<NotificationData>().notNull().default({}),
		email: text().$type<NotificationEmail>().notNull().default("none"),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		readAt: timestamp({ withTimezone: true }),
		emailedAt: timestamp({ withTimezone: true }),
	},
	(table) => [
		index("tl_notification_inbox_idx").on(table.userId, table.readAt, table.createdAt.desc()),
		/** The senders' queue: what still has to go out. */
		index("tl_notification_outbox_idx")
			.on(table.email, table.createdAt)
			.where(sql`${table.emailedAt} is null and ${table.email} <> 'none'`),
		/** Coalescing and the cron's "already told" checks look by task. */
		index("tl_notification_task_idx").on(table.taskId, table.userId),
		check("tl_notification_email_valid", sql`${table.email} in ('instant', 'digest', 'none')`),
	],
);

export type TlCommentRow = typeof tlComment.$inferSelect;
export type TlNotificationRow = typeof tlNotification.$inferSelect;
