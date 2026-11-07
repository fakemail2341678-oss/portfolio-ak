import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import * as portfolio from "@/server/portfolio/public";
import { seedPortfolio } from "../../scripts/lib/portfolio-seed.ts";
import { createTestDb } from "../utils/test-db";

/**
 * The public pages' reads (src/server/portfolio/public.ts, decision 0176) over
 * the seeded demo content: published rows only, resolved to one language,
 * drafts only in a preview, and English text on a Nepali page marked lang=en.
 */

let testDb: Awaited<ReturnType<typeof createTestDb>>;
const services = () => ({ db: testDb.db, imageStore: null });
beforeAll(async () => {
	testDb = await createTestDb();
	await seedPortfolio(async (sql, params) => {
		const result = await testDb.client.query<Record<string, unknown>>(sql, params);
		return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
	});
}, 60_000);
afterAll(() => testDb.close());

describe("public portfolio reads", () => {
	it("the profile, in each language", async () => {
		const en = await portfolio.getProfile(services(), { locale: "en" });
		const ne = await portfolio.getProfile(services(), { locale: "ne" });
		expect(en).toMatchObject({ name: "Aarav Shrestha", initials: "AS", portrait: null, resume: null });
		expect(ne.name).toBe("आरव श्रेष्ठ");
		expect(ne).not.toHaveProperty("lang");
		expect(en.updated).toBe(new Date().getUTCFullYear());
	});

	it("the home page in one read: four featured projects in display order, the newest three posts", async () => {
		const home = await portfolio.getHome(services(), { locale: "en" });
		expect(home.featured).toHaveLength(4);
		expect(home.projectCount).toBe(7);
		expect(home.posts.map((post) => post.slug)).toEqual([
			"server-render-everything",
			"crdts-without-the-phd",
			"designing-for-two-scripts",
		]);
		expect(home.posts[0]?.readingMinutes).toBeGreaterThanOrEqual(1);
		expect(home.experience[0]?.end).toBeNull();
		expect(home.skills.length).toBeGreaterThan(0);
		expect(home.process.length).toBeGreaterThan(0);
		expect(home.testimonials).toHaveLength(4);
	});

	it("a case study with its place and the next one; a draft only in a preview", async () => {
		const detail = await portfolio.getProject(services(), "ledgerline", { locale: "en" });
		expect(detail).toMatchObject({ index: 1, total: 7, draft: false, project: { title: "Ledgerline" } });
		expect(detail?.project.body[0]).toMatchObject({ id: "block-1", type: "chapter" });
		expect(detail?.project.cover).toMatchObject({ seed: "ledgerline", image: null });

		await testDb.db
			.update(schema.portfolioProject)
			.set({ status: "draft" })
			.where(eq(schema.portfolioProject.slug, "ferry"));
		expect(await portfolio.getProject(services(), "ferry", { locale: "en" })).toBeNull();
		const preview = await portfolio.getProject(services(), "ferry", { locale: "en", drafts: true });
		expect(preview).toMatchObject({ draft: true, total: 7 });
		expect((await portfolio.listProjects(services(), { locale: "en" })).map((project) => project.slug)).not.toContain(
			"ferry",
		);
		await testDb.db
			.update(schema.portfolioProject)
			.set({ status: "published" })
			.where(eq(schema.portfolioProject.slug, "ferry"));
	});

	it("an article as sanitized HTML with the next older one; unknown slugs are null", async () => {
		const detail = await portfolio.getPost(services(), "postgres-is-enough", { locale: "ne" });
		expect(detail?.post.body).toContain("<h2>");
		expect(detail?.post.body).not.toContain("<script");
		expect(detail?.next.slug).toBe("shipping-for-slow-networks");
		expect(await portfolio.getPost(services(), "no-such-post", { locale: "en" })).toBeNull();
	});

	it("shows English where Nepali is missing, marked lang=en", async () => {
		await testDb.db
			.update(schema.portfolioTestimonial)
			.set({ quote: { en: "Untranslated quote", ne: "" }, role: { en: "CTO", ne: "" } })
			.where(eq(schema.portfolioTestimonial.name, "Daniel Okafor"));
		const { testimonials } = await portfolio.getAbout(services(), { locale: "ne" });
		const untranslated = testimonials.find((testimonial) => testimonial.name === "Daniel Okafor");
		expect(untranslated).toMatchObject({ quote: "Untranslated quote", lang: "en" });
		expect(testimonials.find((testimonial) => testimonial.name === "Priya Malla")).not.toHaveProperty("lang");
	});

	it("hides unpublished testimonials", async () => {
		await testDb.db
			.update(schema.portfolioTestimonial)
			.set({ published: false })
			.where(eq(schema.portfolioTestimonial.name, "Priya Malla"));
		const { testimonials } = await portfolio.getAbout(services(), { locale: "en" });
		expect(testimonials.map((testimonial) => testimonial.name)).not.toContain("Priya Malla");
	});
});
