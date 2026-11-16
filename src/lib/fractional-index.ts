import { generateNKeysBetween, generateKeyBetween as keyBetween } from "fractional-indexing";

/**
 * Fractional indexing (decision 0188): an order key is a string, and between any two
 * keys there is always another, so moving an item writes one row (its new key) instead
 * of renumbering a list. Keys compare by code unit: JavaScript's `<` and Postgres'
 * `COLLATE "C"`, never a locale collation.
 *
 * The algorithm is David Greenspan's, from rocicorp's `fractional-indexing` package
 * (decision 0299; a copy of it lived in this file before): an integer part whose first
 * character encodes its length ("a0", "a1" … "az", "b10" …), then an optional fraction that
 * never ends in the zero digit. This module adds the app's own rules: what a server accepts
 * as a key, and what a move does when two tabs crossed their neighbours.
 *
 *   generateKeyBetween(null, null)   // "a0": the first item
 *   generateKeyBetween("a0", null)   // "a1": after the last
 *   generateKeyBetween("a0", "a1")   // "a0V": between two
 */

/** Longest key accepted from a client (a key grows by about one character per halving). */
export const MAX_ORDER_KEY_LENGTH = 64;

/** A head letter, then base-62 digits. */
const ORDER_KEY_CHARACTERS = /^[A-Za-z][0-9A-Za-z]*$/;

/** Whether `value` is a well-formed order key (what a server checks before storing one). */
export const isOrderKey = (value: string): boolean => {
	if (value.length > MAX_ORDER_KEY_LENGTH) return false;
	try {
		// A key the package can continue from is well formed: the integer part's length, no
		// trailing zero in the fraction, and not the smallest integer (which has no key before it).
		generateKeyBetween(value, null);
		return true;
	} catch {
		return false;
	}
};

/**
 * What the package leaves to its caller. It reads a key's structure, not its characters,
 * and (since 4.0) it swaps crossed neighbours and answers: here both stay errors, as they
 * were. A caller that may hold crossed keys says so by calling `keyBetweenNeighbours`.
 */
const checkNeighbours = (a: string | null, b: string | null) => {
	for (const key of [a, b]) {
		if (key !== null && !ORDER_KEY_CHARACTERS.test(key)) throw new Error(`invalid order key: ${key}`);
	}
	if (a !== null && b !== null && a >= b) throw new Error(`${a} >= ${b}`);
};

/**
 * A key that sorts after `a` and before `b` (null: open on that side). Throws when
 * `a >= b` or a key is malformed.
 */
export function generateKeyBetween(a: string | null, b: string | null): string {
	checkNeighbours(a, b);
	return keyBetween(a, b);
}

/** `count` keys in order between `a` and `b` (e.g. the positions of seeded rows). */
export function generateKeysBetween(a: string | null, b: string | null, count: number): string[] {
	checkNeighbours(a, b);
	return generateNKeysBetween(a, b, count);
}

/** Code-unit order for order keys (Array.sort's default compares the same way, but says so). */
export const compareOrderKeys = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The key for an item placed between two neighbours (either may be missing). Neighbours
 * with the same or crossed keys (two tabs moved at once) fall back to after `before`, so
 * a move never fails; the next move sorts them out.
 */
export function keyBetweenNeighbours(before: string | null | undefined, after: string | null | undefined): string {
	const a = before ?? null;
	const b = after ?? null;
	if (a !== null && b !== null && a >= b) return generateKeyBetween(a, null);
	return generateKeyBetween(a, b);
}
