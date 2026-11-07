import { describe, expect, it } from "vitest";
import {
	compareOrderKeys,
	generateKeyBetween,
	generateKeysBetween,
	isOrderKey,
	keyBetweenNeighbours,
	MAX_ORDER_KEY_LENGTH,
} from "@/lib/fractional-index";

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
	});
});
