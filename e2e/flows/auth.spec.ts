/** Signing up, verifying, signing in (password and code) and resetting a password, through the real forms and emails. */
import type { Page } from "@playwright/test";
import { E2E } from "../harness/config.ts";
import { expect, RESOURCE_STATUS, test } from "../support/fixtures.ts";
import { createVerifiedUser, linkIn, uniqueEmail } from "../support/users.ts";

/** Opens a page and waits until it's hydrated (no requests in flight), so forms are handled in JavaScript. */
const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

const logIn = async (page: Page, email: string, password: string) => {
	await open(page, "/login?redirect=/account");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(password);
	await page.getByRole("button", { name: "Log in" }).click();
	await expect(page).toHaveURL(/\/account$/);
	await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
};

test.beforeEach(async ({ harness }) => {
	await harness.resetRateLimits();
});

test("sign up, verify the email, then log in", async ({ page, context, harness }) => {
	const email = uniqueEmail("signup");
	await open(page, "/register");
	await page.getByLabel("Name").fill("New Person");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(E2E.password);
	await page.getByLabel("Confirm password").fill(E2E.password);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

	const verification = await harness.nextEmail(email, "verify-email");
	await page.goto(linkIn(verification.text));
	await expect(page).toHaveURL(/\/verify-email/);
	await expect(page.getByText("Your email is verified and you're signed in.")).toBeVisible();
	await harness.nextEmail(email, "welcome");

	await context.clearCookies();
	await logIn(page, email, E2E.password);
});

test("an unverified account can't log in", async ({ page, harness, guard }) => {
	// Better Auth answers the refused sign-in with a 403, which the browser logs.
	guard.allow(RESOURCE_STATUS(403));
	const email = uniqueEmail("unverified");
	await open(page, "/register");
	await page.getByLabel("Name").fill("Not Yet");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(E2E.password);
	await page.getByLabel("Confirm password").fill(E2E.password);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

	await open(page, "/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(E2E.password);
	await page.getByRole("button", { name: "Log in" }).click();
	await expect(page.getByText("Verify your email before logging in.")).toBeVisible();
	// The sign-in attempt sent a second link.
	await harness.nextEmail(email, "verify-email", 1);
});

test("log in with an emailed code", async ({ page, harness }) => {
	const user = await createVerifiedUser(harness, "otp");
	await open(page, "/sign-in-code");
	await page.getByLabel("Email").fill(user.email);
	await page.getByRole("button", { name: "Send code" }).click();
	const email = await harness.nextEmail(user.email, "otp-code");
	const code = /\b\d{6}\b/.exec(email.text)?.[0] ?? "";
	await page.getByLabel("6-digit code").fill(code);
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page).toHaveURL(/\/account$/);
	await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
});

test("reset a forgotten password", async ({ page, harness }) => {
	const user = await createVerifiedUser(harness, "reset");
	const newPassword = "a-brand-new-password";
	await open(page, "/forgot-password");
	await page.getByLabel("Email").fill(user.email);
	await page.getByRole("button", { name: "Send reset link" }).click();
	await expect(page.getByText(`If an account exists for ${user.email}`)).toBeVisible();

	const email = await harness.nextEmail(user.email, "password-reset");
	await page.goto(linkIn(email.text), { waitUntil: "networkidle" });
	await expect(page).toHaveURL(/\/reset-password\?token=/);
	await page.getByLabel("New password").fill(newPassword);
	await page.getByLabel("Confirm password").fill(newPassword);
	await page.getByRole("button", { name: "Reset password" }).click();
	await expect(page.getByText("Your password was reset.")).toBeVisible();

	await logIn(page, user.email, newPassword);
});
