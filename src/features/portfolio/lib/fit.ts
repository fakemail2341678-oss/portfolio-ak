/**
 * Fitting display type to a width without measuring it in the browser
 * (decision 0184): a line's width in em is estimated from its characters, and
 * CSS sizes it as `container width / estimate` (hm-name). The estimate runs
 * the same on the server and in every browser: it reads only a fixed table and
 * Unicode general categories that have been stable for decades, not the
 * runtime's ICU grapheme rules.
 *
 * Latin: Eczar 700's advance widths. Devanagari, whose conjuncts make per-letter
 * widths meaningless, counts units: a letter is 1, a space 0.3; a nonspacing
 * mark (most vowel signs) adds nothing, a spacing one (ा, ि, ी, ो, ौ) 0.35,
 * and a virama turns the consonant before it into a half form (−0.5).
 */
const VIRAMA = "्";
const NONSPACING = /\p{Mn}/u;
const SPACING = /\p{Mc}/u;
const DEVANAGARI = /[ऀ-ॿ]/;

/**
 * Eczar 700's advances in thousandths of an em, with hm-name's −0.03em
 * tracking, measured in Chrome. Kerning only narrows a name, so the sum is a
 * little wide (1–3% for names) and never overflows. The space is the margin
 * FittedName puts between words. Anything else counts as an average letter.
 */
// biome-ignore format: a measured table reads as rows of the alphabet, not one entry per line.
const ADVANCE: Readonly<Record<string, number>> = {
	" ": 240,
	A: 700, B: 663, C: 569, D: 702, E: 613, F: 602, G: 680, H: 799, I: 375, J: 376, K: 723, L: 589, M: 951,
	N: 758, O: 657, P: 625, Q: 694, R: 689, S: 570, T: 638, U: 725, V: 694, W: 981, X: 683, Y: 646, Z: 630,
	a: 533, b: 542, c: 433, d: 562, e: 470, f: 358, g: 550, h: 610, i: 316, j: 298, k: 595, l: 323, m: 916,
	n: 617, o: 497, p: 571, q: 547, r: 465, s: 429, t: 372, u: 604, v: 520, w: 756, x: 557, y: 534, z: 493,
	0: 572, 1: 424, 2: 569, 3: 561, 4: 584, 5: 543, 6: 552, 7: 480, 8: 540, 9: 540,
	".": 260, ",": 278, "-": 433, "'": 156, "’": 278, "@": 1053, _: 502, "&": 671, "+": 540,
};
const AVERAGE_ADVANCE = 600;

export function widthUnits(text: string): number {
	let units = 0;
	for (const character of text) {
		if (character === " ") units += 0.3;
		else if (character === VIRAMA) units -= 0.5;
		else if (NONSPACING.test(character)) continue;
		else if (SPACING.test(character)) units += 0.35;
		else units += 1;
	}
	return units;
}

/** Eczar 700's em per unit of Devanagari, measured over sample names (0.53–0.74) and rounded up. */
const DEVANAGARI_EM_PER_UNIT = 0.78;

/** The width of Latin text in Eczar 700, in thousandths of an em; accents (decomposed) add nothing. */
function latinAdvance(text: string): number {
	let total = 0;
	for (const character of text.normalize("NFD")) {
		if (NONSPACING.test(character)) continue;
		total += ADVANCE[character] ?? AVERAGE_ADVANCE;
	}
	return total;
}

/** The estimated width of `text` in Eczar 700, in em, rounded up to hundredths so it prints the same everywhere. */
export function fitEm(text: string): number {
	const thousandths = DEVANAGARI.test(text)
		? Math.max(1, widthUnits(text)) * DEVANAGARI_EM_PER_UNIT * 1000
		: Math.max(AVERAGE_ADVANCE, latinAdvance(text));
	return Math.ceil(Math.round(thousandths) / 10) / 100;
}

/** The widest word's estimate: on phones each word of the name takes its own line. */
export const fitEmOfWords = (text: string): number => Math.max(...text.split(/\s+/).filter(Boolean).map(fitEm), 1);
