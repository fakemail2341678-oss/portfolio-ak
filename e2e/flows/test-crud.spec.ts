/** An admin creates, edits, publishes and deletes a Test CRUD item; the public site follows each step. */
import type { Page } from "@playwright/test";
import { expect, RESOURCE_STATUS, signedIn, test } from "../support/fixtures.ts";

test.use(signedIn("admin"));

const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

/** Opens the row's action menu in the admin list, filtered to this item. */
const rowAction = async (page: Page, title: string, action: string) => {
	await open(page, `/admin/test-crud?q=${encodeURIComponent(title)}`);
	await page.getByRole("button", { name: `Actions for ${title}` }).click();
	await page.getByRole("menuitem", { name: action, exact: true }).click();
};

test("create, edit, publish and delete an item", async ({ page, guard }) => {
	// The deleted item's public page is a 404, which the browser logs.
	guard.allow(RESOURCE_STATUS(404));
	const title = `E2E item ${Date.now()}`;
	const edited = `${title} edited`;

	await open(page, "/admin/test-crud/new");
	await page.getByLabel("Title", { exact: true }).fill(title);
	const slug = await page.getByLabel("Slug").inputValue();
	expect(slug).not.toBe("");
	await page.getByRole("button", { name: "Create", exact: true }).click();
	await expect(page.getByText("Created.", { exact: true })).toBeVisible();
	await expect(page).toHaveURL(/\/admin\/test-crud$/);

	// A draft isn't public.
	expect((await page.request.get(`/dev/test-crud/${slug}`)).status()).toBe(404);

	await rowAction(page, title, "Edit");
	await expect(page.getByRole("heading", { level: 1, name: "Edit item" })).toBeVisible();
	await page.getByLabel("Title", { exact: true }).fill(edited);
	await page.getByRole("button", { name: "Save changes" }).click();
	await expect(page.getByText("Changes saved.")).toBeVisible();

	await rowAction(page, edited, "Publish");
	await expect(page.getByText("Item published.")).toBeVisible();
	await open(page, `/dev/test-crud/${slug}`);
	await expect(page.getByRole("heading", { level: 1, name: edited })).toBeVisible();

	await rowAction(page, edited, "Delete");
	const dialog = page.getByRole("alertdialog");
	await expect(dialog).toContainText(edited);
	await dialog.getByRole("button", { name: "Delete" }).click();
	await expect(page.getByText(`“${edited}” deleted.`)).toBeVisible();
	const gone = await page.goto(`/dev/test-crud/${slug}`);
	expect(gone?.status()).toBe(404);
});
