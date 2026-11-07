import "@tanstack/react-start/server-only";
import { asc, desc, eq } from "drizzle-orm";
import { readingMinutes } from "@/features/portfolio/lib/reading-time";
import type { Discipline } from "@/features/portfolio/schema";
import type {
	AboutContent,
	Experience,
	HomeContent,
	PostDetail,
	PostSummary,
	ProcessStep,
	Profile,
	ProjectDetail,
	ProjectSummary,
	Skill,
	Testimonial,
} from "@/features/portfolio/types";
import { resolveLocalized } from "@/lib/i18n/localized";
import type { SafeHtml } from "@/lib/safe-html";
import type { Locale } from "@/paraglide/runtime";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { notFound } from "@/server/db/crud";
import {
	type PortfolioPostRow,
	type PortfolioProjectRow,
	portfolioExperience,
	portfolioPost,
	portfolioProcessStep,
	portfolioProject,
	portfolioSkill,
	portfolioTestimonial,
} from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { mediaAssets } from "@/server/media/repository";
import { sanitizeRichText } from "@/server/rich-text/sanitize";
import type { PublicServices } from "@/server/services";
import { findProfileRow } from "./profile-repository";

/**
 * The public pages' reads (decision 0176): published content only, resolved to
 * the page's language, one call per page (`getHome` is one round trip for the
 * whole story). A preview (`drafts`) also shows drafts; the server function
 * grants it only to holders of portfolio:read. No server cache: on Vercel a
 * cache cleared on write would reach one instance only.
 */

/** What a read is for: the page's language, and whether drafts may show (a preview). */
export type Reader = { locale: Locale; drafts?: boolean };

const RECENT_POSTS = 3;

/** Published rows show to everyone; drafts only in a preview. */
const visible = (row: { status: string }, drafts = false) => drafts || row.status === "published";

