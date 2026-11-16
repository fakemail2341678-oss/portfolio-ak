import { describe, expect, it } from "vitest";
import {
	compareOrderKeys,
	generateKeyBetween,
	generateKeysBetween,
	isOrderKey,
	keyBetweenNeighbours,
	MAX_ORDER_KEY_LENGTH,
} from "@/lib/fractional-index";
import orderKeys from "../fixtures/order-keys.json";

/** A small deterministic generator, so a failing sequence can be replayed. */
const random = (seed: number) => () => {
	seed = (seed * 1103515245 + 12345) % 2147483648;
	return seed / 2147483648;
};

describe("fractional index", () => {
	it("starts at a0 and counts up and down from there", () => {
		expect(generateKeyBetween(null, null)).toBe("a0");
		expect(generateKeyBetween("a0", null)).toBe("a1");
		expect(generateKeyBetween("a1", null)).toBe("a2");
		expect(generateKeyBetween(null, "a0")).toBe("Zz");
		expect(generateKeyBetween("az", null)).toBe("b00");
		expect(generateKeyBetween(null, "b00")).toBe("az");
	});

	it("finds a key between two neighbours", () => {
		expect(generateKeyBetween("a0", "a1")).toBe("a0V");
		expect(generateKeyBetween("a0", "a0V")).toBe("a0G");
		expect(generateKeyBetween("a0V", "a1")).toBe("a0l");
		expect(generateKeyBetween("Zz", "a0")).toBe("ZzV");
	});

	it("refuses keys out of order or malformed", () => {
		expect(() => generateKeyBetween("a1", "a0")).toThrow();
		expect(() => generateKeyBetween("a0", "a0")).toThrow();
		expect(() => generateKeyBetween("a00", null)).toThrow();
		expect(() => generateKeyBetween("", null)).toThrow();
		expect(() => generateKeyBetween("a!", null)).toThrow();
	});

	it("keeps any sequence of random inserts in order, with short keys", () => {
		const next = random(41);
		const keys: string[] = [generateKeyBetween(null, null)];
		for (let step = 0; step < 2000; step++) {
			const at = Math.floor(next() * (keys.length + 1));
			const key = generateKeyBetween(keys[at - 1] ?? null, keys[at] ?? null);
			keys.splice(at, 0, key);
		}
		expect([...keys].sort(compareOrderKeys)).toEqual(keys);
		expect(new Set(keys).size).toBe(keys.length);
		expect(keys.every(isOrderKey)).toBe(true);
		expect(Math.max(...keys.map((key) => key.length))).toBeLessThan(16);
	});

	it("survives repeatedly inserting at the same spot (the worst case for length)", () => {
		let low = "a0";
		const high = "a1";
		for (let step = 0; step < 40; step++) {
			const key = generateKeyBetween(low, high);
			expect(key > low && key < high).toBe(true);
			low = key;
		}
		expect(low.length).toBeLessThanOrEqual(MAX_ORDER_KEY_LENGTH);
	});

	it("generates several keys in order", () => {
		const keys = generateKeysBetween(null, null, 5);
		expect(keys).toEqual(["a0", "a1", "a2", "a3", "a4"]);
		const between = generateKeysBetween("a0", "a1", 3);
		expect([...between].sort(compareOrderKeys)).toEqual(between);
		expect(between.every((key) => key > "a0" && key < "a1")).toBe(true);
	});

	it("sorts by code unit, the same as Postgres COLLATE C", () => {
		expect(["a0", "Zz", "a0V", "aZ", "a1"].sort(compareOrderKeys)).toEqual(["Zz", "a0", "a0V", "a1", "aZ"]);
	});

	it("never fails between neighbours that collided", () => {
		expect(keyBetweenNeighbours("a1", "a1")).toBe("a2");
		expect(keyBetweenNeighbours("a2", "a1")).toBe("a3");
		expect(keyBetweenNeighbours(undefined, undefined)).toBe("a0");
		expect(keyBetweenNeighbours("a0", undefined)).toBe("a1");
	});

	it("checks keys from clients", () => {
		expect(isOrderKey("a0")).toBe(true);
		expect(isOrderKey("a0V")).toBe(true);
		expect(isOrderKey("a0V0")).toBe(false);
		expect(isOrderKey("")).toBe(false);
		expect(isOrderKey("a0".padEnd(MAX_ORDER_KEY_LENGTH + 1, "V"))).toBe(false);
		expect(isOrderKey("x")).toBe(false);
		expect(isOrderKey("a 0")).toBe(false);
		expect(isOrderKey("a0é")).toBe(false);
		expect(isOrderKey(`A${"0".repeat(26)}`)).toBe(false);
	});
});

/**
 * The keys in the database were made by the hand-written copy of the algorithm that
 * `fractional-indexing` replaced (decision 0299). `tests/fixtures/order-keys.json` holds 681
 * of its answers, recorded before it went: a list growing at its end and at its start, one
 * gap halved forty times toward each side, and 300 inserts at random places.
 */
describe("the package against the keys already stored", () => {
	const triples = orderKeys.triples as Array<[string | null, string | null, string]>;

	it("gives the key the old code gave, for every recorded pair of neighbours", () => {
		expect(triples).toHaveLength(681);
		for (const [a, b, key] of triples) expect(generateKeyBetween(a, b)).toBe(key);
	});

	it("accepts every stored key, and puts a new one between any two of them", () => {
		const stored = [...new Set(triples.map(([, , key]) => key))].sort(compareOrderKeys);
		expect(stored.every(isOrderKey)).toBe(true);
		for (let index = 1; index < stored.length; index++) {
			const before = stored[index - 1] ?? "";
			const after = stored[index] ?? "";
			const between = generateKeyBetween(before, after);
			expect(between > before && between < after).toBe(true);
		}
		const [first, last] = [stored[0] ?? null, stored.at(-1) ?? null];
		expect(generateKeyBetween(null, first) < (first ?? "")).toBe(true);
		expect(generateKeyBetween(last, null) > (last ?? "")).toBe(true);
	});

	it("spreads several keys between two stored ones, in order", () => {
		const keys = generateKeysBetween("a0", "a1", 20);
		expect(new Set(keys).size).toBe(20);
		expect([...keys].sort(compareOrderKeys)).toEqual(keys);
		expect(keys.every((key) => key > "a0" && key < "a1" && isOrderKey(key))).toBe(true);
	});
});
