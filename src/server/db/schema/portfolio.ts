import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import {
	AVAILABILITY_STATUSES,
	COVER_MOTIFS,
	PORTFOLIO_STATUSES,
	PROFILE_ID,
} from "../../../features/portfolio/constants";
// Types only (erased at runtime): drizzle-kit reads this file without path aliases.
import type { CaseStudyBlockRecord, MetricRecord } from "../../../features/portfolio/schema";
import { attachment } from "./attachments";
import { user } from "./auth";
import { EMPTY_LOCALIZED, type LocalizedJson, localizedText } from "./columns";

/**
 * The portfolio's content (decision 0176), edited under /admin/portfolio and
 * read by the public pages at `/`. Localized fields are `{ en, ne }` jsonb;
 * structured content (blocks, metrics, links) is jsonb validated by the Zod
 * schemas in features/portfolio/schema.ts before every write. Images are
 * media-library attachments, referenced by id (`restrict`: a used image can't
 * be deleted). `updatedAt` is each row's version (0122).
 */

export const portfolioStatus = pgEnum("portfolio_status", PORTFOLIO_STATUSES);
export const portfolioAvailability = pgEnum("portfolio_availability", AVAILABILITY_STATUSES);
export const portfolioMotif = pgEnum("portfolio_motif", COVER_MOTIFS);

const media = () => uuid().references(() => attachment.id, { onDelete: "restrict" });
const timestamps = {
	createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
};

/** The owner: one row (id "profile"). */
export const portfolioProfile = pgTable(
	"portfolio_profile",
	{
		id: text().primaryKey().default(PROFILE_ID),
		name: localizedText().notNull(),
		initials: text().notNull(),
		role: localizedText().notNull(),
		location: localizedText().notNull(),
		timezone: text().notNull(),
		email: text().notNull(),
		availabilityStatus: portfolioAvailability().notNull().default("open"),
		availabilityNote: localizedText().notNull().default(EMPTY_LOCALIZED),
		headline: jsonb().$type<LocalizedJson[]>().notNull().default([]),
		intro: localizedText().notNull(),
		manifesto: localizedText().notNull(),
		bio: jsonb().$type<LocalizedJson[]>().notNull().default([]),
		principles: jsonb().$type<Array<{ title: LocalizedJson; body: LocalizedJson }>>().notNull().default([]),
		impact: jsonb().$type<MetricRecord[]>().notNull().default([]),
		socials: jsonb().$type<Array<{ network: string; handle: string; href: string }>>().notNull().default([]),
		toolbox: text().array().notNull().default(sql`'{}'::text[]`),
		since: integer().notNull(),
		portraitId: media(),
		resumeId: media(),
		seoTitle: localizedText().notNull().default(EMPTY_LOCALIZED),
		seoDescription: localizedText().notNull().default(EMPTY_LOCALIZED),
		ogImageId: media(),
		updatedAt: timestamps.updatedAt,
	},
	(table) => [check("portfolio_profile_single", sql`${table.id} = 'profile'`)],
);

export const portfolioProject = pgTable(
	"portfolio_project",
	{
		id: uuid().primaryKey().defaultRandom(),
		slug: text().notNull(),
		/** A product name: the same in every language. */
		title: text().notNull(),
		client: localizedText().notNull(),
		year: integer().notNull(),
		disciplines: text().array().notNull().default(sql`'{}'::text[]`),
		role: localizedText().notNull(),
		duration: localizedText().notNull(),
		summary: localizedText().notNull(),
		stack: text().array().notNull().default(sql`'{}'::text[]`),
		links: jsonb().$type<Array<{ label: LocalizedJson; href: string }>>().notNull().default([]),
		metrics: jsonb().$type<MetricRecord[]>().notNull().default([]),
		blocks: jsonb().$type<CaseStudyBlockRecord[]>().notNull().default([]),
		coverId: media(),
		/** Media-library images, in order. */
		gallery: uuid().array().notNull().default(sql`'{}'::uuid[]`),
		/** Seeds the generated cover art; empty means the slug. */
		artSeed: text().notNull().default(""),
		motif: portfolioMotif().notNull().default("grid"),
		glyph: text().notNull(),
		// apps:start
		/** The showcase app this project opens (/apps/<slug>). */
		appSlug: text(),
		// apps:end
		featured: boolean().notNull().default(false),
		/** Display order (drag to reorder in the admin): smallest first. */
		sortOrder: integer().notNull().default(0),
		status: portfolioStatus().notNull().default("draft"),
		publishedAt: timestamp({ withTimezone: true }),
		createdBy: text().references(() => user.id, { onDelete: "set null" }),
		...timestamps,
	},
	(table) => [
		uniqueIndex("portfolio_project_slug_unique").on(table.slug),
		index("portfolio_project_order_idx").on(table.status, table.sortOrder),
	],
);

