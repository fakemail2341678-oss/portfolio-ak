import { readFileSync } from "node:fs";

/**
 * Reading colour tokens out of a stylesheet for the contrast tests
 * (design-tokens.test.ts for Graphite, himal-tokens.test.ts for the portfolio):
 * flat rules (`selector { --name: value; }`) in source order, var() references
 * resolved, and oklch() converted to sRGB (clipped to the gamut) for WCAG
 * contrast ratios.
 */

export type Oklch = { l: number; c: number; h: number; alpha: number };
export type Rule = { selectors: string[]; declarations: Record<string, string> };

/** The flat rules of a stylesheet, in order. At-rules (@theme, @utility…) and nested blocks are skipped. */
export function readRules(path: string): Rule[] {
	const css = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
	return [...css.matchAll(/(^|\n)([^@{}\n][^{}]*)\{([^{}]*)\}/g)].map((match) => ({
		selectors: (match[2] ?? "").split(",").map((selector) => selector.trim()),
		declarations: Object.fromEntries(
			[...(match[3] ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((d) => [d[1], (d[2] ?? "").trim()]),
		),
	}));
}

/** The custom properties every rule matching `matches` declares, later rules winning. */
export function tokensWhere(rules: ReadonlyArray<Rule>, matches: (selector: string) => boolean) {
	const tokens: Record<string, string> = {};
	for (const rule of rules) {
		if (rule.selectors.some(matches)) Object.assign(tokens, rule.declarations);
	}
	return tokens;
}

/** A token's value with var() references followed. */
export function resolve(tokens: Record<string, string>, name: string, depth = 0): string {
	const value = tokens[name];
	if (value === undefined) throw new Error(`${name} is not defined`);
	const reference = value.match(/^var\((--[\w-]+)\)$/);
	if (!reference?.[1]) return value;
	if (depth > 10) throw new Error(`${name}: var() cycle`);
	return resolve(tokens, reference[1], depth + 1);
}

export function parseOklch(value: string): Oklch {
	const match = value.match(/^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)(%?))?\)$/);
	if (!match) throw new Error(`Not an oklch() colour: ${value}`);
	const alpha = match[4] === undefined ? 1 : Number(match[4]) / (match[5] ? 100 : 1);
	return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]), alpha };
}

/** OKLCH -> linear sRGB (Björn Ottosson's OKLab matrices), clipped to [0, 1]. */
const linearRgb = ({ l: L, c, h }: Oklch) => {
	const a = c * Math.cos((h * Math.PI) / 180);
	const b = c * Math.sin((h * Math.PI) / 180);
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const clip = (v: number) => Math.min(1, Math.max(0, v));
	return [
		clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
	] as const;
};

const luminance = (colour: Oklch) => {
	const [r, g, b] = linearRgb(colour);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio of two colours. */
export function contrast(a: Oklch, b: Oklch): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (light + 0.05) / (dark + 0.05);
}
