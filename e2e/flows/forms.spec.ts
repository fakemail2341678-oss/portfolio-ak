/**
 * Forms (decision 0195): a guest gets the sample survey with its results and builds
 * on it but can't publish; an account builds a form, publishes it, someone without an
 * account fills it in at its link (never indexed), and the response appears in the
 * results.
 */
import type { Page } from "@playwright/test";
import { expect, signedIn, test } from "../support/fixtures.ts";

/** Opens a page and waits until it's hydrated (no requests in flight). */
const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

/** The next server-function POST (a save). */
const nextSave = (page: Page) =>
	page.waitForResponse((response) => response.url().includes("/_serverFn/") && response.request().method() === "POST");

test.beforeEach(async ({ harness }) => {
	await harness.resetRateLimits();
});

test("a guest gets a sample survey with results, builds on it, but can't publish", async ({ page }) => {
	await open(page, "/apps/forms");
	await page.getByTestId("try-app").click();
	await expect(page.getByRole("heading", { level: 1, name: "Your forms" })).toBeVisible();
	const card = page.getByTestId("forms-card").filter({ hasText: "Café feedback" });
	await expect(card).toContainText("12 responses");

	await card.getByRole("link", { name: "Edit" }).click();
	await expect(page.getByTestId("forms-builder")).toBeVisible();
	await expect(page.getByTestId("forms-publish")).toBeDisabled();
	// Added from the keyboard: the palette entry's button, then Enter.
	await page.getByTestId("forms-add-date").focus();
	await page.keyboard.press("Enter");
	await expect(page.getByTestId("forms-field")).toHaveCount(6);
	await expect(page.getByTestId("forms-unsaved")).toBeVisible();
	const saved = nextSave(page);
	await page.getByTestId("forms-save").click();
	await saved;
	await expect(page.getByTestId("forms-unsaved")).toBeHidden();

	await page.getByRole("link", { name: "Results" }).click();
	await expect(page.getByTestId("forms-results")).toBeVisible();
	await expect(page.getByTestId("forms-rating-average")).toContainText("4");
	await expect(page.getByTestId("forms-responses").getByRole("row")).toHaveCount(13);
});

test.describe("as an account", () => {
	test.use(signedIn("member"));

	test("a published form is filled in and the response appears in the results", async ({ page, browser }) => {
		await open(page, "/apps/forms");
		await page.getByTestId("forms-new").first().click();
		const dialog = page.getByTestId("forms-new-dialog");
		await dialog.getByLabel("Title").fill("Trail survey");
		await dialog.getByRole("button", { name: "Create" }).click();
		await expect(page.getByTestId("forms-builder")).toBeVisible();

		await page.getByTestId("forms-add-rating").click();
		await page.getByTestId("forms-add-short_text").click();
		const label = page.getByTestId("forms-setting-label");
		await label.fill("Your trail name");
		await page.getByRole("switch", { name: "Required" }).click();

		// The preview shows the draft as respondents will see it.
		await page.getByTestId("forms-preview-tab").click();
		await expect(page.getByTestId("forms-preview").getByLabel(/Your trail name/)).toBeVisible();
		await page.getByRole("tab", { name: "Build" }).click();

		const saved = nextSave(page);
		await page.getByTestId("forms-publish").click();
		await saved;
		const link = page.getByTestId("forms-public-link");
		await expect(link).toBeVisible();
		const path = new URL((await link.textContent()) ?? "").pathname;
		expect(path).toMatch(/^\/f\/[a-z0-9]{10}$/);

		const visitor = await browser.newContext();
		const respondent = await visitor.newPage();
		const response = await respondent.goto(path, { waitUntil: "networkidle" });
		expect(response?.status()).toBe(200);
		expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
		await expect(respondent.getByRole("heading", { level: 1, name: "Trail survey" })).toBeVisible();
		// Sending it empty shows what's missing; nothing is sent.
		await respondent.getByRole("button", { name: "Send" }).click();
		await expect(respondent.getByLabel(/Your trail name/)).toHaveAttribute("aria-invalid", "true");
		// The radio is hidden inside its label (the star): click what people click.
		await respondent.getByRole("radio", { name: /^4/ }).locator("..").click();
		await respondent.getByLabel(/Your trail name/).fill("Poon Hill");
		await respondent.getByRole("button", { name: "Send" }).click();
		await expect(respondent.getByTestId("form-sent")).toContainText("Thank you");
		await visitor.close();

		await page.getByRole("link", { name: "Results" }).click();
		await expect(page.getByTestId("forms-results")).toBeVisible();
		await expect(page.getByTestId("forms-responses")).toContainText("Poon Hill");
		await expect(page.getByTestId("forms-rating-average")).toContainText("4");

		// Taken down, the link is a 404.
		await page.getByRole("link", { name: "Back to the form" }).click();
		const down = nextSave(page);
		await page.getByRole("button", { name: "Take down" }).click();
		await down;
		const after = await browser.newContext();
		expect((await after.request.get(path)).status()).toBe(404);
		await after.close();
	});
});
