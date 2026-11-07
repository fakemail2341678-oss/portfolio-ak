// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { dayRangeInZone, startOfDayInZone } from "@/lib/i18n/date-only";
import { arrayParam, booleanParam, dateParam, numberParam, parseParams } from "@/lib/list/params";
import { formSearchPatch, parseSearch, stringifySearch } from "@/lib/list/url";

describe("filter params", () => {
	const schema = z.object({
		tags: arrayParam(z.string().min(1).max(5), { max: 3 }),
		min: numberParam({ max: 1000 }),
		from: dateParam(),
		image: booleanParam(),
	});

	it("absent params: empty array, undefined for the rest", () => {
		expect(schema.parse({})).toEqual({ tags: [], min: undefined, from: undefined, image: undefined });
	});

	it("arrays accept one value, repeated keys or a JSON array; dedupe, drop invalid, cap", () => {
		expect(schema.parse({ tags: "food" }).tags).toEqual(["food"]);
		expect(schema.parse({ tags: ["a", "b", "a"] }).tags).toEqual(["a", "b"]);
		expect(schema.parse({ tags: ["ok", "much-too-long", ""] }).tags).toEqual(["ok"]);
		expect(schema.parse({ tags: ["a", "b", "c", "d"] }).tags).toEqual(["a", "b", "c"]);
		// The router turns numeric-looking values into numbers; tags stay strings.
		expect(schema.parse({ tags: [2026] }).tags).toEqual(["2026"]);
	});

	it("numbers: empty form fields and junk are 'not set', bounds are enforced", () => {
		expect(schema.parse({ min: "" }).min).toBeUndefined();
		expect(schema.parse({ min: "abc" }).min).toBeUndefined();
		expect(schema.parse({ min: 250 }).min).toBe(250);
		expect(schema.parse({ min: "99.5" }).min).toBe(99.5);
		expect(schema.parse({ min: -1 }).min).toBeUndefined();
		expect(schema.parse({ min: 5000 }).min).toBeUndefined();
	});

	it("dates: only real YYYY-MM-DD calendar dates", () => {
		expect(schema.parse({ from: "2026-09-01" }).from).toBe("2026-09-01");
		expect(schema.parse({ from: "2026-13-01" }).from).toBeUndefined();
		expect(schema.parse({ from: "01/09/2026" }).from).toBeUndefined();
		expect(schema.parse({ from: "" }).from).toBeUndefined();
	});

	it("booleans: true/false (as parsed or as text), anything else is 'any'", () => {
		expect(schema.parse({ image: true }).image).toBe(true);
		expect(schema.parse({ image: "false" }).image).toBe(false);
		expect(schema.parse({ image: "" }).image).toBeUndefined();
		expect(schema.parse({ image: "yes" }).image).toBeUndefined();
	});
});

describe("search serialization", () => {
	it("writes arrays as repeated keys, like a submitted form", () => {
		expect(stringifySearch({ tags: ["food", "nepal"], page: 2, q: "momo" })).toBe(
			"?page=2&q=momo&tags=food&tags=nepal",
		);
	});

	it("round-trips through parseSearch", () => {
		const search = { tags: ["food", "nepal"], priceMin: 100, hasImage: true, from: "2026-09-01", q: "dal bhat" };
		expect(parseSearch(stringifySearch(search))).toEqual(search);
	});

	it("reads what a no-JS GET form submits", () => {
		expect(parseSearch("?q=&status=draft&tags=food&tags=nepal&priceMin=&hasImage=true")).toEqual({
			q: "",
			status: "draft",
			tags: ["food", "nepal"],
			priceMin: "",
			hasImage: true,
		});
	});

	it("omits empty search entirely", () => {
		expect(stringifySearch({})).toBe("");
		expect(stringifySearch({ tags: [] })).toBe("");
	});
});

describe("formSearchPatch", () => {
	const form = (html: string) => {
		const element = document.createElement("form");
		element.innerHTML = html;
		return element;
	};

	it("collects every named control; checkboxes become arrays, empty values undefined", () => {
		const patch = formSearchPatch(
			form(`
				<input name="q" value="momo" />
				<select name="status"><option value="draft" selected>d</option></select>
				<input type="checkbox" name="tags" value="food" checked />
				<input type="checkbox" name="tags" value="drink" />
				<input type="checkbox" name="tags" value="nepal" checked />
				<input type="number" name="priceMin" value="" />
				<input type="hidden" name="sort" value="title" />
			`),
			{ exclude: ["sort"] },
		);
		expect(patch).toEqual({ q: "momo", status: "draft", tags: ["food", "nepal"], priceMin: undefined });
	});

	it("several selects of one name make a list of the chosen values (Taskline's field filters)", () => {
		const patch = formSearchPatch(
			form(`
				<select name="cf"><option value="">any</option><option value="a:x" selected>x</option></select>
				<select name="cf"><option value="" selected>any</option><option value="b:y">y</option></select>
			`),
		);
		expect(patch).toEqual({ cf: ["a:x"] });
	});

	it("unchecking every box clears the param", () => {
		const patch = formSearchPatch(form(`<input type="checkbox" name="tags" value="food" />`));
		expect(patch).toEqual({ tags: [] });
	});
});

describe("parseParams", () => {
	const schema = z.object({ id: z.uuid() });
	it("returns parsed params, or false so the route doesn't match", () => {
		expect(parseParams(schema, { id: "6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0001" })).toEqual({
			id: "6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0001",
		});
		expect(parseParams(schema, { id: "new-ish" })).toBe(false);
	});
});

describe("calendar days in a time zone", () => {
	it("a Nepal day starts at 18:15 UTC the day before (UTC+5:45)", () => {
		expect(startOfDayInZone("2026-09-01", "Asia/Kathmandu")?.toISOString()).toBe("2026-08-31T18:15:00.000Z");
	});

	it("inclusive day ranges end when the day after `to` starts", () => {
		const range = dayRangeInZone("2026-09-01", "2026-09-30", "Asia/Kathmandu");
		expect(range.start?.toISOString()).toBe("2026-08-31T18:15:00.000Z");
		expect(range.end?.toISOString()).toBe("2026-09-30T18:15:00.000Z");
	});

	it("handles daylight-saving changes (a 23-hour day in New York)", () => {
		const range = dayRangeInZone("2026-03-08", "2026-03-08", "America/New_York");
		expect(range.start?.toISOString()).toBe("2026-03-08T05:00:00.000Z");
		expect(range.end?.toISOString()).toBe("2026-03-09T04:00:00.000Z");
	});

	it("open-ended ranges and bad input", () => {
		expect(dayRangeInZone(undefined, undefined, "Asia/Kathmandu")).toEqual({});
		expect(dayRangeInZone("2026-09-01", undefined, "Asia/Kathmandu").end).toBeUndefined();
		expect(startOfDayInZone("garbage", "Asia/Kathmandu")).toBeUndefined();
	});
});
