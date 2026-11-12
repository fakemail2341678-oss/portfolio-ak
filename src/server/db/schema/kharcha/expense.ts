import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import type { Split } from "@/features/kharcha/money/split";
import type { ExpenseKind } from "@/features/kharcha/types";
import { khGroup } from "./group";
import { khCategory, khMethod, khTag } from "./lists";
import { khPerson } from "./person";

/**
 * Kharcha's expenses (docs/guides/kharcha.md, decision 0278). An expense is an amount in
 * one currency, who paid it (`kh_expense_payer`, together the amount) and what each person
 * owes of it (`kh_expense_share`, together the amount). Amounts are integers in the
 * currency's minor unit, never floats. A personal expense has one payer and one share, the
 * same person; `split` keeps how the shares were entered, so the editor opens as it was left.
 */
export const khExpense = pgTable(
	"kh_expense",
	{
		id: uuid().primaryKey().defaultRandom(),
		/** The group it belongs to; null for a personal expense or one shared with friends. */
		groupId: uuid().references(() => khGroup.id, { onDelete: "cascade" }),
		createdBy: uuid()
			.notNull()
			.references(() => khPerson.id),
		/** A refund is money that came back: negative spending, and its debts run the other way. */
		kind: text().$type<ExpenseKind>().notNull().default("expense"),
		title: text().notNull().default(""),
		merchant: text().notNull().default(""),
		notes: text().notNull().default(""),
		amountMinor: bigint({ mode: "number" }).notNull(),
		currency: text().notNull(),
		/** The calendar day it was spent. */
		spentOn: date({ mode: "string" }).notNull(),
		/** The split's method and inputs (src/features/kharcha/money/split.ts). */
		split: jsonb().$type<Split>().notNull(),
		/** Bumped by each save of the expense's form: a stale save is refused. */
		version: integer().notNull().default(1),
		/** The trash: restorable for 30 days, its ledger rows gone until then. */
		deletedAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("kh_expense_group_idx").on(table.groupId, table.spentOn),
		index("kh_expense_created_by_idx").on(table.createdBy),
		index("kh_expense_trash_idx").on(table.deletedAt).where(sql`${table.deletedAt} is not null`),
		check("kh_expense_amount_positive", sql`${table.amountMinor} > 0`),
		check("kh_expense_kind_valid", sql`${table.kind} in ('expense', 'refund')`),
		check("kh_expense_currency_code", sql`${table.currency} ~ '^[A-Z]{3}$'`),
	],
);

/** Who paid an expense. `position` is the order they were entered in: it orders the ledger's matching. */
export const khExpensePayer = pgTable(
	"kh_expense_payer",
	{
		expenseId: uuid()
			.notNull()
			.references(() => khExpense.id, { onDelete: "cascade" }),
		personId: uuid()
			.notNull()
			.references(() => khPerson.id),
		amountMinor: bigint({ mode: "number" }).notNull(),
		position: integer().notNull(),
		/** How they paid: one of their own methods (Task 89). */
		methodId: uuid().references(() => khMethod.id, { onDelete: "set null" }),
	},
	(table) => [
		primaryKey({ columns: [table.expenseId, table.personId] }),
		index("kh_expense_payer_person_idx").on(table.personId),
		check("kh_expense_payer_amount_positive", sql`${table.amountMinor} > 0`),
	],
);

/**
 * What each person owes of an expense: their spending. Everyone the split names has a row,
 * even at zero, so the people on an expense are its payers and its shares, and nobody has
 * to be looked for inside `split`.
 */
export const khExpenseShare = pgTable(
	"kh_expense_share",
	{
		expenseId: uuid()
			.notNull()
			.references(() => khExpense.id, { onDelete: "cascade" }),
		personId: uuid()
			.notNull()
			.references(() => khPerson.id),
		owedMinor: bigint({ mode: "number" }).notNull(),
		position: integer().notNull(),
		/** Their own category for their part (Task 89); null: uncategorized, a fix badge. */
		categoryId: uuid().references(() => khCategory.id, { onDelete: "set null" }),
		/** They said it isn't a duplicate of a similar expense: the badge stays away. */
		duplicateOk: boolean().notNull().default(false),
	},
	(table) => [
		primaryKey({ columns: [table.expenseId, table.personId] }),
		index("kh_expense_share_person_idx").on(table.personId),
		index("kh_expense_share_category_idx").on(table.categoryId),
		check("kh_expense_share_owed_not_negative", sql`${table.owedMinor} >= 0`),
	],
);

/** The tags a share's person put on their part of the expense. */
export const khShareTag = pgTable(
	"kh_share_tag",
	{
		expenseId: uuid()
			.notNull()
			.references(() => khExpense.id, { onDelete: "cascade" }),
		personId: uuid()
			.notNull()
			.references(() => khPerson.id),
		tagId: uuid()
			.notNull()
			.references(() => khTag.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.expenseId, table.personId, table.tagId] }),
		index("kh_share_tag_tag_idx").on(table.tagId),
		index("kh_share_tag_person_idx").on(table.personId),
	],
);

export type KhExpenseRow = typeof khExpense.$inferSelect;
export type KhExpensePayerRow = typeof khExpensePayer.$inferSelect;
export type KhExpenseShareRow = typeof khExpenseShare.$inferSelect;
