import { describe, expect, it } from "vitest";
import { LOCALE_HEADER } from "@/lib/i18n/locale-header";
import { resolveEmailLocale } from "@/server/auth/locale";

const origin = "http://localhost:3000";

describe("resolveEmailLocale", () => {
	it("prefers the locale header the auth client sends", () => {
		const request = new Request(`${origin}/api/auth/sign-up/email`, { headers: { [LOCALE_HEADER]: "ne" } });
		expect(resolveEmailLocale(request)).toBe("ne");
	});

	it("ignores unknown header values", () => {
		const request = new Request(`${origin}/api/auth/sign-up/email`, { headers: { [LOCALE_HEADER]: "fr" } });
		expect(resolveEmailLocale(request)).toBe("en");
	});

	it("falls back to the callbackURL of an emailed link (no header on link clicks)", () => {
		const ne = new Request(
			`${origin}/api/auth/verify-email?token=t&callbackURL=${encodeURIComponent("/ne/verify-email")}`,
		);
		const en = new Request(
			`${origin}/api/auth/verify-email?token=t&callbackURL=${encodeURIComponent("/verify-email")}`,
		);
		expect(resolveEmailLocale(ne)).toBe("ne");
		expect(resolveEmailLocale(en)).toBe("en");
	});

	it("ignores protocol-relative callback URLs", () => {
		const request = new Request(
			`${origin}/api/auth/verify-email?callbackURL=${encodeURIComponent("//evil.example/ne/")}`,
		);
		expect(resolveEmailLocale(request)).toBe("en");
	});

	it("uses the request locale when nothing else is known", () => {
		expect(resolveEmailLocale(undefined)).toBe("en");
	});
});
