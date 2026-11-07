import { describe, expect, it } from "vitest";
import { titleRouteParams } from "@/features/parda/search";
import { parseTitleParam, titleParam, titleSlug } from "@/features/parda/slug";

/** A title's address (decision 0235): the id finds it, the slug is for people and search engines. */
describe("title slugs", () => {
	it("are lower-case Latin words joined by dashes", () => {
		expect(titleSlug("Spider-Man: Across the Spider-Verse")).toBe("spider-man-across-the-spider-verse");
		expect(titleSlug("Amélie")).toBe("amelie");
		expect(titleSlug("Tom & Jerry")).toBe("tom-and-jerry");
		expect(titleSlug("Ocean's Eleven")).toBe("oceans-eleven");
		expect(titleSlug("  --Hello!!  ")).toBe("hello");
		expect(titleSlug("पर्दा")).toBe("");
	});

	it("stop at a word before 60 characters", () => {
		const slug = titleSlug("A very long title ".repeat(10));
		expect(slug.length).toBeLessThanOrEqual(60);
		expect(slug).not.toMatch(/-$/);
	});

	it("make and read the $id segment", () => {
		expect(titleParam(550, "fight-club")).toBe("550-fight-club");
		expect(titleParam(550, "")).toBe("550");
		expect(parseTitleParam("550-fight-club")).toEqual({ id: 550, slug: "fight-club" });
		expect(parseTitleParam("550")).toEqual({ id: 550, slug: "" });
		for (const bad of ["abc", "0", "-550", "550_x", "550-Fight", "99999999999"])
			expect(parseTitleParam(bad), bad).toBeNull();
	});

	it("read a title route's params, or nothing for a 404", () => {
		expect(titleRouteParams({ type: "series", id: "1396-breaking-bad" })).toEqual({
			type: "series",
			id: 1396,
			slug: "breaking-bad",
		});
		expect(titleRouteParams({ type: "film", id: "550" })).toBeNull();
		expect(titleRouteParams({ type: "movie", id: "abc" })).toBeNull();
	});
});
