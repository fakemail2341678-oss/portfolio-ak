/**
 * The portfolio from the database (decision 0176): an admin creates, publishes and
 * reorders a project and it appears on `/`; a draft shows only in a preview; the
 * contact form reaches the admin inbox and the owner's email.
 */
import type { Page } from "@playwright/test";
import { E2E } from "../harness/config.ts";
import { expect, RESOURCE_STATUS, signedIn, signInState, test } from "../support/fixtures.ts";

const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });
/** A request without anyone's session. */
const anonymousStatus = async (path: string) => (await fetch(new URL(path, E2E.baseURL))).status;

/** Fills the project form's required fields. */
async function fillProject(page: Page, title: string, { published }: { published: boolean }) {
	await open(page, "/admin/portfolio/projects/new");
	await page.getByLabel("Project name", { exact: true }).fill(title);
	await expect(page.getByLabel("Address", { exact: true })).not.toHaveValue("");
	await page.getByLabel("Client (English)", { exact: true }).fill("E2E Client");
	await page.getByRole("checkbox", { name: "Product" }).check();
	await page.getByLabel("Role (English)", { exact: true }).fill("Lead engineer");
	await page.getByLabel("Duration (English)", { exact: true }).fill("Three months");
	await page.getByLabel("Summary (English)", { exact: true }).fill("A project made by the end-to-end tests.");
	await page.getByLabel("Glyph", { exact: true }).fill("E2");
	if (published) {
		await page.getByRole("radio", { name: "Published" }).check();
		await page.getByRole("switch", { name: "Featured on the home page" }).click();
	}
	const slug = await page.getByLabel("Address", { exact: true }).inputValue();
	await page.getByRole("button", { name: "Create", exact: true }).click();
	await expect(page.getByText("Created.", { exact: true })).toBeVisible();
	await expect(page).toHaveURL(/\/admin\/portfolio\/projects$/);
	return slug;
}

test.describe("as an admin", () => {
	test.use(signedIn("admin"));

	test("create, publish and reorder a project; it appears on /", async ({ page }) => {
		const title = `Atlas ${Date.now()}`;
		const slug = await fillProject(page, title, { published: true });

		// Published: its page is public at once, last in the work index.
		expect(await anonymousStatus(`/work/${slug}`)).toBe(200);

		// Move it to the top: the handle, then Alt + ↑ until it is first.
		await page.getByRole("button", { name: "Reorder" }).click();
		const dialog = page.getByTestId("reorder-dialog");
		const handle = dialog.getByRole("button", { name: `Move ${title}` });
		await expect(handle).toBeVisible();
		const count = await dialog.getByRole("listitem").count();
		await handle.focus();
		for (let step = 1; step < count; step++) await page.keyboard.press("Alt+ArrowUp");
		await expect(dialog.getByRole("listitem").first()).toContainText(title);
		await dialog.getByRole("button", { name: "Save changes" }).click();
		await expect(page.getByText("New order saved.")).toBeVisible();

		// The home page features it first; the work index lists it first.
		await open(page, "/");
		await expect(page.getByRole("heading", { name: title }).first()).toBeVisible();
		await open(page, "/work");
		const firstRow = page.locator("main ul").last().locator("li").first();
		await expect(firstRow).toContainText(title);
	});

	test("a draft is visible only in a preview", async ({ page, guard }) => {
		// The draft's public page is a 404 without the preview.
		guard.allow(RESOURCE_STATUS(404));
		const title = `Draft ${Date.now()}`;
		const slug = await fillProject(page, title, { published: false });

		expect(await anonymousStatus(`/work/${slug}`)).toBe(404);
		expect(await anonymousStatus(`/work/${slug}?preview=1`)).toBe(404);
		const gone = await page.goto(`/work/${slug}`);
		expect(gone?.status()).toBe(404);

		await open(page, `/work/${slug}?preview=1`);
		await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
		await expect(page.getByText("Draft preview: visitors can't see this page yet.")).toBeVisible();
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
	});
});

test("the contact form reaches the inbox and the owner's email", async ({ page, harness, browser }) => {
	await harness.resetRateLimits();
	const name = `Visitor ${Date.now()}`;
	await open(page, "/contact");
	await page.getByLabel("Your name").fill(name);
	await page.getByLabel("Your email").fill("visitor@example.com");
	await page.getByLabel("What are you working on?").fill("A bilingual booking site for a trekking agency.");
	await page.getByRole("button", { name: "Send message" }).click();
	await expect(page.getByText("Thank you. Your message is in")).toBeVisible();

	const email = await harness.nextEmail("hello@example.com", "contact-message");
	expect(email.subject).toContain(name);

	const admin = await browser.newContext({ storageState: await signInState("admin") });
	const inbox = await admin.newPage();
	await inbox.goto(`/admin/portfolio/messages?q=${encodeURIComponent(name)}`, { waitUntil: "networkidle" });
	await expect(inbox.getByTestId("messages-table")).toContainText(name);
	await admin.close();
});
