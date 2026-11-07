/** Lists work before (or without) JavaScript: search is a GET form and pagination is plain links (the URL is the state). */
import { expect, signedIn, test } from "../support/fixtures.ts";

test.use({ javaScriptEnabled: false });

test("public list: search and page through without JavaScript", async ({ page }) => {
	await page.goto("/dev/test-crud");
	await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();

	await page.getByRole("link", { name: "Next" }).click();
	await expect(page).toHaveURL(/[?&]page=2\b/);
	await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible();

	await page.getByRole("searchbox").fill("momo");
	await page.getByRole("searchbox").press("Enter");
	await expect(page).toHaveURL(/[?&]q=momo\b/);
	await expect(page.getByText(/results for “momo”/)).toBeVisible();
	await expect(page.getByRole("heading", { name: /Momo masterclass/ }).first()).toBeVisible();
});

test.describe("admin list", () => {
	test.use(signedIn("admin"));

	test("search and filter without JavaScript", async ({ page }) => {
		await page.goto("/admin/test-crud");
		await page.getByRole("searchbox").fill("tea");
		await page.getByRole("searchbox").press("Enter");
		await expect(page).toHaveURL(/[?&]q=tea\b/);
		const rows = page.getByTestId("test-crud-table").locator("tbody tr");
		await expect(rows.first()).toContainText(/tea/i);
		for (const row of await rows.all()) await expect(row).toContainText(/tea/i);
	});
});
