import { sql } from "drizzle-orm";
import { bigint, check, date, index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { khGroup } from "./group";
import { khPerson } from "./person";

/**
 * Kharcha's payments (docs/guides/kharcha.md, decision 0278): settling up, recorded. No
 * money moves through Kharcha: `from_person` paid `to_person` somewhere else. A payment
 * settles a debt in that debt's currency (`amount_minor`, `currency`); when something else
 * changed hands, `paid_currency`, `paid_amount_minor` and the `rate` the payer typed note
 * it. Nothing is converted on its own.
 */
export const khPayment = pgTable(
	"kh_payment",
	{
		id: uuid().primaryKey().defaultRandom(),
		groupId: uuid().references(() => khGroup.id, { onDelete: "cascade" }),
		fromPerson: uuid()
			.notNull()
			.references(() => khPerson.id),
		toPerson: uuid()
			.notNull()
			.references(() => khPerson.id),
		amountMinor: bigint({ mode: "number" }).notNull(),
		currency: text().notNull(),
		paidCurrency: text(),
		paidAmountMinor: bigint({ mode: "number" }),
		/** A decimal as text (numeric): never read into a float. */
		rate: numeric({ precision: 18, scale: 8 }),
		/** How it was paid, as a label ("Cash", "eSewa"). */
		method: text().notNull().default(""),
		note: text().notNull().default(""),
		paidOn: date({ mode: "string" }).notNull(),
		createdBy: uuid()
			.notNull()
			.references(() => khPerson.id),
		version: integer().notNull().default(1),
		/** The trash, as an expense's. */
		deletedAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("kh_payment_group_idx").on(table.groupId, table.paidOn),
		index("kh_payment_from_idx").on(table.fromPerson),
		index("kh_payment_to_idx").on(table.toPerson),
		index("kh_payment_created_by_idx").on(table.createdBy),
		check("kh_payment_amount_positive", sql`${table.amountMinor} > 0`),
		check("kh_payment_two_people", sql`${table.fromPerson} <> ${table.toPerson}`),
		check("kh_payment_currency_code", sql`${table.currency} ~ '^[A-Z]{3}$'`),
		check(
			"kh_payment_paid_together",
			sql`(${table.paidCurrency} is null) = (${table.paidAmountMinor} is null) and (${table.paidCurrency} is null) = (${table.rate} is null)`,
		),
	],
);

export type KhPaymentRow = typeof khPayment.$inferSelect;