/** A timestamp as the calendar day (YYYY-MM-DD, UTC) the pages show. */
const day = (date: Date) => date.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile({ db, imageStore }: PublicServices, { locale }: Reader): Promise<Profile> {
	const row = await findProfileRow(db);
	if (!row) throw notFound("Profile");
	const assets = await mediaAssets(db, imageStore, [row.portraitId, row.resumeId, row.ogImageId]);
	const asset = (id: string | null) => (id ? (assets.get(id) ?? null) : null);
	const text = resolveLocalized(
		{
			name: row.name,
			role: row.role,
			location: row.location,
			headline: row.headline,
			intro: row.intro,
			manifesto: row.manifesto,
			bio: row.bio,
			principles: row.principles,
			impact: row.impact,
			note: row.availabilityNote,
			seoTitle: row.seoTitle,
			seoDescription: row.seoDescription,
		},
		locale,
	);
	return {
		...(text.lang ? { lang: text.lang } : {}),
		name: text.name,
		initials: row.initials,
		role: text.role,
		location: text.location,
		timezone: row.timezone,
		email: row.email,
		availability: { status: row.availabilityStatus, note: text.note },
		headline: text.headline,
		intro: text.intro,
		manifesto: text.manifesto,
		bio: text.bio,
		principles: text.principles,
		impact: text.impact,
		socials: row.socials,
		toolbox: row.toolbox,
		since: row.since,
		updated: row.updatedAt.getUTCFullYear(),
		portrait: asset(row.portraitId),
		resume: asset(row.resumeId)?.url ?? null,
		seo: {
			title: text.seoTitle,
			description: text.seoDescription,
			image: asset(row.ogImageId) ?? asset(row.portraitId),
		},
		generatedAt: new Date().toISOString(),
	};
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const projectOrder = [asc(portfolioProject.sortOrder), asc(portfolioProject.title)];

async function projectSummaries(
	db: Db,
	store: ImageStore | null,
	rows: ReadonlyArray<PortfolioProjectRow>,
	locale: Locale,
): Promise<ProjectSummary[]> {
	const assets = await mediaAssets(
		db,
		store,
		rows.map((row) => row.coverId),
	);
	return rows.map((row) => summary(row, row.coverId ? (assets.get(row.coverId) ?? null) : null, locale));
}

function summary(row: PortfolioProjectRow, image: ProjectSummary["cover"]["image"], locale: Locale): ProjectSummary {
	const text = resolveLocalized(
		{ client: row.client, role: row.role, duration: row.duration, summary: row.summary, metrics: row.metrics },
		locale,
	);
	return {
		...(text.lang ? { lang: text.lang } : {}),
		slug: row.slug,
		title: row.title,
		client: text.client,
		year: row.year,
		disciplines: row.disciplines as Discipline[],
		role: text.role,
		duration: text.duration,
		summary: text.summary,
		stack: row.stack,
		featured: row.featured,
		cover: { motif: row.motif, glyph: row.glyph, seed: row.artSeed || row.slug, image },
		metrics: text.metrics,
	};
}

const publishedProjects = (db: Db) =>
	db
		.select()
		.from(portfolioProject)
		.where(eq(portfolioProject.status, "published"))
		.orderBy(...projectOrder);

/** Every published project in display order (the work index filters them by discipline). */
export async function listProjects({ db, imageStore }: PublicServices, { locale }: Reader): Promise<ProjectSummary[]> {
	return projectSummaries(db, imageStore, await publishedProjects(db), locale);
}

/**
 * A case study by slug, with its place among the published projects and the
 * next one (wrapping). A draft shows only in a preview, after the published ones.
 */
export async function getProject(
	{ db, imageStore }: PublicServices,
	slug: string,
	{ locale, drafts = false }: Reader,
): Promise<ProjectDetail | null> {
	const [row] = await db.select().from(portfolioProject).where(eq(portfolioProject.slug, slug));
	if (!row || !visible(row, drafts)) return null;
	const published = await publishedProjects(db);
	const ordered = row.status === "published" ? published : [...published, row];
	const position = ordered.findIndex((project) => project.id === row.id);
	const nextRow = ordered[(position + 1) % ordered.length] ?? row;
	const assets = await mediaAssets(db, imageStore, [row.coverId, nextRow.coverId, ...row.gallery]);
	const asset = (id: string | null) => (id ? (assets.get(id) ?? null) : null);
	const base = summary(row, asset(row.coverId), locale);
	const next = summary(nextRow, asset(nextRow.coverId), locale);
	const content = resolveLocalized({ links: row.links, body: row.blocks }, locale);
	return {
		project: {
			...base,
			links: content.links,
			body: content.body,
			gallery: row.gallery.flatMap((id) => assets.get(id) ?? []),
			appSlug: row.appSlug, // @apps
		},
		index: position + 1,
		total: ordered.length,
		next: { slug: next.slug, title: next.title, client: next.client, cover: next.cover },
		draft: row.status !== "published",
	};
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

const postOrder = [desc(portfolioPost.publishedAt), asc(portfolioPost.slug)];

function postSummary(row: PortfolioPostRow, cover: PostSummary["cover"], locale: Locale): PostSummary {
	const text = resolveLocalized({ title: row.title, excerpt: row.excerpt, body: row.body }, locale);
	return {
		...(text.lang ? { lang: text.lang } : {}),
		slug: row.slug,
		title: text.title,
		excerpt: text.excerpt,
		publishedAt: day(row.publishedAt ?? row.updatedAt),
		tags: row.tags,
		readingMinutes: readingMinutes(text.body),
		cover,
	};
}

async function postSummaries(
	db: Db,
	store: ImageStore | null,
	rows: ReadonlyArray<PortfolioPostRow>,
	locale: Locale,
): Promise<PostSummary[]> {
	const assets = await mediaAssets(
		db,
		store,
		rows.map((row) => row.coverId),
	);
	return rows.map((row) => postSummary(row, row.coverId ? (assets.get(row.coverId) ?? null) : null, locale));
}

const publishedPosts = (db: Db, limit?: number) => {
	const query = db
		.select()
		.from(portfolioPost)
		.where(eq(portfolioPost.status, "published"))
		.orderBy(...postOrder);
	return limit === undefined ? query : query.limit(limit);
};

/** Published posts, newest first. */
export async function listPosts({ db, imageStore }: PublicServices, { locale }: Reader): Promise<PostSummary[]> {
	return postSummaries(db, imageStore, await publishedPosts(db), locale);
}

/** An article by slug and the next older one (wrapping to the newest). A draft shows only in a preview. */
export async function getPost(
	{ db, imageStore }: PublicServices,
	slug: string,
	{ locale, drafts = false }: Reader,
): Promise<PostDetail | null> {
	const [row] = await db.select().from(portfolioPost).where(eq(portfolioPost.slug, slug));
	if (!row || !visible(row, drafts)) return null;
	const published = await publishedPosts(db);
	const ordered = row.status === "published" ? published : [row, ...published];
	const position = ordered.findIndex((post) => post.id === row.id);
	const nextRow = ordered[(position + 1) % ordered.length] ?? row;
	const assets = await mediaAssets(db, imageStore, [row.coverId]);
	const base = postSummary(row, row.coverId ? (assets.get(row.coverId) ?? null) : null, locale);
	const next = postSummary(nextRow, null, locale);
	const body = resolveLocalized(row.body, locale);
	return {
		post: { ...base, body: sanitizeRichText(body) as SafeHtml },
		next: { slug: next.slug, title: next.title, publishedAt: next.publishedAt },
		draft: row.status !== "published",
	};
}

// ---------------------------------------------------------------------------
// Ordered sections
// ---------------------------------------------------------------------------

async function experience(db: Db, locale: Locale): Promise<Experience[]> {
	const rows = await db
		.select()
		.from(portfolioExperience)
		.orderBy(asc(portfolioExperience.sortOrder), asc(portfolioExperience.createdAt));
	return rows.map(({ sortOrder: _o, createdAt: _c, updatedAt: _u, ...row }) => resolveLocalized(row, locale));
}

async function skills(db: Db, locale: Locale): Promise<Skill[]> {
	const rows = await db
		.select()
		.from(portfolioSkill)
		.orderBy(asc(portfolioSkill.sortOrder), asc(portfolioSkill.createdAt));
	return rows.map(({ sortOrder: _o, createdAt: _c, updatedAt: _u, ...row }) => resolveLocalized(row, locale));
}

async function process(db: Db, locale: Locale): Promise<ProcessStep[]> {
	const rows = await db
		.select()
		.from(portfolioProcessStep)
		.orderBy(asc(portfolioProcessStep.sortOrder), asc(portfolioProcessStep.createdAt));
	return rows.map(({ sortOrder: _o, createdAt: _c, updatedAt: _u, ...row }) => resolveLocalized(row, locale));
}

/** Published testimonials only (the rest wait for the person's approval). */
async function testimonials(db: Db, locale: Locale): Promise<Testimonial[]> {
	const rows = await db
		.select()
		.from(portfolioTestimonial)
		.where(eq(portfolioTestimonial.published, true))
		.orderBy(asc(portfolioTestimonial.sortOrder), asc(portfolioTestimonial.createdAt));
	return rows.map(({ sortOrder: _o, createdAt: _c, updatedAt: _u, published: _p, ...row }) =>
		resolveLocalized(row, locale),
	);
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/** The home page's story in one round trip (the profile comes with the layout). */
export async function getHome({ db, imageStore }: PublicServices, { locale }: Reader): Promise<HomeContent> {
	const [projects, posts, experienceRows, skillRows, processRows, testimonialRows] = await Promise.all([
		publishedProjects(db),
		publishedPosts(db, RECENT_POSTS),
		experience(db, locale),
		skills(db, locale),
		process(db, locale),
		testimonials(db, locale),
	]);
	const [featured, recent] = await Promise.all([
		projectSummaries(
			db,
			imageStore,
			projects.filter((project) => project.featured),
			locale,
		),
		postSummaries(db, imageStore, posts, locale),
	]);
	return {
		featured,
		projectCount: projects.length,
		experience: experienceRows,
		skills: skillRows,
		process: processRows,
		testimonials: testimonialRows,
		posts: recent,
	};
}

export async function getAbout({ db }: PublicServices, { locale }: Reader): Promise<AboutContent> {
	const [experienceRows, skillRows, testimonialRows] = await Promise.all([
		experience(db, locale),
		skills(db, locale),
		testimonials(db, locale),
	]);
	return { experience: experienceRows, skills: skillRows, testimonials: testimonialRows };
}

/** Every published slug with its last change, for the sitemap. */
export async function listSitemap(db: Db): Promise<{
	projects: Array<{ slug: string; updatedAt: Date }>;
	posts: Array<{ slug: string; updatedAt: Date }>;
}> {
	const [projects, posts] = await Promise.all([
		db
			.select({ slug: portfolioProject.slug, updatedAt: portfolioProject.updatedAt })
			.from(portfolioProject)
			.where(eq(portfolioProject.status, "published"))
			.orderBy(...projectOrder),
		db
			.select({ slug: portfolioPost.slug, updatedAt: portfolioPost.updatedAt })
			.from(portfolioPost)
			.where(eq(portfolioPost.status, "published"))
			.orderBy(...postOrder),
	]);
	return { projects, posts };
}
// apps:start

/**
 * Which published case study tells each showcase app's story (decision 0187): a project
 * names its app in the admin's "App" field; the apps' header links back to it.
 */
export async function listAppCaseStudies(db: Db): Promise<Array<{ app: string; slug: string }>> {
	const rows = await db
		.select({ app: portfolioProject.appSlug, slug: portfolioProject.slug })
		.from(portfolioProject)
		.where(eq(portfolioProject.status, "published"))
		.orderBy(...projectOrder);
	return rows.flatMap((row) => (row.app ? [{ app: row.app, slug: row.slug }] : []));
}
// apps:end
