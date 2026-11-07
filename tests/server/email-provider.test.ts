import { describe, expect, it, vi } from "vitest";
import { EmailConfigError, selectEmailProvider } from "@/server/email/config";
import { ConsoleProvider } from "@/server/email/providers/console";
import { type ResendClient, ResendDeliveryError, ResendProvider } from "@/server/email/providers/resend";
import type { EmailMessage } from "@/server/email/types";

// src/server/email/config.ts imports the server env, which validates on import.
vi.hoisted(() => {
	process.env.DATABASE_URL = "postgres://u:p@localhost/db";
	process.env.EMAIL_FROM = "Portfolio <hello@example.com>";
});

const message: EmailMessage = { to: "sita@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi", tag: "welcome" };

describe("selectEmailProvider", () => {
	describe("development", () => {
		const dev = { isProduction: false };

		it("uses the console provider when nothing is configured", () => {
			expect(selectEmailProvider(dev)).toEqual({ kind: "console" });
		});

		it("uses Resend as soon as an API key is configured", () => {
			expect(selectEmailProvider({ ...dev, RESEND_API_KEY: "re_dev" })).toEqual({ kind: "resend", apiKey: "re_dev" });
		});

		it("honours an explicit console choice even with a key", () => {
			expect(selectEmailProvider({ ...dev, EMAIL_PROVIDER: "console", RESEND_API_KEY: "re_dev" })).toEqual({
				kind: "console",
			});
		});
	});

	describe("production with Resend", () => {
		it("uses Resend when the key is set", () => {
			expect(selectEmailProvider({ isProduction: true, RESEND_API_KEY: "re_live" })).toEqual({
				kind: "resend",
				apiKey: "re_live",
			});
		});

		it("uses Resend when explicitly selected", () => {
			expect(selectEmailProvider({ isProduction: true, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_live" })).toEqual({
				kind: "resend",
				apiKey: "re_live",
			});
		});
	});

	describe("misconfigured production", () => {
		it("fails clearly when no provider is configured", () => {
			expect(() => selectEmailProvider({ isProduction: true })).toThrow(EmailConfigError);
			expect(() => selectEmailProvider({ isProduction: true })).toThrow(
				/No email provider is configured for production/,
			);
		});

		it("refuses the console provider, which would drop every email", () => {
			expect(() => selectEmailProvider({ isProduction: true, EMAIL_PROVIDER: "console" })).toThrow(
				/'console' in production/,
			);
		});

		it("fails when Resend is selected without a key", () => {
			expect(() => selectEmailProvider({ isProduction: true, EMAIL_PROVIDER: "resend" })).toThrow(/RESEND_API_KEY/);
		});
	});
});

describe("ConsoleProvider", () => {
	it("prints the email instead of sending it", async () => {
		const lines: string[] = [];
		const result = await new ConsoleProvider("Portfolio <hello@example.com>", (line) => lines.push(line)).send(message);
		expect(result.id).toMatch(/^console-/);
		expect(lines.join("\n")).toContain("To:      sita@example.com");
		expect(lines.join("\n")).toContain("Subject: Hi");
	});
});

describe("ResendProvider", () => {
	const fakeClient = (response: Awaited<ReturnType<ResendClient["emails"]["send"]>>) => {
		const send = vi.fn().mockResolvedValue(response);
		return { client: { emails: { send } } as unknown as ResendClient, send };
	};

	it("sends from EMAIL_FROM with html, text and a template tag", async () => {
		const { client, send } = fakeClient({ data: { id: "email_123" }, error: null, headers: null });
		const result = await new ResendProvider("re_test", "Portfolio <hello@example.com>", client).send(message);
		expect(result).toEqual({ id: "email_123" });
		expect(send).toHaveBeenCalledWith({
			from: "Portfolio <hello@example.com>",
			to: "sita@example.com",
			subject: "Hi",
			html: "<p>Hi</p>",
			text: "Hi",
			tags: [{ name: "template", value: "welcome" }],
		});
	});

	it("turns Resend's error value into a thrown error", async () => {
		const { client } = fakeClient({
			data: null,
			error: { name: "validation_error", message: "Invalid from", statusCode: 422 },
			headers: null,
		});
		await expect(new ResendProvider("re_test", "bad", client).send(message)).rejects.toBeInstanceOf(
			ResendDeliveryError,
		);
	});
});
