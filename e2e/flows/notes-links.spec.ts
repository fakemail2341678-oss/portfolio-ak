/**
 * Notes and Links (decisions 0190, 0191): a guest writes and searches notes but can't
 * share one; an account shares a note, and the shared page is public and never
 * indexed; a short link redirects and is counted, and a guest's never redirects.
 */
import type { Page } from "@playwright/test";
import { expect, signedIn, test } from "../support/fixtures.ts";

/** Opens a page and waits until it's hydrated (no requests in flight). */
const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

/** The next server-function POST (a save). */
const nextSave = (page: Page) =>
	page.waitForResponse((response) => response.url().includes("/_serverFn/") && response.request().method() === "POST");

/** Makes a short link in the dialog and returns its slug. */
async function createLink(page: Page, target: string, slug: string) {
	await page.getByTestId("links-new").first().click();
	const dialog = page.getByTestId("links-dialog");
	await dialog.getByLabel("Goes to").fill(target);
	await dialog.getByLabel(/Short name/).fill(slug);
	const saved = nextSave(page);
	await dialog.getByRole("button", { name: "Create" }).click();
	await saved;
	await expect(dialog).toBeHidden();
	await expect(page.getByTestId("links-short").filter({ hasText: `/l/${slug}` })).toBeVisible();
}

test.beforeEach(async ({ harness }) => {
	await harness.resetRateLimits();
});

test("a guest writes and searches notes, but can't share one", async ({ page }) => {
	await open(page, "/apps/notes");
	await page.getByTestId("try-app").click();
	await expect(page.getByRole("heading", { level: 1, name: "Your notes" })).toBeVisible();
	await expect(page.getByTestId("notes-open").first()).toHaveText(/Welcome to Notes/);

	await page.getByTestId("notes-new").first().click();
	await expect(page.getByTestId("note-editor")).toBeVisible();
	await page.getByRole("textbox", { name: "Title", exact: true }).fill("Rhododendron walk");
	const saved = nextSave(page);
	await page.getByRole("button", { name: "Save" }).click();
	await saved;
	await expect(page.getByRole("heading", { level: 1, name: "Rhododendron walk" })).toBeVisible();
	await expect(page.getByTestId("note-share")).toContainText("Guests can't share notes");

	await page.getByRole("link", { name: "All notes" }).click();
	await page.getByRole("searchbox", { name: "Search notes" }).fill("rhododendron");
	await expect(page.getByTestId("notes-results")).toHaveText(/Matches for “rhododendron”: 1/);
	await expect(page.getByTestId("notes-open")).toHaveText(["Rhododendron walk"]);
});

test.describe("as an account", () => {
	test.use(signedIn("member"));

	test("a shared note is public, never indexed, and stops when unshared", async ({ page, browser }) => {
		await open(page, "/apps/notes");
		await page.getByTestId("notes-new").first().click();
		await expect(page.getByTestId("note-editor")).toBeVisible();
		await page.getByRole("textbox", { name: "Title", exact: true }).fill("Shared trek list");
		const saved = nextSave(page);
		await page.getByRole("button", { name: "Save" }).click();
		await saved;
		await page.getByTestId("note-share-start").click();
		const url = await page.getByTestId("note-share-url").inputValue();

		const visitor = await browser.newContext();
		const response = await visitor.request.get(url);
		expect(response.status()).toBe(200);
		expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
		expect(await response.text()).toContain("Shared trek list");

		await page.getByRole("button", { name: "Stop sharing" }).click();
		const stopped = nextSave(page);
		await page.getByRole("alertdialog").getByRole("button", { name: "Stop sharing" }).click();
		await stopped;
		expect((await visitor.request.get(url)).status()).toBe(404);
		await visitor.close();
	});

	test("a short link redirects and is counted", async ({ page }) => {
		const slug = `e2e-${Date.now().toString(36)}`;
		await open(page, "/apps/links");
		await createLink(page, "https://example.com/landing", slug);

		const response = await page.request.get(`/l/${slug}`, { maxRedirects: 0 });
		expect(response.status()).toBe(302);
		expect(response.headers().location).toBe("https://example.com/landing");
		expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");

		await page.getByTestId("links-row").filter({ hasText: slug }).getByTestId("links-open").click();
		await expect(page.getByTestId("link-total")).toHaveText("1");
		await expect(page.getByTestId("link-qr")).toBeVisible();
	});
});

test("a guest's short link doesn't redirect anyone", async ({ page }) => {
	await open(page, "/apps/links");
	await page.getByTestId("try-app").click();
	await expect(page.getByTestId("links-guest-note")).toBeVisible();
	const slug = `guest-${Date.now().toString(36)}`;
	await createLink(page, "https://example.com/guest", slug);
	const response = await page.request.get(`/l/${slug}`, { maxRedirects: 0 });
	expect(response.status()).toBe(404);
});
