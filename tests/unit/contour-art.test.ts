import { describe, expect, it } from "vitest";
import { contourLines } from "@/components/brand/contour-art";

/** The sign-in pages' contour art is server-rendered: it must be the same for a seed everywhere, and small. */
describe("contourLines", () => {
	it("is deterministic for a seed and differs between seeds", () => {
		expect(contourLines(8848)).toEqual(contourLines(8848));
		expect(contourLines(8848)).not.toEqual(contourLines(8167));
	});

	it("draws two summits and the rings around both, with index contours, in a small SVG", () => {
		const lines = contourLines(8848);
		expect(lines.length).toBeGreaterThan(10);
		expect(lines.some((line) => line.index)).toBe(true);
		expect(lines.every((line) => /^M-?\d+ -?\d+(C[-\d ]+)+Z$/.test(line.d))).toBe(true);
		// Path data stays under 20 kB, so the art doesn't weigh down the page's HTML.
		expect(lines.reduce((size, line) => size + line.d.length, 0)).toBeLessThan(20_000);
	});
});
