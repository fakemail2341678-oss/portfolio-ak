/**
 * Expenses and Habits (decisions 0192, 0193): a guest adds an expense and imports a
 * CSV whose bad line is left out; a guest checks a habit in for today, the cell shows
 * it at once and the streak grows, and the habit's year is drawn.
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

test("a guest adds an expense and imports a CSV", async ({ page }) => {
	await open(page, "/apps/expenses");
	await page.getByTestId("try-app").click();
	await expect(page.getByRole("heading", { level: 1, name: "Expenses" })).toBeVisible();
	await expect(page.getByTestId("expenses-row").first()).toBeVisible();

	await page.getByTestId("expenses-add").click();
	const dialog = page.getByTestId("expense-dialog");
	await dialog.getByLabel("Amount").fill("1,250");
	await dialog.getByLabel(/Note/).fill("Trek permit");
	const saved = nextSave(page);
	await dialog.getByRole("button", { name: "Add expense" }).click();
	await saved;
	await expect(dialog).toBeHidden();
	await expect(page.getByTestId("expenses-row").filter({ hasText: "Trek permit" })).toContainText("1,250.00");

	await open(page, "/apps/expenses/import");
	await page
		.getByTestId("import-paste")
		.fill(
			"Date,Amount,Category,Note\n2026-10-01,120,Tea,Imported tea\n2026-10-02,ten,Tea,Bad amount\n2026-10-03,80,,Paper",
		);
	await page.getByTestId("import-paste-read").click();
	await expect(page.getByTestId("import-summary")).toContainText("Ready to import: 2");
	await expect(page.getByTestId("import-summary")).toContainText("With problems: 1");
	await expect(page.getByTestId("import-problems")).toContainText("Line 3:");
	await page.getByTestId("import-submit").click();
	await expect(page).toHaveURL(/\/apps\/expenses$/);
	await expect(page.getByText("Expenses imported: 2. New categories: 1.")).toBeVisible();
	await open(page, "/apps/expenses/categories");
	await expect(page.getByTestId("categories-row").filter({ hasText: "Tea" })).toContainText("Expenses: 1");
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