export const portfolioPost = pgTable(
	"portfolio_post",
	{
		id: uuid().primaryKey().defaultRandom(),
		slug: text().notNull(),
		title: localizedText().notNull(),
		excerpt: localizedText().notNull(),
		/** Sanitized rich-text HTML per language (sanitizeRichText), never stored raw. */
		body: localizedText().notNull(),
		tags: text().array().notNull().default(sql`'{}'::text[]`),
		coverId: media(),
		status: portfolioStatus().notNull().default("draft"),
		publishedAt: timestamp({ withTimezone: true }),
		createdBy: text().references(() => user.id, { onDelete: "set null" }),
		...timestamps,
	},
	(table) => [
		uniqueIndex("portfolio_post_slug_unique").on(table.slug),
		index("portfolio_post_published_idx").on(table.status, table.publishedAt),
	],
);

const ordered = { sortOrder: integer().notNull().default(0), ...timestamps };

export const portfolioExperience = pgTable("portfolio_experience", {
	id: uuid().primaryKey().defaultRandom(),
	company: text().notNull(),
	role: localizedText().notNull(),
	/** YYYY-MM. */
	start: text().notNull(),
	/** YYYY-MM; null: the current position. */
	end: text(),
	location: localizedText().notNull(),
	summary: localizedText().notNull(),
	...ordered,
});

/** What the public pages call capabilities: an area of work and its tools. */
export const portfolioSkill = pgTable("portfolio_skill", {
	id: uuid().primaryKey().defaultRandom(),
	title: localizedText().notNull(),
	summary: localizedText().notNull(),
	skills: text().array().notNull().default(sql`'{}'::text[]`),
	...ordered,
});

export const portfolioProcessStep = pgTable("portfolio_process_step", {
	id: uuid().primaryKey().defaultRandom(),
	title: localizedText().notNull(),
	body: localizedText().notNull(),
	outputs: jsonb().$type<LocalizedJson[]>().notNull().default([]),
	...ordered,
});

export const portfolioTestimonial = pgTable("portfolio_testimonial", {
	id: uuid().primaryKey().defaultRandom(),
	quote: localizedText().notNull(),
	name: text().notNull(),
	role: localizedText().notNull(),
	company: text().notNull(),
	published: boolean().notNull().default(true),
	...ordered,
});

/** Messages from the public contact form (/contact), read in the admin inbox. */
export const portfolioContactMessage = pgTable(
	"portfolio_contact_message",
	{
		id: uuid().primaryKey().defaultRandom(),
		name: text().notNull(),
		email: text().notNull(),
		message: text().notNull(),
		/** The language the sender wrote from (replies in it). */
		locale: text().notNull(),
		readAt: timestamp({ withTimezone: true }),
		archivedAt: timestamp({ withTimezone: true }),
		/** A keyed hash of the sender's IP (never the IP): the rate limit's key, and spotting floods. */
		ipHash: text(),
		createdAt: timestamps.createdAt,
	},
	(table) => [index("portfolio_contact_message_inbox_idx").on(table.archivedAt, table.createdAt)],
);

export type PortfolioProfileRow = typeof portfolioProfile.$inferSelect;
export type PortfolioProjectRow = typeof portfolioProject.$inferSelect;
export type PortfolioPostRow = typeof portfolioPost.$inferSelect;
export type PortfolioExperienceRow = typeof portfolioExperience.$inferSelect;
export type PortfolioSkillRow = typeof portfolioSkill.$inferSelect;
export type PortfolioProcessStepRow = typeof portfolioProcessStep.$inferSelect;
export type PortfolioTestimonialRow = typeof portfolioTestimonial.$inferSelect;
export type PortfolioContactMessageRow = typeof portfolioContactMessage.$inferSelect;
