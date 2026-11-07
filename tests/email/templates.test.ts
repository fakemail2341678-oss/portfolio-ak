import { describe, expect, it, vi } from "vitest";
import { renderEmail } from "@/server/email/render";
import { EMAIL_TEMPLATE_IDS, emailTemplates } from "@/server/email/templates";
import type { EmailProvider } from "@/server/email/types";

vi.hoisted(() => {
	process.env.DATABASE_URL = "postgres://u:p@localhost/db";
	process.env.EMAIL_FROM = "Portfolio <hello@example.com>";
});

const siteName = "Portfolio";
const DEVANAGARI = /[ऀ-ॿ]/;
const locales = ["en", "ne"] as const;

describe.each(EMAIL_TEMPLATE_IDS)("email template %s", (id) => {
	it.each(locales)("renders in %s with subject, html and plain text", async (locale) => {
		const email = await renderEmail(id, emailTemplates[id].sample, { locale, siteName });

		expect(email.subject.length).toBeGreaterThan(0);
		expect(email.subject).toContain(siteName);
		expect(email.html).toMatch(new RegExp(`<html[^>]*lang="${locale}"`));
		expect(email.text.length).toBeGreaterThan(20);
		// No raw message keys leaked into the output.
		expect(email.html).not.toMatch(/\bemail_[a-z_]+\b/);

		if (locale === "ne") {
			expect(email.subject).toMatch(DEVANAGARI);
			expect(email.text).toMatch(DEVANAGARI);
			expect(email.html).toContain("Noto Sans Devanagari");
		} else {
			expect(email.subject).not.toMatch(DEVANAGARI);
		}
	});
});

describe("template content", () => {
	it("puts the verification link in both the button and the plain text", async () => {
		const email = await renderEmail(
			"verify-email",
			{ name: "Sita", url: "https://app.example/verify?token=abc", expiresInMinutes: 60 },
			{ locale: "ne", siteName },
		);
		expect(email.html).toContain('href="https://app.example/verify?token=abc"');
		expect(email.text).toContain("https://app.example/verify?token=abc");
		expect(email.text).toContain("६०"); // expiry in Devanagari digits
	});

	it("keeps OTP digits in Latin script so they can be typed", async () => {
		const email = await renderEmail("otp-code", { code: "482913", expiresInMinutes: 5 }, { locale: "ne", siteName });
		expect(email.text).toContain("482913");
	});

	it("escapes user-provided values", async () => {
		const email = await renderEmail(
			"welcome",
			{ name: '<img src=x onerror="alert(1)">', url: "https://app.example/account" },
			{ locale: "en", siteName },
		);
		expect(email.html).not.toContain("<img src=x");
		expect(email.html).toContain("&lt;img");
	});
});

describe("sendEmail", () => {
	it("renders in the recipient's locale and hands the result to the provider", async () => {
		vi.stubEnv("VITE_APP_TITLE", "Portfolio");
		const { sendEmail } = await import("@/server/email/send");
		const send = vi.fn<EmailProvider["send"]>().mockResolvedValue({ id: "sent-1" });
		const provider: EmailProvider = { name: "console", send };

		const result = await sendEmail(
			{
				to: "sita@example.com",
				template: "password-reset",
				locale: "ne",
				data: emailTemplates["password-reset"].sample,
			},
			provider,
		);

		expect(result).toEqual({ id: "sent-1" });
		const sent = send.mock.calls[0]?.[0];
		expect(sent).toMatchObject({ to: "sita@example.com", tag: "password-reset" });
		expect(sent?.subject).toMatch(DEVANAGARI);
		expect(sent?.html).toContain('lang="ne"');
	});
});
