/** Permissions end to end: a refused page is a 403, and the matrix grants and revokes access from the next request. */
import type { Browser, Page } from "@playwright/test";
import { expect, type PageGuard, RESOURCE_STATUS, signedIn, signInState, test } from "../support/fixtures.ts";

const VIEWER_CREATE = "Viewer: Create items";

const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

/** The viewer opens the new-item page in their own browser context (watched by the guard); returns the HTTP status. */
const viewerOpensNewItem = async (browser: Browser, guard: PageGuard) => {
	const context = await browser.newContext({ storageState: await signInState("viewer") });
	const page = await context.newPage();
	guard.watch(page);
	const response = await page.goto("/admin/test-crud/new", { waitUntil: "networkidle" });
	const status = response?.status();
	if (status === 403) await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
	else await expect(page.getByRole("heading", { level: 1, name: "New item" })).toBeVisible();
	await context.close();
	return status;
};

test.describe("as the viewer (read-only role)", () => {
	test.use(signedIn("viewer"));

	test("a page that needs a missing permission is a 403", async ({ page, guard }) => {
		guard.allow(RESOURCE_STATUS(403));
		const response = await page.goto("/admin/test-crud/new", { waitUntil: "networkidle" });
		expect(response?.status()).toBe(403);
		await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
	});

	test("actions the role lacks aren't offered", async ({ page }) => {
		await open(page, "/admin/test-crud");
		await expect(page.getByTestId("test-crud-table")).toBeVisible();
		await expect(page.getByRole("link", { name: "New item" })).toHaveCount(0);
		await expect(page.getByRole("button", { name: /^Actions for / })).toHaveCount(0);
	});
});

test.describe("as an admin", () => {
	test.use(signedIn("admin"));

	test("grant a permission in the matrix, then revoke it", async ({ page, browser, guard }) => {
		// The viewer's refused page logs the browser's 403 line.
		guard.allow(RESOURCE_STATUS(403));
		await open(page, "/admin/roles/permissions");
		const toggle = page.getByRole("checkbox", { name: VIEWER_CREATE });
		await expect(toggle).not.toBeChecked();
		expect(await viewerOpensNewItem(browser, guard)).toBe(403);

		await toggle.click();
		await expect(toggle).toBeChecked();
		// Saved on the server: still ticked after a reload.
		await open(page, "/admin/roles/permissions");
		await expect(page.getByRole("checkbox", { name: VIEWER_CREATE })).toBeChecked();
		expect(await viewerOpensNewItem(browser, guard)).toBe(200);

		await page.getByRole("checkbox", { name: VIEWER_CREATE }).click();
		await expect(page.getByRole("checkbox", { name: VIEWER_CREATE })).not.toBeChecked();
		await open(page, "/admin/roles/permissions");
		await expect(page.getByRole("checkbox", { name: VIEWER_CREATE })).not.toBeChecked();
		expect(await viewerOpensNewItem(browser, guard)).toBe(403);
	});
});
