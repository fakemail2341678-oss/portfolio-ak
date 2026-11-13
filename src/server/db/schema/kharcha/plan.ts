import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	date,
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
import type { BudgetPeriod } from "@/features/kharcha/budgets/period";
import type { RecurringUnit } from "@/features/kharcha/recurring/cadence";
import type { RecurringProblem, RecurringTemplate } from "@/features/kharcha/types";
import { khGroup } from "./group";
import { khCategory } from "./lists";
import { khPerson } from "./person";

/**
 * Planning (Task 94, decision 0288; docs/guides/kharcha.md "Budgets" and "Recurring
 * expenses"): budgets with their own months and the alerts they sent, and recurring
 * expenses. Each is one person's own, like their lists; nobody else sees it.
 */

/**
 * A budget: a limit on the owner's spending (their share, refunds against it) in one
 * currency per week, month or year, for one of their categories or everything (no
 * category). It applies from the period holding `starts_on`. One per category, currency
 * and period.
 */
export const khBudget = pgTable(
	"kh_budget",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		/** Null: everything they spend in the currency. Deleting the category deletes its budget. */
		categoryId: uuid().references(() => khCategory.id, { onDelete: "cascade" }),
		currency: text().notNull(),
		period: text().$type<BudgetPeriod>().notNull(),
		amountMinor: bigint({ mode: "number" }).notNull(),
		startsOn: date({ mode: "string" }).notNull(),
		version: integer().notNull().default(1),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("kh_budget_unique").on(
			table.ownerId,
			sql`coalesce(${table.categoryId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
			table.currency,
			table.period,
		),
		index("kh_budget_category_idx").on(table.categoryId),
		check("kh_budget_amount_positive", sql`${table.amountMinor} > 0`),
		check("kh_budget_period_valid", sql`${table.period} in ('week', 'month', 'year')`),
		check("kh_budget_currency_code", sql`${table.currency} ~ '^[A-Z]{3}$'`),
	],
);

/** A monthly budget's own amount for one month (`month` is its first day). */
export const khBudgetMonth = pgTable(
	"kh_budget_month",
	{
		budgetId: uuid()
			.notNull()
			.references(() => khBudget.id, { onDelete: "cascade" }),
		month: date({ mode: "string" }).notNull(),
		amountMinor: bigint({ mode: "number" }).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.budgetId, table.month] }),
		check("kh_budget_month_amount_positive", sql`${table.amountMinor} > 0`),
		check("kh_budget_month_first_day", sql`extract(day from ${table.month}) = 1`),
	],
);

/** An alert a budget sent: once per period and threshold (80 or 100), by the daily job. */
export const khBudgetAlert = pgTable(
	"kh_budget_alert",
	{
		budgetId: uuid()
			.notNull()
			.references(() => khBudget.id, { onDelete: "cascade" }),
		periodStart: date({ mode: "string" }).notNull(),
		threshold: integer().notNull(),
		sentAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.budgetId, table.periodStart, table.threshold] }),
		check("kh_budget_alert_threshold_valid", sql`${table.threshold} in (80, 100)`),
	],
);

/**
 * A recurring expense: an expense to make again (`template`: what it is, who paid, the
 * split, the owner's own category, method and tags) every `every` weeks, months or years
 * from `starts_on` (occurrence 0, the expense it was made from), until `ends_on`. The daily
 * job makes occurrence `next_n` on `next_on` and those after it it missed (catch-up); each
 * expense it makes carries the recurring id and `seq`, unique together, so none is made twice.
 */
export const khRecurring = pgTable(
	"kh_recurring",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		/** The group its expenses go in; leaving the group stops it (it can't be made). */
		groupId: uuid().references(() => khGroup.id, { onDelete: "cascade" }),
		template: jsonb().$type<RecurringTemplate>().notNull(),
		unit: text().$type<RecurringUnit>().notNull(),
		every: integer().notNull().default(1),
		/** The day occurrences are counted from: the first expense's, or the last made before the cadence changed. */
		startsOn: date({ mode: "string" }).notNull(),
		/** The next occurrence's place counted from `starts_on`, and its day. */
		nextN: integer().notNull(),
		nextOn: date({ mode: "string" }).notNull(),
		/** The number the next expense it makes carries (the first is 0): never reused, so none is made twice. */
		seq: integer().notNull().default(1),
		endsOn: date({ mode: "string" }),
		pausedAt: timestamp({ withTimezone: true }),
		/** Why the daily job paused it: it couldn't make the expense (the group, the people, a quota). */
		problem: text().$type<RecurringProblem>(),
		lastMadeOn: date({ mode: "string" }),
		version: integer().notNull().default(1),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("kh_recurring_owner_idx").on(table.ownerId),
		index("kh_recurring_group_idx").on(table.groupId),
		index("kh_recurring_due_idx").on(table.nextOn).where(sql`${table.pausedAt} is null`),
		check("kh_recurring_unit_valid", sql`${table.unit} in ('week', 'month', 'year')`),
		check("kh_recurring_every_range", sql`${table.every} between 1 and 52`),
	],
);

export type KhBudgetRow = typeof khBudget.$inferSelect;
export type KhRecurringRow = typeof khRecurring.$inferSelect;
