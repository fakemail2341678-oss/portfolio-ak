import { describe, expect, it } from "vitest";
import {
	experienceInputSchema,
	postInputSchema,
	processStepInputSchema,
	profileInputSchema,
	projectInputSchema,
	skillInputSchema,
	testimonialInputSchema,
} from "@/features/portfolio/schema";
import { isLocalized } from "@/lib/i18n/localized";
import { proseToHtml, toStoredBlocks } from "../../scripts/lib/portfolio-content.ts";
import {
	capabilities,
	experience,
	posts,
	processSteps,
	profile,
	projects,
	testimonials,
} from "../../scripts/lib/portfolio-data/index.ts";

/**
 * The demo content (scripts/lib/portfolio-data, what `pnpm db:seed-portfolio`
 * writes) checked against what the admin enforces: every record, in the
 * database's shape, passes the admin's input schema, slugs are unique, every
 * Nepali text is in Devanagari, and diagrams only connect the boxes they declare.
 */

const DEVANAGARI = /[ऀ-ॿ]/;
const EMPTY = { en: "", ne: "" };

/** Every { en, ne } pair anywhere in a record, with its path for error messages. */
function localizedPairs(value: unknown, path = "$"): Array<{ path: string; en: string; ne: string }> {
	if (isLocalized(value)) return [{ path, en: value.en, ne: value.ne }];
	if (Array.isArray(value)) return value.flatMap((item, index) => localizedPairs(item, `${path}[${index}]`));
	if (typeof value === "object" && value !== null) {
		return Object.entries(value).flatMap(([key, item]) => localizedPairs(item, `${path}.${key}`));
	}
	return [];
}

const ALL = { profile, projects, posts, experience, capabilities, processSteps, testimonials };

describe("portfolio demo data", () => {
	it("every record, as the seed stores it, passes the admin's input schema", () => {
		const { availability, updated: _updated, ...person } = profile;
		expect(
			profileInputSchema.safeParse({
				...person,
				availabilityStatus: availability.status,
				availabilityNote: availability.note,
				seoTitle: EMPTY,
				seoDescription: EMPTY,
				portraitId: null,
				resumeId: null,
				ogImageId: null,
			}).error?.issues ?? [],
		).toEqual([]);
		for (const { cover, body, ...project } of projects) {
			const result = projectInputSchema.safeParse({
				...project,
				blocks: toStoredBlocks(body),
				artSeed: "",
				motif: cover.motif,
				glyph: cover.glyph,
				appSlug: "", // @apps
				status: "published",
				coverId: null,
				gallery: [],
			});
			expect(result.error?.issues ?? [], project.slug).toEqual([]);
		}
		for (const { body, publishedAt: _date, ...post } of posts) {
			const result = postInputSchema.safeParse({
				...post,
				body: { en: proseToHtml(body, "en"), ne: proseToHtml(body, "ne") },
				status: "published",
				coverId: null,
			});
			expect(result.error?.issues ?? [], post.slug).toEqual([]);
		}
		for (const { id, end, ...entry } of experience) {
			expect(experienceInputSchema.safeParse({ ...entry, end: end ?? "" }).error?.issues ?? [], id).toEqual([]);
		}
		for (const { id, ...entry } of capabilities) {
			expect(skillInputSchema.safeParse(entry).error?.issues ?? [], id).toEqual([]);
		}
		for (const { id, ...step } of processSteps) {
			expect(processStepInputSchema.safeParse(step).error?.issues ?? [], id).toEqual([]);
		}
		for (const { id, ...entry } of testimonials) {
			expect(testimonialInputSchema.safeParse({ ...entry, published: true }).error?.issues ?? [], id).toEqual([]);
		}
	});

	it("slugs are unique within each collection", () => {
		const unique = (values: string[]) => new Set(values).size === values.length;
		expect(unique(projects.map((project) => project.slug))).toBe(true);
		expect(unique(posts.map((post) => post.slug))).toBe(true);
	});

	it("every text is written in both languages: Nepali in Devanagari, English without", () => {
		const pairs = localizedPairs(ALL);
		expect(pairs.length).toBeGreaterThan(300);
		expect(pairs.filter((pair) => !DEVANAGARI.test(pair.ne)).map((pair) => pair.path)).toEqual([]);
		expect(pairs.filter((pair) => DEVANAGARI.test(pair.en)).map((pair) => pair.path)).toEqual([]);
	});

	it("tells a complete story: four featured projects, each case study with chapters and screens", () => {
		expect(projects.filter((project) => project.featured)).toHaveLength(4);
		for (const project of projects) {
			expect(project.body.filter((block) => block.kind === "chapter").length, project.slug).toBeGreaterThanOrEqual(2);
			expect(
				project.body.some((block) => block.kind === "gallery"),
				project.slug,
			).toBe(true);
		}
		expect(experience.filter((entry) => entry.end === null)).toHaveLength(1);
	});
});

describe("the seed's conversions", () => {
	it("gives blocks ids and a type, and edges as { from, to }", () => {
		const blocks = toStoredBlocks([
			{ kind: "quote", text: { en: "Hi", ne: "नमस्ते" } },
			{
				kind: "architecture",
				caption: { en: "A", ne: "क" },
				nodes: [],
				edges: [["a", "b"]],
			},
		]);
		expect(blocks).toEqual([
			{ id: "block-1", type: "quote", text: { en: "Hi", ne: "नमस्ते" }, cite: "" },
			{
				id: "block-2",
				type: "architecture",
				caption: { en: "A", ne: "क" },
				nodes: [],
				edges: [{ from: "a", to: "b" }],
			},
		]);
	});

	it("writes prose as the editor's HTML, escaped, per language", () => {
		const html = proseToHtml(
			[
				{ kind: "heading", text: { en: "Why <this>", ne: "किन" } },
				{
					kind: "list",
					items: [
						{ en: "a & b", ne: "क" },
						{ en: "c", ne: "ख" },
					],
				},
				{ kind: "code", language: "sql", code: "select 1 < 2;" },
			],
			"en",
		);
		expect(html).toBe(
			"<h2>Why &lt;this&gt;</h2><ul><li><p>a &amp; b</p></li><li><p>c</p></li></ul><pre><code>select 1 &lt; 2;</code></pre>",
		);
	});
});
