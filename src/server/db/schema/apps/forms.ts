import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Answers, FormField } from "@/features/apps/forms/fields";
import { user } from "../auth";

/**
 * Forms (/apps/forms, decision 0195). Every row has `owner_id` (the user, a guest
 * included), deleted with them; the repository scopes every query by it (`ownedBy`).
 * A response carries its form's owner too, so the claim and the cleanup move and
 * delete it with the rest.
 */
const owner = () =>
	text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" });

export const form = pgTable(
	"form",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: owner(),
		/** The public page's path, /f/<slug>: random, made once, never changed. */
		slug: text().notNull(),
		title: text().notNull(),
		description: text().notNull().default(""),
		/** The questions, written only after `formFieldsSchema` (src/features/apps/forms/fields.ts). */
		fields: jsonb().$type<FormField[]>().notNull().default([]),
		status: text({ enum: ["draft", "published"] })
			.notNull()
			.default("draft"),
		publishedAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("form_slug_unique").on(table.slug),
		index("form_owner_idx").on(table.ownerId, table.updatedAt),
		check("form_status_valid", sql`${table.status} in ('draft', 'published')`),
	],
);

export const formResponse = pgTable(
	"form_response",
	{
		id: uuid().primaryKey().defaultRandom(),
		formId: uuid()
			.notNull()
			.references(() => form.id, { onDelete: "cascade" }),
		/** The form's owner (not the respondent, who has no account). */
		ownerId: owner(),
		/** Answers keyed by field id, after the form's `toZodSchema`. */
		data: jsonb().$type<Answers>().notNull(),
		submittedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		/** A keyed hash of the sender's IP (never the IP), for the rate limit; null when unknown or seeded. */
		ipHash: text(),
	},
	(table) => [
		index("form_response_form_idx").on(table.formId, table.submittedAt),
		index("form_response_owner_idx").on(table.ownerId),
	],
);

export type FormRow = typeof form.$inferSelect;
export type FormResponseRow = typeof formResponse.$inferSelect;
