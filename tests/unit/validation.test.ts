import { afterEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { phone } from "@/lib/phone";
import {
	acceptsType,
	choice,
	choices,
	currency,
	dateRange,
	email,
	files,
	hexColor,
	isoDate,
	mustAccept,
	numberRange,
	optionalText,
	otp,
	password,
	passwordStrength,
	required,
	richText,
	richTextPlainText,
	tags,
	time,
	url,
} from "@/lib/validation";
import { overwriteGetLocale } from "@/paraglide/runtime";

const firstError = (schema: z.ZodType, value: unknown) => {
	const result = schema.safeParse(value);
	return result.success ? undefined : result.error.issues[0]?.message;
};

afterEach(() => {
	overwriteGetLocale(() => "en");
});

describe("text helpers", () => {
	it("required trims and rejects empty input", () => {
		expect(firstError(required(), "   ")).toBe("This field is required.");
		expect(firstError(required(), undefined)).toBe("This field is required.");
		expect(required().parse("  Sita ")).toBe("Sita");
		expect(firstError(required({ max: 3 }), "abcd")).toBe("Use at most 3 characters.");
	});

	it("optionalText allows empty strings", () => {
		expect(optionalText().parse("")).toBe("");
		expect(firstError(optionalText({ max: 2 }), "abc")).toBe("Use at most 2 characters.");
	});

	it("email", () => {
		expect(firstError(email(), "")).toBe("This field is required.");
		expect(firstError(email(), "sita@")).toBe("Enter a valid email address.");
		expect(email().parse(" sita@example.com ")).toBe("sita@example.com");
	});

	it("url accepts only http(s), optionally empty", () => {
		expect(firstError(url(), "ftp://example.com")).toMatch(/valid web address/);
		expect(firstError(url(), "javascript:alert(1)")).toMatch(/valid web address/);
		expect(url().parse("https://example.com/path")).toBe("https://example.com/path");
		expect(url({ optional: true }).parse("")).toBe("");
		expect(firstError(url({ optional: true }), "nope")).toMatch(/valid web address/);
	});
});

describe("password", () => {
	it("scores strength from 0 to 4", () => {
		expect(passwordStrength("short")).toBe(0);
		expect(passwordStrength("abcdefgh")).toBe(1);
		expect(passwordStrength("abcdefg1")).toBe(1);
		expect(passwordStrength("Abcdefg1")).toBe(2);
		expect(passwordStrength("Abcdefg1!")).toBe(3);
		expect(passwordStrength("Abcdefghij1!")).toBe(4);
	});

	it("requires length and a minimum strength", () => {
		expect(firstError(password(), "")).toBe("This field is required.");
		expect(firstError(password(), "short")).toBe("Use at least 8 characters.");
		expect(firstError(password(), "abcdefgh")).toMatch(/Make it stronger/);
		expect(password().parse("Abcdefg1")).toBe("Abcdefg1");
		expect(firstError(password({ minStrength: 4 }), "Abcdefg1")).toMatch(/Make it stronger/);
	});
});

describe("numbers", () => {
	it("numberRange", () => {
		expect(firstError(numberRange(), Number.NaN)).toBe("Enter a number.");
		expect(firstError(numberRange(), undefined)).toBe("Enter a number.");
		expect(firstError(numberRange({ min: 1 }), 0)).toBe("Must be at least 1.");
		expect(firstError(numberRange({ max: 1000 }), 1500)).toBe("Must be at most 1,000.");
		expect(firstError(numberRange({ integer: true }), 1.5)).toBe("Enter a whole number.");
		expect(numberRange({ min: 1, max: 10 }).parse(5)).toBe(5);
	});

	it("currency allows two decimals and no negatives by default", () => {
		expect(currency().parse(1234.5)).toBe(1234.5);
		expect(currency().parse(0.1 + 0.2)).toBeCloseTo(0.3);
		expect(firstError(currency(), 1.234)).toBe("Use at most 2 decimal places.");
		expect(firstError(currency(), -1)).toBe("Must be at least 0.");
		expect(firstError(currency({ max: 100 }), 101)).toBe("Must be at most 100.");
	});
});

describe("choices", () => {
	it("choice, choices and mustAccept", () => {
		expect(firstError(choice(), "")).toBe("This field is required.");
		expect(choice().parse("ktm")).toBe("ktm");
		expect(firstError(choices({ min: 2 }), ["a"])).toBe("Choose at least 2.");
		expect(choices().parse(["a"])).toEqual(["a"]);
		expect(firstError(mustAccept(), false)).toBe("You must accept this to continue.");
		expect(mustAccept().parse(true)).toBe(true);
	});
});

describe("localization", () => {
	it("reports messages in Nepali, with Nepali digits, when the locale is ne", () => {
		overwriteGetLocale(() => "ne");
		expect(firstError(required(), "")).toBe("यो विवरण आवश्यक छ।");
		expect(firstError(password(), "short")).toBe("कम्तीमा ८ अक्षर प्रयोग गर्नुहोस्।");
		expect(firstError(numberRange({ max: 1000 }), 1500)).toBe("बढीमा १,००० हुनुपर्छ।");
	});

	it("evaluates messages when validating, not when the schema is created", () => {
		const schema = required();
		expect(firstError(schema, "")).toBe("This field is required.");
		overwriteGetLocale(() => "ne");
		expect(firstError(schema, "")).toBe("यो विवरण आवश्यक छ।");
	});
});

describe("phone and otp", () => {
	it("phone accepts valid E.164 numbers per country and rejects others", () => {
		expect(phone().parse("+9779812345678")).toBe("+9779812345678");
		expect(firstError(phone(), "")).toBe("This field is required.");
		expect(firstError(phone(), "+977123")).toBe("Enter a valid phone number.");
		expect(phone({ optional: true }).parse("")).toBe("");
		expect(firstError(phone({ optional: true }), "+1555")).toBe("Enter a valid phone number.");
	});

	it("otp requires exactly six digits", () => {
		expect(otp().parse("012345")).toBe("012345");
		expect(firstError(otp(), "12345")).toBe("Enter the 6-digit code.");
		expect(firstError(otp(), "12a456")).toBe("Enter the 6-digit code.");
	});
});

describe("dates and time", () => {
	it("isoDate checks the format, real calendar dates and bounds", () => {
		expect(isoDate().parse("2026-02-28")).toBe("2026-02-28");
		expect(firstError(isoDate(), "")).toBe("Choose a date.");
		expect(firstError(isoDate(), "2026-02-30")).toBe("Choose a date.");
		expect(firstError(isoDate({ min: "2026-01-01" }), "2025-12-31")).toMatch(/^Choose a date on or after Jan 1, 2026/);
		expect(firstError(isoDate({ max: "2026-01-01" }), "2026-01-02")).toMatch(/^Choose a date on or before/);
	});

	it("isoDate reports only one error for an empty value with bounds", () => {
		const result = isoDate({ min: "2020-01-01" }).safeParse("");
		expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toEqual(["Choose a date."]);
	});

	it("dateRange needs both ends in order", () => {
		expect(dateRange().parse({ from: "2026-01-01", to: "2026-01-05" })).toEqual({
			from: "2026-01-01",
			to: "2026-01-05",
		});
		expect(firstError(dateRange(), { from: "2026-01-01" })).toBe("Choose a start and an end date.");
		expect(firstError(dateRange(), { from: "2026-01-05", to: "2026-01-01" })).toBe(
			"The end date must be on or after the start date.",
		);
	});

	it("time is 24-hour HH:mm", () => {
		expect(time().parse("23:59")).toBe("23:59");
		expect(firstError(time(), "24:00")).toBe("Enter a time in 24-hour format, like 14:30.");
		expect(firstError(time(), "9:30")).toBe("Enter a time in 24-hour format, like 14:30.");
	});
});

describe("tags and colour", () => {
	it("tags limits count and length", () => {
		expect(tags().parse([" a "])).toEqual(["a"]);
		expect(firstError(tags({ max: 1 }), ["a", "b"])).toBe("Add at most 1 tags.");
		expect(firstError(tags({ maxLength: 3 }), ["abcd"])).toBe("Each tag can be at most 3 characters.");
	});

	it("hexColor requires #rrggbb", () => {
		expect(hexColor().parse("#1E40af")).toBe("#1E40af");
		expect(firstError(hexColor(), "#fff")).toBe("Enter a color like #1e40af.");
	});
});

describe("files", () => {
	const pdf = new File(["x".repeat(10)], "cv.pdf", { type: "application/pdf" });
	const big = new File(["x".repeat(2048)], "big.png", { type: "image/png" });
	const exe = new File(["x"], "run.exe", { type: "application/x-msdownload" });
	const rules = { maxBytes: 1024, accept: ["application/pdf", "image/*"] };

	it("acceptsType handles exact types and wildcards", () => {
		expect(acceptsType("image/webp", ["image/*"])).toBe(true);
		expect(acceptsType("application/pdf", ["image/*"])).toBe(false);
		expect(acceptsType("application/pdf", ["application/pdf"])).toBe(true);
	});

	it("checks size, type, minimum and maximum count", () => {
		expect(files(rules).parse([pdf])).toEqual([pdf]);
		expect(firstError(files(rules), [big])).toBe("big.png is larger than 1 KB.");
		expect(firstError(files(rules), [exe])).toBe("run.exe isn't an accepted file type.");
		expect(firstError(files({ ...rules, min: 1 }), [])).toBe("Choose a file.");
		expect(firstError(files({ ...rules, max: 1 }), [pdf, pdf])).toBe("Choose at most 1 files.");
	});
});

describe("rich text", () => {
	it("measures visible text, not markup", () => {
		expect(richTextPlainText("<p>Hi <strong>there</strong></p><p>&amp;</p>")).toBe("Hi there x");
		expect(richTextPlainText("<p></p><p>&nbsp;</p>")).toBe("");
	});

	it("richText is required by default and limits visible length", () => {
		expect(firstError(richText(), "<p></p>")).toBe("This field is required.");
		expect(richText({ required: false }).parse("")).toBe("");
		expect(firstError(richText({ max: 3 }), "<p><strong>abcd</strong></p>")).toMatch(/3/);
		expect(richText({ max: 3 }).parse("<p><strong>abc</strong></p>")).toBe("<p><strong>abc</strong></p>");
	});
});
