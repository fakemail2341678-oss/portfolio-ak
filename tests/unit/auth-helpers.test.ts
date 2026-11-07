import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/features/auth/errors";
import { describeUserAgent } from "@/features/auth/user-agent";
import {
	collectErrors,
	validateConfirm,
	validateEmail,
	validateOtp,
	validatePassword,
	validateRequired,
} from "@/features/auth/validation";

describe("authErrorMessage", () => {
	it("maps Better Auth codes to localized text", () => {
		expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe("Incorrect email or password.");
		expect(authErrorMessage({ code: "INVALID_OTP", status: 400 })).toBe("That code is incorrect or has expired.");
		expect(authErrorMessage({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 })).toBe(
			"An account with this email already exists.",
		);
	});

	it("treats any 429 as rate limiting", () => {
		expect(authErrorMessage({ status: 429 })).toBe("Too many attempts. Wait a moment and try again.");
	});

	it("never shows raw server messages for unknown codes", () => {
		const text = authErrorMessage({ code: "SOMETHING_NEW", status: 500, message: "db exploded at 10.0.0.5" });
		expect(text).toBe("Something went wrong. Please try again.");
		expect(authErrorMessage(null)).toBe("Something went wrong. Please try again.");
	});
});

describe("describeUserAgent", () => {
	it.each([
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0 Safari/537.36",
			{ browser: "Chrome", os: "Windows" },
		],
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0 Safari/537.36 Edg/154.0",
			{ browser: "Edge", os: "Windows" },
		],
		[
			"Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
			{ browser: "Safari", os: "iOS" },
		],
		["Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0", { browser: "Firefox", os: "Linux" }],
		[
			"Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0 Mobile Safari/537.36",
			{ browser: "Chrome", os: "Android" },
		],
	])("%s", (userAgent, expected) => {
		expect(describeUserAgent(userAgent)).toEqual(expected);
	});

	it("handles missing user agents", () => {
		expect(describeUserAgent(null)).toEqual({});
		expect(describeUserAgent("curl/8.9")).toEqual({});
	});
});

describe("auth form validation", () => {
	it("validates emails", () => {
		expect(validateEmail("")).toBe("This field is required.");
		expect(validateEmail("nope")).toBe("Enter a valid email address.");
		expect(validateEmail(" sita@example.com ")).toBeUndefined();
	});

	it("validates passwords and confirmation", () => {
		expect(validatePassword("short")).toBe("Use at least 8 characters.");
		expect(validatePassword("long-enough")).toBeUndefined();
		expect(validateConfirm("long-enough", "different")).toBe("Passwords don't match.");
		expect(validateConfirm("long-enough", "long-enough")).toBeUndefined();
	});

	it("validates required fields and OTP codes", () => {
		expect(validateRequired("   ")).toBe("This field is required.");
		expect(validateOtp("12345")).toBe("Enter the 6-digit code.");
		expect(validateOtp("12a456")).toBe("Enter the 6-digit code.");
		expect(validateOtp("123456")).toBeUndefined();
	});

	it("collects only the failing fields", () => {
		expect(collectErrors({ a: undefined, b: "bad" })).toEqual({ b: "bad" });
		expect(collectErrors({ a: undefined })).toBeNull();
	});
});
