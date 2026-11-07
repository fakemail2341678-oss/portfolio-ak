import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pardaFontPreloads } from "@/features/parda/lib/fonts";
import { contrast, type Oklch, parseOklch, readRules, resolve, tokensWhere } from "../utils/css-tokens";

/**
 * Parda's design system (src/styles/parda.css, decision 0232): every text pair reads at
 * 4.5:1 or more in both themes, including text on a white picture under the scrim; the
 * browser review only sees the pictures the fixtures happen to have.
 */

type Theme = "light" | "dark";
const THEMES: ReadonlyArray<Theme> = ["light", "dark"];

const rules = readRules("src/styles/parda.css");
const LIGHT = 'html[data-section="parda"]';
const DARK = 'html[data-section="parda"].dark';

const tokensFor = (theme: Theme) =>
	tokensWhere(rules, (selector) => selector === LIGHT || (theme === "dark" && selector === DARK));

const colour = (tokens: Record<string, string>, name: string) => parseOklch(resolve(tokens, name));

/** A black overlay on a white picture, as the browser blends it in sRGB, as an opaque grey. */
const overWhite = (overlay: Oklch): Oklch => {
	expect(overlay.l).toBe(0);
	const value = 1 - overlay.alpha;
	const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	return { l: Math.cbrt(linear), c: 0, h: 0, alpha: 1 };
};

const PAIRS: ReadonlyArray<readonly [string, string]> = [
	["--pd-ink", "--pd-ground"],
	["--pd-ink", "--pd-ground-2"],
	["--pd-ink", "--pd-mask"],
	["--pd-muted", "--pd-ground"],
	["--pd-muted", "--pd-ground-2"],
	["--pd-muted", "--pd-mask"],
	["--pd-on-action", "--pd-action"],
	["--destructive", "--pd-ground"],
	// The shared kit, through Graphite's names.
	["--foreground", "--background"],
	["--muted-foreground", "--muted"],
	["--primary-foreground", "--primary"],
];

describe("Parda tokens", () => {
	it("reaches 4.5:1 for every text pair, in both themes", () => {
		const failures: string[] = [];
		for (const theme of THEMES) {
			const tokens = tokensFor(theme);
			for (const [text, background] of PAIRS) {
				const value = contrast(colour(tokens, text), colour(tokens, background));
				if (value < 4.5) failures.push(`${theme}: ${text} on ${background} is ${value.toFixed(2)}:1`);
			}
		}
		expect(failures).toEqual([]);
	});

	it("reaches 4.5:1 for text on a white picture under the scrim, in both themes", () => {
		for (const theme of THEMES) {
			const tokens = tokensFor(theme);
			const scrim = overWhite(colour(tokens, "--pd-scrim"));
			expect(contrast(colour(tokens, "--pd-subtitle"), scrim)).toBeGreaterThanOrEqual(4.5);
			expect(contrast(colour(tokens, "--pd-on-picture"), scrim)).toBeGreaterThanOrEqual(4.5);
		}
	});

	it("reaches 3:1 for the progress bar on its track, on a white picture", () => {
		for (const theme of THEMES) {
			const tokens = tokensFor(theme);
			const value = contrast(colour(tokens, "--pd-progress"), overWhite(colour(tokens, "--pd-track")));
			expect(value).toBeGreaterThanOrEqual(3);
		}
	});

	it("moves only transform and opacity, with one ease, and only under no-preference", () => {
		const css = readFileSync("src/styles/parda.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
		const motionAt = css.indexOf("@media (prefers-reduced-motion: no-preference)");
		expect(motionAt).toBeGreaterThan(0);
		expect(css.slice(0, motionAt)).not.toMatch(/\b(transition|animation)\s*:/);
		const motion = css.slice(motionAt);
		const transitions = [...motion.matchAll(/transition:\s*([^;]+);/g)].flatMap((match) =>
			(match[1] ?? "").split(",").map((part) => part.trim()),
		);
		expect(transitions.length).toBeGreaterThan(0);
		for (const part of transitions)
			expect(part).toMatch(/^(transform|opacity) var\(--pd-duration[\w-]*\) var\(--pd-ease\)$/);
		expect(motion).not.toMatch(/\banimation\s*:/);
	});
});

describe("Parda's font preloads", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("preloads at most two files per locale, in production only", () => {
		expect(pardaFontPreloads("en")).toEqual([]);
		vi.stubEnv("DEV", false);
		expect(pardaFontPreloads("en")).toHaveLength(2);
		const nepali = pardaFontPreloads("ne");
		expect(nepali).toHaveLength(2);
		expect(nepali.map((link) => link.href).join()).toContain("devanagari");
		expect(nepali.every((link) => link.crossOrigin === "anonymous")).toBe(true);
	});
});
