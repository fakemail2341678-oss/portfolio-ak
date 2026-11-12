import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { kharchaFontPreloads } from "@/features/kharcha/lib/fonts";
import { KHARCHA_COLORS } from "@/features/kharcha/types";
import { contrast, parseOklch, readRules, resolve, tokensWhere } from "../utils/css-tokens";

/**
 * Kharcha's design system, "Bahi Khata" (src/styles/kharcha.css, decision 0281): every
 * text pair reads at 4.5:1 in both themes, money's two directions included, and every
 * person's colour carries white initials at 4.5:1.
 */

type Theme = "light" | "dark";
const THEMES: ReadonlyArray<Theme> = ["light", "dark"];

const CSS = "src/styles/kharcha.css";
const rules = readRules(CSS);
const LIGHT = 'html[data-section="kharcha"]';
const DARK = 'html[data-section="kharcha"].dark';

const tokensFor = (theme: Theme) =>
	tokensWhere(rules, (selector) => selector === LIGHT || (theme === "dark" && selector === DARK));

const colour = (tokens: Record<string, string>, name: string) => parseOklch(resolve(tokens, name));
const ratio = (tokens: Record<string, string>, a: string, b: string) => contrast(colour(tokens, a), colour(tokens, b));

const TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = [
	["--kh-ink", "--kh-ground"],
	["--kh-ink", "--kh-page"],
	["--kh-ink", "--kh-sel"],
	["--kh-muted", "--kh-ground"],
	["--kh-muted", "--kh-page"],
	["--kh-muted", "--kh-sel"],
	// Money's directions, on a page, on a selected line, and on their own tint (badges, hatching).
	["--kh-owed", "--kh-page"],
	["--kh-owed", "--kh-ground"],
	["--kh-owed", "--kh-sel"],
	["--kh-owed", "--kh-owed-bg"],
	["--kh-owe", "--kh-page"],
	["--kh-owe", "--kh-ground"],
	["--kh-owe", "--kh-sel"],
	["--kh-owe", "--kh-owe-bg"],
	// The rail and the top bar: the current item's text, the others', on the cloth and its deeper tone.
	["--kh-on-cloth", "--kh-cloth"],
	["--kh-on-cloth", "--kh-cloth-deep"],
	["--kh-cloth-muted", "--kh-cloth"],
	// The one primary action, and red ink read as text (a selected line's date).
	["--kh-on-act", "--kh-act"],
	["--kh-mark", "--kh-sel"],
	["--kh-mark", "--kh-page"],
	// The shared kit, through Graphite's names.
	["--foreground", "--background"],
	["--muted-foreground", "--muted"],
	["--muted-foreground", "--card"],
	["--primary-foreground", "--primary"],
	["--card-foreground", "--card"],
	["--popover-foreground", "--popover"],
	["--secondary-foreground", "--secondary"],
];

// Non-text marks at 3:1: the binding thread against the cloth, the margin rule on a page.
const MARK_PAIRS: ReadonlyArray<readonly [string, string]> = [
	["--kh-thread", "--kh-cloth"],
	["--kh-margin", "--kh-page"],
];

describe("Kharcha tokens", () => {
	it("reaches 4.5:1 for every text pair, in both themes", () => {
		const failures: string[] = [];
		for (const theme of THEMES) {
			const tokens = tokensFor(theme);
			for (const [text, background] of TEXT_PAIRS) {
				const value = ratio(tokens, text, background);
				if (value < 4.5) failures.push(`${theme}: ${text} on ${background} is ${value.toFixed(2)}:1`);
			}
		}
		expect(failures).toEqual([]);
	});

	it("reaches 3:1 for the thread and the margin rule, in both themes", () => {
		const failures: string[] = [];
		for (const theme of THEMES) {
			const tokens = tokensFor(theme);
			for (const [mark, background] of MARK_PAIRS) {
				const value = ratio(tokens, mark, background);
				if (value < 3) failures.push(`${theme}: ${mark} on ${background} is ${value.toFixed(2)}:1`);
			}
		}
		expect(failures).toEqual([]);
	});

	it("gives every person's colour a token that carries white initials at 4.5:1", () => {
		const tokens = tokensFor("light");
		const white = parseOklch("oklch(1 0 0)");
		const failures: string[] = [];
		for (const name of KHARCHA_COLORS) {
			const value = contrast(white, colour(tokens, `--kh-c-${name}`));
			if (value < 4.5) failures.push(`--kh-c-${name} is ${value.toFixed(2)}:1`);
		}
		expect(failures).toEqual([]);
		const declared = Object.keys(tokens).filter((name) => name.startsWith("--kh-c-"));
		expect(new Set(declared)).toEqual(new Set(KHARCHA_COLORS.map((name) => `--kh-c-${name}`)));
	});

	it("never uses the brand's red for money", () => {
		for (const theme of THEMES) {
			const tokens = tokensFor(theme);
			for (const direction of ["--kh-owed", "--kh-owe"])
				expect(resolve(tokens, direction)).not.toBe(resolve(tokens, "--kh-cloth"));
		}
	});

	it("moves only transform, opacity and colour, with one ease, and only under no-preference", () => {
		const css = readFileSync(CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
		const motionAt = css.indexOf("@media (prefers-reduced-motion: no-preference)");
		expect(motionAt).toBeGreaterThan(0);
		expect(css.slice(0, motionAt)).not.toMatch(/\b(transition[\w-]*|animation)\s*:/);
		const motion = css.slice(motionAt);
		const properties = [...motion.matchAll(/transition-property:\s*([^;]+);/g)].flatMap((match) =>
			(match[1] ?? "").split(",").map((part) => part.trim()),
		);
		expect(properties.length).toBeGreaterThan(0);
		for (const property of properties)
			expect(property).toMatch(/^(transform|opacity|background-color|color|text-decoration-color)$/);
		expect(motion).toMatch(/transition-timing-function:\s*var\(--kh-ease\)/);
		expect(motion).not.toMatch(/\banimation\s*:/);
	});
});

describe("Kharcha's font preloads", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("preloads at most two files per locale, in production only", () => {
		expect(kharchaFontPreloads("en")).toEqual([]);
		vi.stubEnv("DEV", false);
		expect(kharchaFontPreloads("en")).toHaveLength(2);
		const nepali = kharchaFontPreloads("ne");
		expect(nepali).toHaveLength(2);
		expect(nepali.map((link) => link.href).join()).toContain("devanagari");
		expect(nepali.every((link) => link.crossOrigin === "anonymous")).toBe(true);
	});
});
