/**
 * Optimistic concurrency: two tabs edit the same item; the second save is refused
 * with the "changed by someone else" notice, nothing the first saved is lost, and
 * the refused call's request id is in its x-request-id header and its error.
 */
import type { Page } from "@playwright/test";
import { expect, signedIn, test } from "../support/fixtures.ts";

test.use(signedIn("admin"));

const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

test("the second of two edits from the same version is refused, and no data is lost", async ({ page, context }) => {
	const title = `E2E conflict ${Date.now()}`;
	await open(page, "/admin/test-crud/new");
	await page.getByLabel("Title", { exact: true }).fill(title);
	await page.getByRole("button", { name: "Create", exact: true }).click();
	await expect(page.getByText("Created.", { exact: true })).toBeVisible();
	await open(page, `/admin/test-crud?q=${encodeURIComponent(title)}`);
	await page.getByRole("button", { name: `Actions for ${title}` }).click();
	await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/test-crud\/[0-9a-f-]{36}$/);
	const editUrl = page.url();

	// Both tabs open the same version.
	const other = await context.newPage();
	await open(other, editUrl);
	await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
	await expect(other.getByLabel("Title", { exact: true })).toHaveValue(title);

	// The first tab saves a new title.
	await page.getByLabel("Title", { exact: true }).fill(`${title} first`);
	await page.getByRole("button", { name: "Save changes" }).click();
	await expect(page.getByText("Changes saved.")).toBeVisible();

	// The second tab, still on the old version, is refused.
	await other.getByLabel("Summary").fill("From the second tab");
	// The save is the POST; the slug check also runs on submit, as a GET.
	const refused = other.waitForResponse(
		(response) => response.url().includes("/_serverFn/") && response.request().method() === "POST",
	);
	await other.getByRole("button", { name: "Save changes" }).click();
	const response = await refused;
	const requestId = response.headers()["x-request-id"];
	expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
	const body = await response.text();
	expect(body).toContain("CONFLICT");
	expect(body).toContain(requestId);
	const notice = other.getByTestId("stale-version-alert");
	await expect(notice).toContainText("Changed by someone else");
	await expect(other).toHaveURL(editUrl);

	// Reload brings in the first tab's change; saving again keeps both.
	await notice.getByRole("button", { name: "Reload" }).click();
	await expect(notice).toBeHidden();
	await expect(other.getByLabel("Title", { exact: true })).toHaveValue(`${title} first`);
	await expect(other.getByLabel("Summary")).toHaveValue("");
	await other.getByLabel("Summary").fill("From the second tab");
	await other.getByRole("button", { name: "Save changes" }).click();
	await expect(other.getByText("Changes saved.")).toBeVisible();

	await open(page, editUrl);
	await expect(page.getByLabel("Title", { exact: true })).toHaveValue(`${title} first`);
	await expect(page.getByLabel("Summary")).toHaveValue("From the second tab");
});
