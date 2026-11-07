import { readdirSync, readFileSync, statSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chaalFontPreloads } from "@/features/chaal/lib/fonts";
import { CHAAL_BOARD_THEMES } from "@/features/chaal/look/board-themes";
import { contrast, parseOklch, readRules, resolve, tokensWhere } from "../utils/css-tokens";

/**
 * Chaal's design system, "Diagram" (src/styles/chaal.css, decision 0258): every text pair
 * reads at 4.5:1 in both themes, and every mark on a square (the last move's ring, check,
 * legal-move dots, arrows, the hatching itself) at 3:1 against both squares of every
 * board theme, in both themes.
 */

type Theme = "light" | "dark";
const THEMES: ReadonlyArray<Theme> = ["light", "dark"];

const CSS = "src/styles/chaal.css";
const rules = readRules(CSS);
const LIGHT = 'html[data-section="chaal"]';
const DARK = 'html[data-section="chaal"].dark';
const board = (name: string) => `${LIGHT} [data-ch-board="${name}"]`;

const tokensFor = (theme: Theme, boardTheme = "diagram") =>
	tokensWhere(
		rules,
		(selector) => selector === LIGHT || (theme === "dark" && selector === DARK) || selector === board(boardTheme),
	);

const colour = (tokens: Record<string, string>, name: string) => parseOklch(resolve(tokens, name));
const ratio = (tokens: Record<string, string>, a: string, b: string) => contrast(colour(tokens, a), colour(tokens, b));

const TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = [
	["--ch-ink", "--ch-ground"],
	["--ch-ink", "--ch-plate"],
	["--ch-muted", "--ch-ground"],
	["--ch-muted", "--ch-plate"],
	// Annotation symbols and the current move's underline are read as text.
	["--ch-mark", "--ch-ground"],
	["--ch-mark", "--ch-plate"],
	["--ch-on-ink", "--ch-ink"],
	["--ch-danger", "--ch-ground"],
	["--ch-danger", "--ch-plate"],
	// The shared kit, through Graphite's names.
	["--foreground", "--background"],
	["--muted-foreground", "--muted"],
	["--primary-foreground", "--primary"],
	["--card-foreground", "--card"],
	["--popover-foreground", "--popover"],
];

describe("Chaal tokens", () => {
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

	it("has a token set for every board theme but the default", () => {
		for (const name of CHAAL_BOARD_THEMES.filter((theme) => theme !== "diagram"))
			expect(rules.some((rule) => rule.selectors.includes(board(name)))).toBe(true);
		const declared = rules.flatMap((rule) =>
			rule.selectors.flatMap((selector) => selector.match(/data-ch-board="([\w-]+)"/)?.[1] ?? []),
		);
		expect(new Set(declared)).toEqual(new Set(CHAAL_BOARD_THEMES.filter((theme) => theme !== "diagram")));
	});

	it("reaches 3:1 for every mark on a square, against both squares, on every board theme", () => {
		const failures: string[] = [];
		for (const theme of THEMES) {
			for (const boardTheme of CHAAL_BOARD_THEMES) {
				const tokens = tokensFor(theme, boardTheme);
				const hatched = resolve(tokens, "--ch-sq-pattern") !== "none";
				const checks: Array<readonly [string, string]> = [
					["--ch-sq-mark", "--ch-sq-light"],
					["--ch-sq-mark", "--ch-sq-dark"],
					["--ch-sq-dot", "--ch-sq-light"],
					["--ch-sq-dot", "--ch-sq-dark"],
				];
				// On a hatched square the ring also crosses the ink lines, and the lines must read on the paper.
				if (hatched) checks.push(["--ch-sq-mark", "--ch-sq-hatch"], ["--ch-sq-hatch", "--ch-sq-dark"]);
				// The frame holds the board in both themes.
				checks.push(["--ch-frame", "--ch-sq-light"]);
				for (const [mark, square] of checks) {
					const value = ratio(tokens, mark, square);
					if (value < 3) failures.push(`${theme}/${boardTheme}: ${mark} on ${square} is ${value.toFixed(2)}:1`);
				}
			}
		}
		expect(failures).toEqual([]);
	});

	it("moves only transform and opacity, with one ease, and only under no-preference", () => {
		const css = readFileSync(CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
		const motionAt = css.indexOf("@media (prefers-reduced-motion: no-preference)");
		expect(motionAt).toBeGreaterThan(0);
		expect(css.slice(0, motionAt)).not.toMatch(/\b(transition|animation)\s*:/);
		const motion = css.slice(motionAt);
		const transitions = [...motion.matchAll(/transition:\s*([^;]+);/g)].flatMap((match) =>
			(match[1] ?? "").split(",").map((part) => part.trim()),
		);
		expect(transitions.length).toBeGreaterThan(0);
		for (const part of transitions)
			expect(part).toMatch(/^(transform|opacity) var\(--ch-duration[\w-]*\) var\(--ch-ease\)$/);
		expect(motion).not.toMatch(/\banimation\s*:/);
	});
});

describe("Chaal's font preloads", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("preloads at most two files per locale, in production only", () => {
		expect(chaalFontPreloads("en")).toEqual([]);
		vi.stubEnv("DEV", false);
		expect(chaalFontPreloads("en")).toHaveLength(2);
		const nepali = chaalFontPreloads("ne");
		expect(nepali).toHaveLength(2);
		expect(nepali.map((link) => link.href).join()).toContain("devanagari");
		expect(nepali.every((link) => link.crossOrigin === "anonymous")).toBe(true);
	});
});

describe("Chaal's pieces and sounds", () => {
	it("ships all twelve cburnett pieces as SVG, with their licence", () => {
		const dir = "public/chaal/pieces/cburnett";
		for (const colour of ["w", "b"])
			for (const piece of ["K", "Q", "R", "B", "N", "P"])
				expect(readFileSync(`${dir}/${colour}${piece}.svg`, "utf8")).toMatch(/<svg[\s\S]*<\/svg>\s*$/);
		expect(readFileSync(`${dir}/LICENSE.txt`, "utf8")).toContain("3-clause BSD");
	});

	it("ships our own sounds as small WAV files", () => {
		const dir = "public/chaal/sounds";
		const files = readdirSync(dir);
		expect(files.sort()).toEqual(
			["capture", "check", "correct", "end", "low-time", "move", "notify", "start", "wrong"].map((n) => `${n}.wav`),
		);
		for (const file of files) {
			expect(readFileSync(`${dir}/${file}`).subarray(0, 4).toString()).toBe("RIFF");
			expect(statSync(`${dir}/${file}`).size).toBeLessThan(22 * 1024);
		}
	});
});
