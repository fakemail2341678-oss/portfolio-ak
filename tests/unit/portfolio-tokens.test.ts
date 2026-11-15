import { describe, expect, it } from "vitest";
import { contrast, parseOklch, readRules, resolve, tokensWhere } from "../utils/css-tokens";

/**
 * Himal's colour contrast (src/styles/himal.css, decision 0179): on every field
 * of colour, in both themes, the ink, the muted ink and the accent read at
 * 4.5:1 or more on the field's ground and its surface step, and the button's
 * text on the button. The browser review sees the fields the demo content
 * happens to use; this covers every one.
 */

type Theme = "light" | "dark";
const FIELDS = ["snow", "snow-2", "ridge", "pine", "night", "rhodo"] as const;
type Field = (typeof FIELDS)[number];

const rules = readRules("src/styles/himal.css");

/** The tokens in force inside `.himal` (and `.hm-field-…`) in a theme, as the cascade applies them. */
const tokensFor = (theme: Theme, field: Field) => {
	const applies = new Set([".himal"]);
	if (theme === "dark") applies.add(".dark .himal");
	if (field !== "snow") {
		applies.add(`.himal .hm-field-${field}`);
		if (theme === "dark") applies.add(`.dark .himal .hm-field-${field}`);
	}
	return tokensWhere(rules, (selector) => applies.has(selector));
};

const ratio = (tokens: Record<string, string>, text: string, background: string) =>
	contrast(parseOklch(resolve(tokens, text)), parseOklch(resolve(tokens, background)));

const PAIRS: ReadonlyArray<readonly [string, string]> = [
	["--hm-ink", "--hm-ground"],
	["--hm-ink", "--hm-ground-2"],
	["--hm-muted", "--hm-ground"],
	["--hm-muted", "--hm-ground-2"],
	["--hm-accent", "--hm-ground"],
	["--hm-accent", "--hm-ground-2"],
	["--hm-on-action", "--hm-action"],
];

/** Text set on the art: the strata of the architecture diagram, and labels on the daytime sky. */
const ART_PAIRS: ReadonlyArray<readonly [string, string]> = [
	...[5, 6, 7, 8].map((level) => ["--hm-on-high", `--hm-alt-${level}`] as const),
	...[0, 1, 2].map((level) => ["--hm-on-deep", `--hm-alt-${level}`] as const),
	["--hm-on-sky", "--hm-sky-day-2"],
	["--hm-on-sky", "--hm-sky-day-3"],
];

describe("Himal tokens", () => {
	it("reaches 4.5:1 for every text pair on every field, in both themes", () => {
		const failures: string[] = [];
		for (const theme of ["light", "dark"] as const) {
			for (const field of FIELDS) {
				const tokens = tokensFor(theme, field);
				for (const [text, background] of PAIRS) {
					const value = ratio(tokens, text, background);
					if (value < 4.5) failures.push(`${theme}/${field}: ${text} on ${background} is ${value.toFixed(2)}:1`);
				}
			}
		}
		expect(failures).toEqual([]);
	});

	it("reaches 4.5:1 for text set on the art, in both themes", () => {
		const failures: string[] = [];
		for (const theme of ["light", "dark"] as const) {
			const tokens = tokensFor(theme, "snow");
			for (const [text, background] of ART_PAIRS) {
				const value = ratio(tokens, text, background);
				if (value < 4.5) failures.push(`${theme}: ${text} on ${background} is ${value.toFixed(2)}:1`);
			}
		}
		expect(failures).toEqual([]);
	});

	it("gives each field its own ground, so neighbouring sections never share one", () => {
		for (const theme of ["light", "dark"] as const) {
			const grounds = new Set(FIELDS.map((field) => resolve(tokensFor(theme, field), "--hm-ground")));
			expect(grounds.size).toBe(FIELDS.length);
		}
	});
});
