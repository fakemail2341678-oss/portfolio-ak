import { afterEach, describe, expect, it } from "vitest";
import { testCrudFormSchema, testCrudInputSchema, toTestCrudInput } from "@/features/test-crud/schema";
import { testCrudList } from "@/features/test-crud/search";
import { slugify } from "@/lib/slug";
import { overwriteGetLocale } from "@/paraglide/runtime";

afterEach(() => {
	overwriteGetLocale(() => "en");
});

const valid = {
	title: "Momo Kitchen",
	slug: "momo-kitchen",
	summary: "",
	body: "<p>Hi</p>",
	status: "draft",
	price: 100,
	phone: "",
	tags: [],
	images: [],
} as const;

const messages = (result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) =>
	Object.fromEntries((result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]));

describe("slugify", () => {
	it("makes lowercase ASCII slugs from Latin titles", () => {
		expect(slugify("Hello, World!")).toBe("hello-world");
		expect(slugify("  Café  Déjà vu -- 2026 ")).toBe("cafe-deja-vu-2026");
		expect(slugify("a".repeat(100))).toHaveLength(80);
	});

	it("returns an empty slug for non-Latin titles (the admin types one)", () => {
		expect(slugify("नेपाली मोमो")).toBe("");
	});
});

describe("testCrudInputSchema (shared by the form and the server)", () => {
	it("accepts a complete valid item", () => {
		expect(testCrudInputSchema.safeParse(valid).success).toBe(true);
	});

	it("reports localized field errors", () => {
		const result = testCrudInputSchema.safeParse({
			...valid,
			title: "",
			slug: "Bad Slug!",
			price: 1.234,
			phone: "+977123",
			status: "archived",
		});
		expect(messages(result)).toMatchObject({
			title: "This field is required.",
			slug: "Use lowercase letters, numbers and single hyphens, like my-first-item.",
			phone: "Enter a valid phone number.",
		});
		expect(Object.keys(messages(result))).toEqual(expect.arrayContaining(["price", "status"]));
	});

	it("reports in Nepali when the locale is ne", () => {
		overwriteGetLocale(() => "ne");
		expect(messages(testCrudInputSchema.safeParse({ ...valid, slug: "x".repeat(81) })).slug).toBe(
			"बढीमा ८० अक्षर प्रयोग गर्नुहोस्।",
		);
	});

	it("images are attachment ids with alt text, at most 8, and the form's previews never reach the server", () => {
		const id = "6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0001";
		const preview = {
			id,
			alt: { en: "", ne: "" },
			format: "png",
			url: "x",
			width: 1,
			height: 1,
			full: { src: "x", srcSet: "x" },
			cover: { src: "x", srcSet: "x" },
			thumb: "x",
			og: "x",
		};
		const form = {
			...valid,
			status: "draft" as const,
			tags: [],
			images: [{ id, alt: { en: " Momo ", ne: "" }, preview }],
		};
		expect(testCrudFormSchema.safeParse(form).success).toBe(true);
		expect(toTestCrudInput(form).images).toEqual([{ id, alt: { en: "Momo", ne: "" } }]);
		expect(testCrudInputSchema.safeParse({ ...valid, images: [{ id: "nope", alt: { en: "", ne: "" } }] }).success).toBe(
			false,
		);
		const nine = Array.from({ length: 9 }, () => ({ id, alt: { en: "", ne: "" } }));
		expect(testCrudInputSchema.safeParse({ ...valid, images: nine }).success).toBe(false);
		expect(
			testCrudInputSchema.safeParse({ ...valid, images: [{ id, alt: { en: "x".repeat(201), ne: "" } }] }).success,
		).toBe(false);
	});
});

describe("admin list search params", () => {
	const { search, input, defaults } = testCrudList;

	it("fills defaults and corrects invalid values instead of failing", () => {
		expect(defaults).toMatchObject({ q: "", status: "all", tags: [], sort: "-updated", page: 1 });
		expect(search.parse({ status: "archived", sort: "drop table", page: "-3", pageSize: "7", q: "  hi " })).toEqual({
			...defaults,
			q: "hi",
		});
		// Links carry params the page doesn't know (utm tags): they are dropped, never an error.
		expect(search.parse({ utm_source: "mail" })).toEqual(defaults);
		expect(search.parse({ status: "published", sort: "-price", page: "4", pageSize: "50" })).toMatchObject({
			status: "published",
			sort: "-price",
			page: 4,
			pageSize: 50,
		});
	});

	it("the server function input requires an allowed page size and nothing else", () => {
		expect(input.safeParse({ ...defaults, pageSize: 20 }).success).toBe(true);
		expect(input.safeParse({ ...defaults, pageSize: 1000 }).success).toBe(false);
		expect(input.safeParse({ ...defaults, pageSize: 20, edit: "x" }).success).toBe(false);
	});
});
