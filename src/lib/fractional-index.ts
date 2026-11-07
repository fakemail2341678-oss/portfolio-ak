/**
 * Fractional indexing (decision 0188): an order key is a string, and between any two
 * keys there is always another, so moving an item writes one row (its new key) instead
 * of renumbering a list. Keys compare by code unit: JavaScript's `<` and Postgres'
 * `COLLATE "C"`, never a locale collation.
 *
 * The algorithm is David Greenspan's, as published in rocicorp's `fractional-indexing`
 * (CC0): an integer part whose first character encodes its length ("a0", "a1" … "az",
 * "b10" …), then an optional fraction that never ends in the zero digit.
 *
 *   generateKeyBetween(null, null)   // "a0": the first item
 *   generateKeyBetween("a0", null)   // "a1": after the last
 *   generateKeyBetween("a0", "a1")   // "a0V": between two
 */
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ZERO = "0";
const LAST = "z";
/** The smallest integer part, which has no key before it. */
const SMALLEST = `A${ZERO.repeat(26)}`;

/** Longest key accepted from a client (a key grows by about one character per halving). */
export const MAX_ORDER_KEY_LENGTH = 64;

const integerLength = (head: string): number => {
	if (head >= "a" && head <= "z") return head.charCodeAt(0) - 97 + 2;
	if (head >= "A" && head <= "Z") return 90 - head.charCodeAt(0) + 2;
	throw new Error(`invalid order key head: ${head}`);
};

const integerPart = (key: string): string => {
	const length = integerLength(key.charAt(0));
	if (length > key.length) throw new Error(`invalid order key: ${key}`);
	return key.slice(0, length);
};

const validate = (key: string) => {
	if (key === SMALLEST) throw new Error(`invalid order key: ${key}`);
	const fraction = key.slice(integerPart(key).length);
	if (fraction.endsWith(ZERO)) throw new Error(`invalid order key: ${key}`);
	for (const char of key.slice(1)) {
		if (!DIGITS.includes(char)) throw new Error(`invalid order key: ${key}`);
	}
};

/** Whether `value` is a well-formed order key (what a server checks before storing one). */
export const isOrderKey = (value: string): boolean => {
	if (value.length === 0 || value.length > MAX_ORDER_KEY_LENGTH) return false;
	try {
		validate(value);
		return true;
	} catch {
		return false;
	}
};

/** A fraction strictly between `a` and `b` (`b` null: no upper bound). */
const midpoint = (a: string, b: string | null): string => {
	if (b !== null && a >= b) throw new Error(`${a} >= ${b}`);
	if (a.endsWith(ZERO) || b?.endsWith(ZERO)) throw new Error("trailing zero");
	if (b !== null) {
		let shared = 0;
		while ((a.charAt(shared) || ZERO) === b.charAt(shared)) shared++;
		if (shared > 0) return b.slice(0, shared) + midpoint(a.slice(shared), b.slice(shared));
	}
	const digitA = a ? DIGITS.indexOf(a.charAt(0)) : 0;
	const digitB = b !== null ? DIGITS.indexOf(b.charAt(0)) : DIGITS.length;
	if (digitB - digitA > 1) return DIGITS.charAt(Math.round((digitA + digitB) / 2));
	if (b !== null && b.length > 1) return b.slice(0, 1);
	return DIGITS.charAt(digitA) + midpoint(a.slice(1), null);
};

const checkInteger = (integer: string) => {
	if (integer.length !== integerLength(integer.charAt(0))) throw new Error(`invalid integer part: ${integer}`);
};

const increment = (integer: string): string | null => {
	checkInteger(integer);
	const head = integer.charAt(0);
	const digits = integer.slice(1).split("");
	let carry = true;
	for (let index = digits.length - 1; carry && index >= 0; index--) {
		const next = DIGITS.indexOf(digits[index] ?? ZERO) + 1;
		if (next === DIGITS.length) digits[index] = ZERO;
		else {
			digits[index] = DIGITS.charAt(next);
			carry = false;
		}
	}
	if (!carry) return head + digits.join("");
	if (head === "Z") return `a${ZERO}`;
	if (head === "z") return null;
	const nextHead = String.fromCharCode(head.charCodeAt(0) + 1);
	if (nextHead > "a") digits.push(ZERO);
	else digits.pop();
	return nextHead + digits.join("");
};

const decrement = (integer: string): string | null => {
	checkInteger(integer);
	const head = integer.charAt(0);
	const digits = integer.slice(1).split("");
	let borrow = true;
	for (let index = digits.length - 1; borrow && index >= 0; index--) {
		const next = DIGITS.indexOf(digits[index] ?? ZERO) - 1;
		if (next === -1) digits[index] = LAST;
		else {
			digits[index] = DIGITS.charAt(next);
			borrow = false;
		}
	}
	if (!borrow) return head + digits.join("");
	if (head === "a") return `Z${LAST}`;
	if (head === "A") return null;
	const nextHead = String.fromCharCode(head.charCodeAt(0) - 1);
	if (nextHead < "Z") digits.push(LAST);
	else digits.pop();
	return nextHead + digits.join("");
};

/**
 * A key that sorts after `a` and before `b` (null: open on that side). Throws when
 * `a >= b` or a key is malformed.
 */
export function generateKeyBetween(a: string | null, b: string | null): string {
	if (a !== null) validate(a);
	if (b !== null) validate(b);
	if (a !== null && b !== null && a >= b) throw new Error(`${a} >= ${b}`);
	if (a === null) {
		if (b === null) return `a${ZERO}`;
		const integerB = integerPart(b);
		const fractionB = b.slice(integerB.length);
		if (integerB === SMALLEST) return integerB + midpoint("", fractionB);
		if (integerB < b) return integerB;
		const before = decrement(integerB);
		if (before === null) throw new Error("cannot decrement any more");
		return before;
	}
	const integerA = integerPart(a);
	const fractionA = a.slice(integerA.length);
	if (b === null) {
		const after = increment(integerA);
		return after === null ? integerA + midpoint(fractionA, null) : after;
	}
	const integerB = integerPart(b);
	const fractionB = b.slice(integerB.length);
	if (integerA === integerB) return integerA + midpoint(fractionA, fractionB);
	const after = increment(integerA);
	if (after === null) throw new Error("cannot increment any more");
	if (after < b) return after;
	return integerA + midpoint(fractionA, null);
}

/** `count` keys in order between `a` and `b` (e.g. the positions of seeded rows). */
export function generateKeysBetween(a: string | null, b: string | null, count: number): string[] {
	const keys: string[] = [];
	let previous = a;
	for (let index = 0; index < count; index++) {
		previous = generateKeyBetween(previous, b);
		keys.push(previous);
	}
	return keys;
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
