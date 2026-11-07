import { describe, expect, it } from "vitest";
import { z } from "zod";
import { cn } from "@/features/portfolio/lib/cn";
import { formatMetric } from "@/features/portfolio/lib/format-metric";
import { readingMinutes } from "@/features/portfolio/lib/reading-time";
import { hashString, round, seededRandom } from "@/features/portfolio/lib/seeded-random";
import { isFallback, isLocalized, localized, resolveLocalized } from "@/lib/i18n/localized";

describe("resolveLocalized", () => {
	it("resolves { en, ne } pairs deeply, through arrays and objects", () => {
		const record = {
			slug: "momo",
			title: { en: "Dumplings", ne: "मःम" },
			tags: ["food"],
			steps: [{ text: { en: "Fold", ne: "बेर्नुहोस्" } }],
			edge: ["a", "b"] as [string, string],
		};
		expect(resolveLocalized(record, "ne")).toEqual({
			slug: "momo",
			title: "मःम",
			tags: ["food"],
			steps: [{ text: "बेर्नुहोस्" }],
			edge: ["a", "b"],
		});
		expect(resolveLocalized(record, "en").title).toBe("Dumplings");
	});

	it("falls back to English where Nepali is empty, and marks a record with no Nepali at all lang=en", () => {
		const untranslated = { slug: "momo", title: { en: "Dumplings", ne: "" }, body: [{ en: "Fold", ne: " " }] };
		expect(resolveLocalized(untranslated, "ne")).toEqual({
			slug: "momo",
			title: "Dumplings",
			body: ["Fold"],
			lang: "en",
		});
		// Partly translated: the translated text wins, nothing is marked.
		const partly = { title: { en: "Dumplings", ne: "मःम" }, note: { en: "Hot", ne: "" } };
		expect(resolveLocalized(partly, "ne")).toEqual({ title: "मःम", note: "Hot" });
		// English pages never mark anything; a block nested in a record is marked on its own.
		expect(resolveLocalized(untranslated, "en")).not.toHaveProperty("lang");
		const nested = resolveLocalized({ title: { en: "A", ne: "क" }, blocks: [{ text: { en: "B", ne: "" } }] }, "ne");
		expect(nested).toEqual({ title: "क", blocks: [{ text: "B", lang: "en" }] });
		expect(isFallback({ en: "A", ne: "" }, "ne")).toBe(true);
		expect(isFallback({ en: "A", ne: "" }, "en")).toBe(false);
	});

	it("validates a localized string: English as given, Nepali optional", () => {
		const schema = localized(z.string().min(1));
		expect(schema.safeParse({ en: "Hi", ne: "" }).success).toBe(true);
		expect(schema.safeParse({ en: "", ne: "नमस्ते" }).success).toBe(false);
	});

	it("only treats objects with exactly the locale keys as localized", () => {
		expect(isLocalized({ en: "a", ne: "b" })).toBe(true);
		expect(isLocalized({ en: "a" })).toBe(false);
		expect(isLocalized({ en: "a", ne: "b", de: "c" })).toBe(false);
		expect(isLocalized(["en", "ne"])).toBe(false);
		expect(isLocalized(null)).toBe(false);
	});
});

describe("formatMetric", () => {
	it("formats each kind of number in English", () => {
		expect(formatMetric({ value: 0.63, format: "percent" }, "en")).toBe("63%");
		expect(formatMetric({ value: 0.9998, format: "percent" }, "en")).toBe("99.98%");
		expect(formatMetric({ value: 1_200_000, format: "compact" }, "en")).toBe("1.2M");
		expect(formatMetric({ value: 3, format: "multiplier" }, "en")).toBe("3×");
		expect(formatMetric({ value: 10, format: "plus" }, "en")).toBe("10+");
		expect(formatMetric({ value: 48, format: "ms" }, "en")).toBe("48 ms");
		expect(formatMetric({ value: 1.1, format: "seconds" }, "en")).toBe("1.1 s");
		expect(formatMetric({ value: 1400, format: "number" }, "en")).toBe("1,400");
	});

	it("uses Devanagari digits in Nepali", () => {
		expect(formatMetric({ value: 0.63, format: "percent" }, "ne")).toMatch(/^६३/);
		expect(formatMetric({ value: 48, format: "ms" }, "ne")).toBe("४८ ms");
	});
});

describe("seededRandom", () => {
	it("is deterministic per seed (server and client draw the same art)", () => {
		const a = seededRandom("ledgerline");
		const b = seededRandom("ledgerline");
		const sequence = Array.from({ length: 5 }, () => a.next());
		expect(Array.from({ length: 5 }, () => b.next())).toEqual(sequence);
		expect(seededRandom("haat").next()).not.toBe(sequence[0]);
		expect(hashString("ledgerline")).toBe(hashString("ledgerline"));
	});

	it("keeps helpers in range", () => {
		const rand = seededRandom("range");
		for (let index = 0; index < 200; index++) {
			const value = rand.between(2, 5);
			expect(value).toBeGreaterThanOrEqual(2);
			expect(value).toBeLessThan(5);
			const int = rand.int(1, 3);
			expect([1, 2, 3]).toContain(int);
		}
		expect(round(1.2345)).toBe(1.2);
	});
});

describe("readingMinutes", () => {
	it("counts the words of the HTML's text, at least one minute", () => {
		const words = (count: number) => Array.from({ length: count }, () => "word").join(" ");
		expect(readingMinutes("<p>Short.</p>")).toBe(1);
		expect(
			readingMinutes(
				`<p>${words(300)}</p><ul><li><p>${words(100)}</p></li><li>${words(40)}</li></ul><pre><code>x</code></pre>`,
			),
		).toBe(2);
		expect(readingMinutes("<p>a&nbsp;b</p>")).toBe(1);
	});
});

describe("portfolio cn", () => {
	it("keeps a custom font size and a custom colour together (tailwind-merge knows the scale)", () => {
		expect(cn("text-hm-head", "text-hm-accent")).toBe("text-hm-head text-hm-accent");
		expect(cn("text-hm-head", "text-hm-lead")).toBe("text-hm-lead");
		expect(cn("text-hm-muted", "text-current")).toBe("text-current");
	});
});
