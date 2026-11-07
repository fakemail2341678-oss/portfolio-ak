/** Two-factor authentication, the data export and account deletion, through the account page and the emails. */
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, RESOURCE_STATUS, test } from "../support/fixtures.ts";
import { totp } from "../support/totp.ts";
import { createVerifiedUser, linkIn } from "../support/users.ts";

const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

/** Email and password; stops at the account page or at the two-factor step. */
const enterPassword = async (page: Page, email: string, password: string) => {
	await open(page, "/login?redirect=/account");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(password);
	await page.getByRole("button", { name: "Log in" }).click();
};

const atAccount = async (page: Page) => {
	await expect(page).toHaveURL(/\/account$/);
	await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
};

test.beforeEach(async ({ harness }) => {
	await harness.resetRateLimits();
});

test("turn on two-factor, then log in with an app code and with a backup code", async ({
	page,
	context,
	harness,
	guard,
}) => {
	// Refused email-code sign-in answers 403, which the browser logs.
	guard.allow(RESOURCE_STATUS(403));
	const user = await createVerifiedUser(harness, "2fa");
	await enterPassword(page, user.email, user.password);
	await atAccount(page);

	const section = page.locator("#two-factor");
	await section.getByLabel("Current password").fill(user.password);
	await section.getByRole("button", { name: "Set up two-factor authentication" }).click();
	const secret = (await section.getByTestId("2fa-secret").textContent())?.trim() ?? "";
	expect(secret).toMatch(/^[A-Z2-7]+=*$/);
	await section.getByLabel("6-digit code").fill(totp(secret));
	await section.getByRole("button", { name: "Turn on" }).click();
	const codeList = section.getByTestId("2fa-backup-codes").locator("li");
	await expect(codeList).toHaveCount(10);
	const backupCodes = (await codeList.allTextContents()).map((code) => code.trim());
	await section.getByRole("button", { name: "I've saved them" }).click();
	await expect(section.getByText("Two-factor authentication is set up.")).toBeVisible();
	const notice = await harness.nextEmail(user.email, "security-notice");
	expect(notice.text).toContain("Two-factor authentication was turned on");

	// Password sign-in now asks for a code from the app.
	await context.clearCookies();
	await enterPassword(page, user.email, user.password);
	await expect(page.getByText("Enter the 6-digit code from your authenticator app.")).toBeVisible();
	await page.getByLabel("6-digit code").fill(totp(secret));
	await page.getByRole("button", { name: "Sign in" }).click();
	await atAccount(page);

	// A backup code works once.
	await context.clearCookies();
	await enterPassword(page, user.email, user.password);
	await page.getByRole("button", { name: "Use a backup code instead" }).click();
	await page.getByLabel("Backup code").fill(backupCodes[0] ?? "");
	await page.getByRole("button", { name: "Sign in" }).click();
	await atAccount(page);

	// An emailed code doesn't get around the second factor.
	await context.clearCookies();
	await open(page, "/sign-in-code");
	await page.getByLabel("Email").fill(user.email);
	await page.getByRole("button", { name: "Send code" }).click();
	const codeEmail = await harness.nextEmail(user.email, "otp-code");
	await page.getByLabel("6-digit code").fill(/\b\d{6}\b/.exec(codeEmail.text)?.[0] ?? "");
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByText("This account uses two-factor authentication.")).toBeVisible();
	await expect(page).toHaveURL(/\/sign-in-code/);
});

test("download your data as JSON", async ({ page, harness }) => {
	const user = await createVerifiedUser(harness, "export");
	await enterPassword(page, user.email, user.password);
	await atAccount(page);

	const download = page.waitForEvent("download");
	await page.getByTestId("account-export").click();
	const file = await download;
	expect(file.suggestedFilename()).toMatch(/^account-\d{4}-\d{2}-\d{2}\.json$/);
	const data = JSON.parse(await readFile(await file.path(), "utf8"));
	expect(data.profile.email).toBe(user.email);
	expect(data.signInMethods).toEqual([expect.objectContaining({ providerId: "credential" })]);
	expect(JSON.stringify(data)).not.toMatch(/"password"|"token"|"secret"/);

	// Signed out, the export answers 401.
	const anonymous = await fetch(new URL("/api/account/export", page.url()));
	expect(anonymous.status).toBe(401);
});

test("delete the account through the emailed link", async ({ page, context, harness, guard }) => {
	// The sign-in attempt after deletion is refused with a 401.
	guard.allow(RESOURCE_STATUS(401));
	const user = await createVerifiedUser(harness, "delete");
	await enterPassword(page, user.email, user.password);
	await atAccount(page);

	await page.getByRole("button", { name: "Email me a deletion link" }).click();
	await expect(page.getByText(`Check ${user.email} and open the link to delete your account.`)).toBeVisible();
	const email = await harness.nextEmail(user.email, "delete-account");
	await open(page, linkIn(email.text));
	await expect(page).toHaveURL(/\/account\/delete\?token=/);
	await page.getByRole("button", { name: "Delete my account" }).click();
	await expect(page.getByText("Your account was deleted.")).toBeVisible();
	await expect(page).not.toHaveURL(/\/account/);
	await harness.nextEmail(user.email, "account-deleted");

	await context.clearCookies();
	await enterPassword(page, user.email, user.password);
	await expect(page.getByText("Incorrect email or password.")).toBeVisible();
});
