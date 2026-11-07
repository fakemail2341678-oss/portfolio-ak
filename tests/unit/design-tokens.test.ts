import { describe, expect, it } from "vitest";
import { ACCENTS } from "@/lib/stores/preferences";
import { contrast, parseOklch, readRules, resolve, tokensWhere } from "../utils/css-tokens";

/**
 * Graphite's colour contrast (src/styles/app.css, decision 0164): every text pair is
 * WCAG AA (4.5:1) in every accent × theme. The browser review only ever sees the
 * default preset, so this is what keeps the other nine combinations readable.
 *
 * The custom properties are read per rule from app.css, applied in source order the
 * way <html class="dark" data-accent="…"> would match them, var() references are
 * resolved, and oklch() is converted to sRGB (clipped to the gamut).
 */

type Theme = "light" | "dark";

const rules = readRules("src/styles/app.css");

/** Does `selector` match <html> with this theme and accent? Descendant selectors never do. */
const matchesHtml = (selector: string, theme: Theme, accent: string) => {
	if (selector.includes(" ")) return false;
	const parts = selector.match(/:root|html|\.[\w-]+|\[[^\]]+\]/g) ?? [];
	if (parts.join("") !== selector.replace(/\s/g, "")) return false;
	return parts.every((part) => {
		if (part === ":root" || part === "html") return true;
		if (part === ".dark") return theme === "dark";
		const attribute = part.match(/^\[data-accent="(\w+)"\]$/);
		return attribute ? attribute[1] === accent : false;
	});
};

const tokensFor = (theme: Theme, accent: string) =>
	tokensWhere(rules, (selector) => matchesHtml(selector, theme, accent));

const SURFACES = ["--background", "--surface-1", "--surface-2", "--card", "--popover", "--sidebar"];

/** [text, background] pairs that must reach 4.5:1. */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
	...[...SURFACES, "--muted", "--secondary", "--accent", "--accent-subtle", "--sidebar-accent"].map(
		(surface) => ["--foreground", surface] as const,
	),
	...[...SURFACES, "--muted", "--accent"].map((surface) => ["--muted-foreground", surface] as const),
	["--card-foreground", "--card"],
	["--popover-foreground", "--popover"],
	["--secondary-foreground", "--secondary"],
	["--accent-foreground", "--accent"],
	["--primary-foreground", "--primary"],
	...[...SURFACES, "--accent-subtle"].map((surface) => ["--primary", surface] as const),
	["--sidebar-foreground", "--sidebar"],
	["--sidebar-accent-foreground", "--sidebar-accent"],
	["--sidebar-primary-foreground", "--sidebar-primary"],
	["--destructive-foreground", "--destructive"],
	...["danger", "success", "warning", "info"].flatMap((status) => [
		[`--${status}-foreground`, `--${status}`] as const,
		[`--${status}`, `--${status}-subtle`] as const,
		["--foreground", `--${status}-subtle`] as const,
		...SURFACES.map((surface) => [`--${status}`, surface] as const),
	]),
];

describe("Graphite tokens", () => {
	it("parses the theme and every accent preset", () => {
		for (const accent of ACCENTS) {
			for (const theme of ["light", "dark"] as const) {
				expect(parseOklch(resolve(tokensFor(theme, accent), "--primary")).alpha).toBe(1);
			}
		}
		// The presets really differ from each other, in both themes.
		for (const theme of ["light", "dark"] as const) {
			const primaries = new Set(ACCENTS.map((accent) => resolve(tokensFor(theme, accent), "--primary")));
			expect(primaries.size).toBe(ACCENTS.length);
		}
	});

	it("reaches 4.5:1 for every text pair in every accent × theme", () => {
		const failures: string[] = [];
		for (const accent of ACCENTS) {
			for (const theme of ["light", "dark"] as const) {
				const tokens = tokensFor(theme, accent);
				for (const [text, background] of PAIRS) {
					const ratio = contrast(parseOklch(resolve(tokens, text)), parseOklch(resolve(tokens, background)));
					if (ratio < 4.5) failures.push(`${accent}/${theme}: ${text} on ${background} is ${ratio.toFixed(2)}:1`);
				}
			}
		}
		expect(failures).toEqual([]);
	});

	it("knows its own maths: black on white is 21:1", () => {
		expect(contrast(parseOklch("oklch(0 0 0)"), parseOklch("oklch(1 0 0)"))).toBeCloseTo(21, 1);
	});
});
