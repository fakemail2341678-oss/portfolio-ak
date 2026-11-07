/**
 * The portfolio's demo content, written by `pnpm db:seed-portfolio`
 * (scripts/seed-portfolio.ts), the e2e harness, `pnpm dev:local`/`setup:local`
 * and `pnpm db:seed-demo`, so `/` is never empty (decision 0176). Plain SQL
 * through an injected `query`, like ./demo-data.ts (tested on PGlite).
 *
 * Idempotent and never destructive: once a profile exists the owner's content
 * is theirs, and nothing is written.
 *
 * Run by Node directly (type stripping): relative `.ts` imports only.
 */
import { randomUUID } from "node:crypto";
import type { DemoQuery } from "./demo-data.ts";
import { proseToHtml, toStoredBlocks } from "./portfolio-content.ts";
import {
	capabilities,
	experience,
	posts,
	processSteps,
	profile,
	projects,
	testimonials,
} from "./portfolio-data/index.ts";
import type { PostRecord, ProjectRecord } from "./portfolio-data/types.ts";

const json = (value: unknown) => JSON.stringify(value);
/** The old fixture order: newest year first, the file's order breaking ties. */
const displayOrder = (list: ReadonlyArray<ProjectRecord>) =>
	list
		.map((project, order) => ({ project, order }))
		.sort((a, b) => b.project.year - a.project.year || a.order - b.order)
		.map(({ project }) => project);

const noon = (date: string) => `${date}T12:00:00Z`;

async function insertProject(query: DemoQuery, project: ProjectRecord, sortOrder: number, now: Date) {
	await query(
		`insert into "portfolio_project" ("id", "slug", "title", "client", "year", "disciplines", "role", "duration",
			"summary", "stack", "links", "metrics", "blocks", "motif", "glyph", "featured", "sort_order", "status", "published_at")
		 values ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11::jsonb, $12::jsonb, $13::jsonb,
			$14, $15, $16, $17, 'published', $18)
		 on conflict ("slug") do nothing`,
		[
			randomUUID(),
			project.slug,
			project.title,
			json(project.client),
			project.year,
			project.disciplines,
			json(project.role),
			json(project.duration),
			json(project.summary),
			project.stack,
			json(project.links),
			json(project.metrics),
			json(toStoredBlocks(project.body)),
			project.cover.motif,
			project.cover.glyph,
			project.featured,
			sortOrder,
			now.toISOString(),
		],
	);
}

async function insertPost(query: DemoQuery, post: PostRecord) {
	await query(
		`insert into "portfolio_post" ("id", "slug", "title", "excerpt", "body", "tags", "status", "published_at")
		 values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, 'published', $7)
		 on conflict ("slug") do nothing`,
		[
			randomUUID(),
			post.slug,
			json(post.title),
			json(post.excerpt),
			json({ en: proseToHtml(post.body, "en"), ne: proseToHtml(post.body, "ne") }),
			post.tags,
			noon(post.publishedAt),
		],
	);
}

/**
 * Writes the demo profile, projects, posts and sections when there is no
 * profile yet. Returns whether it wrote anything.
 */
export async function seedPortfolio(query: DemoQuery, { now = new Date() } = {}): Promise<{ seeded: boolean }> {
	const existing = await query(`select 1 from "portfolio_profile" where "id" = 'profile'`);
	if (existing.rows.length > 0) return { seeded: false };

	await query(
		`insert into "portfolio_profile" ("id", "name", "initials", "role", "location", "timezone", "email",
			"availability_status", "availability_note", "headline", "intro", "manifesto", "bio", "principles", "impact",
			"socials", "toolbox", "since")
		 values ('profile', $1::jsonb, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb,
			$12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17)`,
		[
			json(profile.name),
			profile.initials,
			json(profile.role),
			json(profile.location),
			profile.timezone,
			profile.email,
			profile.availability.status,
			json(profile.availability.note),
			json(profile.headline),
			json(profile.intro),
			json(profile.manifesto),
			json(profile.bio),
			json(profile.principles),
			json(profile.impact),
			json(profile.socials),
			profile.toolbox,
			profile.since,
		],
	);

	for (const [order, project] of displayOrder(projects).entries()) await insertProject(query, project, order, now);
	for (const post of posts) await insertPost(query, post);

	// Current position first, then by end date.
	const byEnd = [...experience].sort((a, b) => (b.end ?? "9999-12").localeCompare(a.end ?? "9999-12"));
	for (const [order, entry] of byEnd.entries()) {
		await query(
			`insert into "portfolio_experience" ("company", "role", "start", "end", "location", "summary", "sort_order")
			 values ($1, $2::jsonb, $3, $4, $5::jsonb, $6::jsonb, $7)`,
			[entry.company, json(entry.role), entry.start, entry.end, json(entry.location), json(entry.summary), order],
		);
	}
	for (const [order, skill] of capabilities.entries()) {
		await query(
			`insert into "portfolio_skill" ("title", "summary", "skills", "sort_order") values ($1::jsonb, $2::jsonb, $3, $4)`,
			[json(skill.title), json(skill.summary), skill.skills, order],
		);
	}
	for (const [order, step] of processSteps.entries()) {
		await query(
			`insert into "portfolio_process_step" ("title", "body", "outputs", "sort_order")
			 values ($1::jsonb, $2::jsonb, $3::jsonb, $4)`,
			[json(step.title), json(step.body), json(step.outputs), order],
		);
	}
	for (const [order, testimonial] of testimonials.entries()) {
		await query(
			`insert into "portfolio_testimonial" ("quote", "name", "role", "company", "published", "sort_order")
			 values ($1::jsonb, $2, $3::jsonb, $4, true, $5)`,
			[json(testimonial.quote), testimonial.name, json(testimonial.role), testimonial.company, order],
		);
	}
	return { seeded: true };
}
