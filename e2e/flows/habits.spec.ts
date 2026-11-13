/**
 * Habits (decision 0193): a guest checks a habit in for today, the cell shows it at once
 * and the streak grows, and the habit's year is drawn. (Expenses moved into Kharcha, 0289.)
 */
import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures.ts";

/** Opens a page and waits until it's hydrated (no requests in flight). */
const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

/** The next server-function POST (a save). */
const nextSave = (page: Page) =>
	page.waitForResponse((response) => response.url().includes("/_serverFn/") && response.request().method() === "POST");

test.beforeEach(async ({ harness }) => {
	await harness.resetRateLimits();
});

test("a guest checks a habit in, and the streak grows", async ({ page }) => {
	await open(page, "/apps/habits");
	await page.getByTestId("try-app").click();
	await expect(page.getByRole("heading", { level: 1, name: "Habits" })).toBeVisible();
	const row = page.getByTestId("habits-row").filter({ hasText: "Read for 20 minutes" });
	await expect(row.getByTestId("habits-streak")).toHaveText("Streak: 9");

	const today = row.getByTestId("habits-checkin").last();
	await expect(today).toHaveAttribute("aria-pressed", "false");
	const saved = nextSave(page);
	await today.click();
	// Shown at once (TanStack DB), then saved; the streak comes back from the server.
	await expect(today).toHaveAttribute("aria-pressed", "true");
	await saved;
	await expect(row.getByTestId("habits-streak")).toHaveText("Streak: 10");

	await row.getByTestId("habits-open").click();
	await expect(page.getByRole("heading", { level: 1, name: "Read for 20 minutes" })).toBeVisible();
	await expect(page.getByTestId("habit-heatmap").locator("rect")).not.toHaveCount(0);
	await expect(page.getByRole("img", { name: /Read for 20 minutes: check-ins over the last year/ })).toBeVisible();
});
