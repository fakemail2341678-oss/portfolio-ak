import { describe, expect, it, vi } from "vitest";
import { createLruCache } from "@/server/cache/lru";

/** The shared LRU (decision 0255): Parda's TMDB answers and Chaal's Lichess answers sit on it. */
describe("the server's LRU cache", () => {
	const setup = (max?: number) => {
		let time = 0;
		const cache = createLruCache({ now: () => time, ...(max ? { max } : {}) });
		return { cache, advance: (ms: number) => (time += ms) };
	};

	it("answers fresh from the map, then stale while it refreshes in the background, then waits for a reload", async () => {
		const { cache, advance } = setup();
		const load = vi.fn(async () => "a");
		expect(await cache.read("k", 1_000, load)).toBe("a");
		advance(999);
		expect(await cache.read("k", 1_000, load)).toBe("a");
		expect(load).toHaveBeenCalledTimes(1);
		advance(1);
		load.mockResolvedValueOnce("b");
		expect(await cache.read("k", 1_000, load)).toBe("a");
		await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
		expect(await cache.read("k", 1_000, load)).toBe("b");
		advance(2_000);
		load.mockResolvedValueOnce("c");
		expect(await cache.read("k", 1_000, load)).toBe("c");
	});

	it("makes one call for concurrent readers of a key", async () => {
		const { cache } = setup();
		let release: (value: string) => void = () => {};
		const load = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
		const reads = [cache.read("k", 1_000, load), cache.read("k", 1_000, load)];
		release("once");
		expect(await Promise.all(reads)).toEqual(["once", "once"]);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("drops the least recently used entry past its size, and peek returns whatever is held, however old", async () => {
		const { cache, advance } = setup(2);
		await cache.read("a", 1_000, async () => 1);
		await cache.read("b", 1_000, async () => 2);
		await cache.read("a", 1_000, async () => 0);
		await cache.read("c", 1_000, async () => 3);
		expect(cache.size()).toBe(2);
		expect(cache.peek("b")).toBeNull();
		advance(60_000);
		expect(cache.peek<number>("a")).toBe(1);
	});

	it("keeps no value from a failed load", async () => {
		const { cache } = setup();
		await expect(cache.read("k", 1_000, () => Promise.reject(new Error("down")))).rejects.toThrow("down");
		expect(cache.peek("k")).toBeNull();
		expect(await cache.read("k", 1_000, async () => "up")).toBe("up");
	});
});
