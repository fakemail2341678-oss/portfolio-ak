/**
 * The showcase apps (decisions 0185–0187): a guest reaches no account or admin page.
 * Keeping a guest's work on signing up or in (the emailed link, two-factor and the
 * claim cookie) is checked on Taskline's sandbox, in e2e/flows/taskline.spec.ts.
 */
import type { Page } from "@playwright/test";
import { expect, RESOURCE_STATUS, test } from "../support/fixtures.ts";

/** Opens a page and waits until it's hydrated (no requests in flight). */
const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

test.beforeEach(async ({ harness }) => {
	await harness.resetRateLimits();
});

test("a guest can't enter the admin area or change an account", async ({ page, guard }) => {
	await open(page, "/apps/notes");
	await page.getByTestId("try-app").click();
	await expect(page.getByRole("heading", { level: 1, name: "Your notes" })).toBeVisible();
	await expect(page.getByTestId("guest-banner")).toBeVisible();
	await open(page, "/admin");
	await expect(page).toHaveURL(/\/login\?redirect=/);
	// No account pages for a guest.
	await open(page, "/account");
	await expect(page).toHaveURL(/\/upgrade\?redirect=/);
	await expect(page.getByRole("heading", { level: 1, name: "Keep what you made" })).toBeVisible();
	// Better Auth refuses account changes from a guest session.
	guard.allow(RESOURCE_STATUS(403));
	const refused = await page.evaluate(async () => {
		const response = await fetch("/api/auth/change-email", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ newEmail: "someone@example.com" }),
		});
		return { status: response.status, body: await response.text() };
	});
	expect(refused.status).toBe(403);
	expect(refused.body).toContain("GUEST_ACCOUNT");
});
