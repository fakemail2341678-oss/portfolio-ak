import { afterEach, describe, expect, it } from "vitest";
import { absoluteUrl, pageTitle, seo } from "@/lib/seo";
import { overwriteGetLocale } from "@/paraglide/runtime";

afterEach(() => {
	overwriteGetLocale(() => "en");
});

const linkHref = (tags: ReturnType<typeof seo>, rel: string, hrefLang?: string) =>
	tags.links.find(
		(link) => link.rel === rel && (hrefLang === undefined || ("hrefLang" in link && link.hrefLang === hrefLang)),
	)?.href;
const metaContent = (tags: ReturnType<typeof seo>, key: string) =>
	tags.meta.find((meta) => meta.property === key || meta.name === key)?.content;
const jsonLd = (tags: ReturnType<typeof seo>) =>
	tags.meta.flatMap((meta) => ("script:ld+json" in meta ? [(meta as Record<string, unknown>)["script:ld+json"]] : []));

describe("seo()", () => {
	it("builds absolute canonical, hreflang and Open Graph tags for English", () => {
		const tags = seo({
			title: "Items",
			description: "All items",
			path: "/test-crud?page=2",
			image: { url: "https://res.cloudinary.com/demo/x.jpg", width: 1200, height: 630, alt: "A plate" },
		});
		expect(tags.meta[0]).toEqual({ title: pageTitle("Items") });
		expect(linkHref(tags, "canonical")).toBe("http://localhost:3000/test-crud?page=2");
		expect(linkHref(tags, "alternate", "en")).toBe("http://localhost:3000/test-crud?page=2");
		expect(linkHref(tags, "alternate", "ne")).toBe("http://localhost:3000/ne/test-crud?page=2");
		expect(linkHref(tags, "alternate", "x-default")).toBe("http://localhost:3000/test-crud?page=2");
		expect(metaContent(tags, "og:url")).toBe("http://localhost:3000/test-crud?page=2");
		expect(metaContent(tags, "og:locale")).toBe("en_US");
		expect(metaContent(tags, "og:locale:alternate")).toBe("ne_NP");
		expect(metaContent(tags, "og:image")).toBe("https://res.cloudinary.com/demo/x.jpg");
		expect(metaContent(tags, "og:image:alt")).toBe("A plate");
		expect(metaContent(tags, "twitter:image")).toBe("https://res.cloudinary.com/demo/x.jpg");
		expect(metaContent(tags, "twitter:card")).toBe("summary_large_image");
		expect(metaContent(tags, "robots")).toBe("index, follow, max-image-preview:large");
		expect(jsonLd(tags)).toEqual([]);
	});

	it("uses the Nepali URL as canonical on Nepali pages, keeping English as x-default", () => {
		overwriteGetLocale(() => "ne");
		const tags = seo({ title: "वस्तुहरू", description: "…", path: "/test-crud/momo", type: "article", noindex: true });
		expect(linkHref(tags, "canonical")).toBe("http://localhost:3000/ne/test-crud/momo");
		expect(linkHref(tags, "alternate", "x-default")).toBe("http://localhost:3000/test-crud/momo");
		expect(metaContent(tags, "og:locale")).toBe("ne_NP");
		expect(metaContent(tags, "og:type")).toBe("article");
		// No image of its own: the site default (public/og-default.png).
		expect(metaContent(tags, "og:image")).toBe("http://localhost:3000/og-default.png");
		expect(metaContent(tags, "og:image:width")).toBe("1200");
		expect(metaContent(tags, "robots")).toBe("noindex, follow");
	});

	it("the home page title is the site name alone", () => {
		const tags = seo({ description: "Home", path: "/" });
		expect(tags.meta[0]).toEqual({ title: pageTitle() });
		expect(metaContent(tags, "og:title")).toBe(pageTitle());
		expect(linkHref(tags, "alternate", "ne")).toBe("http://localhost:3000/ne/");
	});

	it("emits JSON-LD entries with the schema.org context", () => {
		const tags = seo({
			title: "A",
			description: "B",
			path: "/a",
			jsonLd: [
				{ "@type": "Thing", name: "x" },
				{ "@type": "Thing", name: "y" },
			],
		});
		expect(jsonLd(tags)).toEqual([
			{ "@context": "https://schema.org", "@type": "Thing", name: "x" },
			{ "@context": "https://schema.org", "@type": "Thing", name: "y" },
		]);
	});

	it("absoluteUrl resolves site paths against VITE_SITE_URL", () => {
		expect(absoluteUrl("/a?b=1")).toBe("http://localhost:3000/a?b=1");
	});
});
