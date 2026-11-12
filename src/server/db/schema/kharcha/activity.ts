import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { ActivityData, ActivityKind } from "@/features/kharcha/types";
import { khExpense } from "./expense";
import { khGroup } from "./group";
import { khPayment } from "./payment";
import { khPerson } from "./person";

/**
 * Kharcha's history (docs/guides/kharcha.md): every write leaves a row here, in its own
 * transaction. It is the people's record (an expense's edits, a thread's system lines),
 * not the admin audit log. A row belongs to a group's thread (`group_id`), to the thread of
 * two people (`person_lo` < `person_hi`), or only to its expense or payment; it goes when
 * what it is about is purged.
 */
export const khActivity = pgTable(
	"kh_activity",
	{
		id: uuid().primaryKey().defaultRandom(),
		groupId: uuid().references(() => khGroup.id, { onDelete: "cascade" }),
		personLo: uuid().references(() => khPerson.id, { onDelete: "cascade" }),
		personHi: uuid().references(() => khPerson.id, { onDelete: "cascade" }),
		expenseId: uuid().references(() => khExpense.id, { onDelete: "cascade" }),
		paymentId: uuid().references(() => khPayment.id, { onDelete: "cascade" }),
		/** Who did it; null once that person is gone, and for what Kharcha did by itself. */
		actorId: uuid().references(() => khPerson.id, { onDelete: "set null" }),
		/** The person it was done to (a member added, a friend made). A column, not a key in `data`, so merging two people is an indexed update. */
		subjectId: uuid().references(() => khPerson.id, { onDelete: "set null" }),
		kind: text().$type<ActivityKind>().notNull(),
		/** `{ field, from, to }` for an edit, a title for the rest; never a person's id. */
		data: jsonb().$type<ActivityData>().notNull().default({}),
		at: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("kh_activity_group_idx").on(table.groupId, table.at),
		index("kh_activity_pair_idx").on(table.personLo, table.personHi, table.at),
		index("kh_activity_expense_idx").on(table.expenseId),
		index("kh_activity_payment_idx").on(table.paymentId),
		index("kh_activity_actor_idx").on(table.actorId),
		index("kh_activity_subject_idx").on(table.subjectId),
		check(
			"kh_activity_pair_ordered",
			sql`(${table.personLo} is null and ${table.personHi} is null) or ${table.personLo} < ${table.personHi}`,
		),
	],
);

export type KhActivityRow = typeof khActivity.$inferSelect;
