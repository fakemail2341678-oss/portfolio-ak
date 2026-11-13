/**
 * Kharcha (decisions 0277 and 0282, Task 88): a visitor tries it from the landing as a
 * guest with sample data, goes through onboarding (which never comes back) and sees Home
 * with the sample's balances and recent activity in its frame; the + menu adds a friend,
 * who shows in Recent. A demo account signs in on Kharcha's own page and lands on Home,
 * the palette opens with the keyboard, and sign-out returns to the landing. A signed-out
 * visitor is sent from Home to sign-in, and an unknown address is a 404 in the shell.
 */
import type { Page } from "@playwright/test";
import { E2E } from "../harness/config.ts";
import { expect, RESOURCE_STATUS, test } from "../support/fixtures.ts";

/** Opens a page and waits until it's hydrated (no requests in flight). */
const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

test.describe("Kharcha", () => {
	test("a visitor tries it as a guest, is onboarded once, and adds a friend", async ({ page, harness }) => {
		await harness.resetRateLimits();
		await open(page, "/app/kharcha");
		await expect(page.getByTestId("kharcha-landing")).toBeVisible();
		await page.getByTestId("kharcha-try").click();
		await expect(page).toHaveURL(/\/app\/kharcha\/home$/);
		await expect(page.getByTestId("guest-banner")).toBeVisible();
		// No other section's chrome; Kharcha's own on <html>.
		await expect(page.getByTestId("app-switcher")).toHaveCount(0);
		await expect(page.locator("html")).toHaveAttribute("data-section", "kharcha");

		// Onboarding: what they came for decides what Home shows first.
		const onboarding = page.getByTestId("kharcha-onboarding");
		await expect(onboarding).toBeVisible();
		await onboarding.getByRole("radio", { name: /Split with people/ }).check();
		await onboarding.getByRole("button", { name: "Start" }).click();
		await expect(onboarding).toHaveCount(0);
		const summary = page.getByTestId("kharcha-home-summary");
		await expect(summary.locator("> *").first()).not.toHaveAttribute("data-testid", "kharcha-home-month");
		await expect(page.getByTestId("kharcha-home-owed")).toContainText("NPR");
		await expect(page.getByTestId("kharcha-home-recent")).toContainText("You added");

		// It never comes back.
		await page.reload({ waitUntil: "networkidle" });
		await expect(page.getByTestId("kharcha-home")).toBeVisible();
		await expect(onboarding).toHaveCount(0);

		// The + menu (the floating + on a phone, the New button here) adds a friend by name.
		await page.getByTestId("kharcha-new").click();
		await page.getByTestId("kharcha-create-friend").click();
		const dialog = page.getByTestId("kharcha-friend-dialog");
		await dialog.getByRole("textbox", { name: "Name" }).fill("Pemba");
		await dialog.getByRole("button", { name: "Add friend" }).click();
		await expect(dialog).toBeHidden();
		await expect(page.getByTestId("kharcha-home-recent")).toContainText("You added Pemba as a friend");
	});

	test("a guest adds an expense with a receipt, finds it on Spend and opens it (Task 89)", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		await open(page, "/app/kharcha");
		await page.getByTestId("kharcha-try").click();
		await expect(page).toHaveURL(/\/app\/kharcha\/home$/);
		await page.getByTestId("kharcha-onboarding").getByRole("button", { name: "Skip" }).click();

		// The + menu's Add expense: the sample's merchant rule fills the category from the merchant.
		await page.getByTestId("kharcha-new").click();
		await page.getByTestId("kharcha-create-expense").click();
		const dialog = page.getByTestId("kharcha-expense-dialog");
		await dialog.getByRole("textbox", { name: "Amount" }).fill("१,२५०.५०");
		await dialog.getByRole("combobox", { name: "Merchant" }).fill("Bhatbhateni Supermarket");
		await expect(dialog.getByRole("combobox", { name: "Category" })).toHaveText("Groceries");
		await dialog.getByRole("textbox", { name: "Title" }).fill("Rice and lentils");
		await dialog.getByTestId("kharcha-receipt-input").setInputFiles({
			name: "receipt.png",
			mimeType: "image/png",
			buffer: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
				"base64",
			),
		});
		await expect(dialog.getByRole("button", { name: "Open receipt 1" })).toBeVisible();
		await dialog.getByRole("button", { name: "Add expense" }).click();
		await expect(dialog).toBeHidden();

		// Spend: this month, newest first, with its receipt; the row opens the panel over the list.
		await page.getByTestId("kharcha-rail").getByRole("link", { name: "Spend" }).click();
		await expect(page).toHaveURL(/\/app\/kharcha\/spend$/);
		const row = page.getByTestId("kharcha-spend-row").first();
		await expect(row).toContainText("Rice and lentils");
		await expect(row).toContainText("1,250.50");
		await row.getByRole("link", { name: "Rice and lentils" }).click();
		const panel = page.getByTestId("kharcha-expense-sheet");
		await expect(panel).toBeVisible();
		// The address bar shows the expense's own page (a masked route).
		await expect(page).toHaveURL(/\/app\/kharcha\/e\/[0-9a-f-]{36}$/);
		await expect(panel).toContainText("Groceries");
		await expect(panel).toContainText("You added it");
		await panel.getByRole("button", { name: "Open receipt 1" }).click();
		await expect(page.getByTestId("kharcha-receipt-viewer")).toBeVisible();
		await page.keyboard.press("Escape");

		// A reload gives the page itself.
		await page.reload({ waitUntil: "networkidle" });
		await expect(page.getByTestId("kharcha-expense-page")).toContainText("Rice and lentils");
	});

	test("a guest splits a bill in their group, from the keyboard where it counts (Task 90)", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		await open(page, "/app/kharcha");
		await page.getByTestId("kharcha-try").click();
		await expect(page).toHaveURL(/\/app\/kharcha\/home$/);
		await page.getByTestId("kharcha-onboarding").getByRole("button", { name: "Skip" }).click();

		// People: the sample's groups and friends, each with its balance; the trip opens its thread.
		await page.getByTestId("kharcha-rail").getByRole("link", { name: "People" }).click();
		await expect(page).toHaveURL(/\/app\/kharcha\/people$/);
		await page.getByTestId("kharcha-people-group").filter({ hasText: "Pokhara" }).click();
		await expect(page).toHaveURL(/\/app\/kharcha\/g\/[0-9a-f-]{36}$/);
		await expect(page.getByTestId("kharcha-thread")).toBeVisible();

		// Add expense in the group: split with its members, equally to start with.
		await page.getByTestId("kharcha-group-add").click();
		const dialog = page.getByTestId("kharcha-expense-dialog");
		const editor = dialog.getByTestId("kharcha-split-editor");
		await expect(editor).toBeVisible();
		await dialog.getByRole("textbox", { name: "Amount" }).fill("3000");
		await dialog.getByRole("textbox", { name: "Title" }).fill("Paragliding");
		const status = editor.getByTestId("kharcha-split-status");
		await expect(status).toContainText("You paid NPR 3,000.00");
		await expect(status).toContainText("owes you NPR 1,000.00");

		// Exact amounts, chosen with the arrow keys; the remainder is said live.
		await editor.getByRole("radio", { name: "Equally" }).focus();
		await page.keyboard.press("ArrowRight");
		await expect(editor.getByRole("radio", { name: "Amounts" })).toBeChecked();
		const amounts = editor.getByTestId("kharcha-split-exact");
		await expect(amounts).toHaveCount(3);
		await amounts.nth(0).fill("1000");
		await amounts.nth(1).fill("1500");
		await expect(status).toContainText("NPR 500.00 left to assign");
		await amounts.nth(2).fill("500");
		await expect(status).toContainText("owes you NPR 1,500.00");
		await expect(status).toHaveAttribute("data-ok", "true");
		await dialog.getByRole("button", { name: "Add expense" }).click();
		await expect(dialog).toBeHidden();

		// On the group's page: its card, with what the guest lent.
		const thread = page.getByTestId("kharcha-thread");
		await expect(thread).toContainText("Paragliding");
		await expect(thread).toContainText("you lent");
	});

	test("a guest settles up in their group, partly, then edits and deletes the payment (Task 91)", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		await open(page, "/app/kharcha");
		await page.getByTestId("kharcha-try").click();
		await expect(page).toHaveURL(/\/app\/kharcha\/home$/);
		await page.getByTestId("kharcha-onboarding").getByRole("button", { name: "Skip" }).click();
		await page.getByTestId("kharcha-rail").getByRole("link", { name: "People" }).click();
		await page.getByTestId("kharcha-people-group").filter({ hasText: "Pokhara" }).click();
		await expect(page.getByTestId("kharcha-thread")).toBeVisible();

		// Balances: each member's net, and the payments that would settle the trip.
		await page.getByTestId("kharcha-group-tab-balances").click();
		await expect(page).toHaveURL(/\?tab=balances$/);
		await expect(page.getByTestId("kharcha-balance-member").first()).toBeVisible();
		const transfer = page.getByTestId("kharcha-balance-transfer").first();
		await transfer.getByTestId("kharcha-balance-settle").click();

		// The suggestion is picked; a smaller amount is a partial payment, said in words.
		const dialog = page.getByTestId("kharcha-settle-dialog");
		await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(1);
		await dialog.getByRole("textbox", { name: "Amount" }).fill("100");
		await expect(dialog).toContainText("A partial payment");
		await dialog.getByRole("combobox", { name: /Paid with/ }).fill("Cash");
		await dialog.getByRole("button", { name: "Record payment" }).click();
		await expect(dialog).toBeHidden();
		await expect(page.getByText("Payment recorded.")).toBeVisible();

		// On the thread: its card, which opens to edit; deleting sends it to the trash.
		await page.getByTestId("kharcha-group-tab-thread").click();
		const thread = page.getByTestId("kharcha-thread");
		await expect(thread).toContainText("NPR 100.00");
		await expect(thread).toContainText("Cash");
		await thread.getByRole("button").filter({ hasText: /paid/ }).last().click();
		const edit = page.getByTestId("kharcha-settle-dialog");
		await expect(edit.getByRole("textbox", { name: "Amount" })).toHaveValue(/100/);
		await edit.getByTestId("kharcha-settle-delete").click();
		await expect(edit).toBeHidden();
		await expect(page.getByText("Payment moved to the trash for 30 days.")).toBeVisible();
		await expect(thread).not.toContainText("NPR 100.00");
	});

	test("a mention in the trip's thread notifies the other demo account (Task 92)", async ({ page, harness }) => {
		await harness.resetRateLimits();
		const signIn = async (email: string) => {
			await open(page, "/app/kharcha/sign-in");
			await page.getByRole("textbox", { name: "Email" }).fill(email);
			await page.getByRole("textbox", { name: "Password" }).fill(E2E.password);
			await page.getByRole("button", { name: "Log in" }).click();
			await expect(page).toHaveURL(/\/app\/kharcha\/home$/);
		};
		const signOut = async () => {
			await page.getByTestId("user-menu").first().click();
			await page.getByTestId("sign-out").click();
			await expect(page).toHaveURL(/\/app\/kharcha$/);
		};

		await signIn(E2E.users.kharcha.email);
		const { groupId } = await harness.kharchaThreadIds(E2E.users.kharcha.email);
		await open(page, `/app/kharcha/g/${groupId}`);
		const text = page.getByTestId("kharcha-composer-text");
		await text.click();
		await text.pressSequentially("@Bik");
		await expect(page.getByTestId("kharcha-mention-options")).toBeVisible();
		await page.keyboard.press("Tab");
		await text.pressSequentially("can you book the boat for six?");
		await page.keyboard.press("ControlOrMeta+Enter");
		const comment = page.getByTestId("kharcha-comment").filter({ hasText: "book the boat for six" });
		await expect(comment).toBeVisible();
		await expect(comment.locator("mark")).toHaveText(/^@Bikash/);
		await signOut();

		await signIn("bikash@kharcha.example.com");
		await expect(page.getByTestId("kharcha-bell-rail").or(page.getByTestId("kharcha-bell-bar")).first()).toBeVisible();
		const update = page.getByTestId("kharcha-update").filter({ hasText: "Asha Gurung mentioned you" });
		await expect(update).toBeVisible();
		await expect(update).toHaveAttribute("data-unread", "true");
		await update.click();
		await expect(page).toHaveURL(new RegExp(`/app/kharcha/g/${groupId}`));
		await expect(page.getByTestId("kharcha-comment").filter({ hasText: "book the boat for six" })).toBeVisible();
		await signOut();
	});

	test("a guest searches Spend from the suggestions, saves the search and finds it again (Task 93)", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		await open(page, "/app/kharcha");
		await page.getByTestId("kharcha-try").click();
		await expect(page).toHaveURL(/\/app\/kharcha\/home$/);
		await page.getByTestId("kharcha-onboarding").getByRole("button", { name: "Skip" }).click();
		await open(page, "/app/kharcha/spend");

		// The search box suggests the field, then the guest's own category; taking it searches.
		const box = page.getByTestId("kharcha-spend-q");
		await box.click();
		await box.pressSequentially("cat");
		await expect(page.getByTestId("kharcha-spend-suggestion").first()).toHaveText(/category:/);
		await page.keyboard.press("Enter");
		await expect(box).toHaveValue("category:");
		await box.pressSequentially("Groc");
		await expect(page.getByTestId("kharcha-spend-suggestion").first()).toHaveText(/Groceries/);
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(/q=category%3AGroceries/);
		const chips = page.getByTestId("kharcha-spend-chips");
		await expect(chips.getByRole("link", { name: "Remove category:Groceries" })).toBeVisible();

		// Saved under a name, it joins the saved searches and names the page.
		await page.getByTestId("kharcha-spend-save").click();
		const dialog = page.getByTestId("kharcha-save-search-dialog");
		await dialog.getByRole("textbox", { name: "Name" }).fill("Groceries only");
		await dialog.getByRole("button", { name: "Save" }).click();
		const saved = page.getByTestId("kharcha-saved-column");
		await expect(saved.getByRole("link", { name: "Groceries only" })).toHaveAttribute("aria-current", "page");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Groceries only");

		// A built-in one, then back to it: the search comes back whole, after a reload too.
		await saved.getByRole("link", { name: "This month" }).click();
		await expect(page).toHaveURL(/q=date%3Athis-month/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("This month");
		await saved.getByRole("link", { name: "Groceries only" }).click();
		await expect(page).toHaveURL(/q=category%3AGroceries/);
		await page.reload({ waitUntil: "networkidle" });
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Groceries only");
		await expect(box).toHaveValue("category:Groceries");
	});

	test("the daily job makes a guest's recurring rent and sends a budget's alert (Task 94)", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		await open(page, "/app/kharcha");
		await page.getByTestId("kharcha-try").click();
		await expect(page).toHaveURL(/\/app\/kharcha\/home$/);
		await page.getByTestId("kharcha-onboarding").getByRole("button", { name: "Skip" }).click();
		const cron = async () => {
			const response = await fetch(`${E2E.baseURL}/api/cron/kharcha`, {
				headers: { authorization: `Bearer ${E2E.cronSecret}` },
			});
			expect(response.status).toBe(200);
			return (await response.json()) as { recurring: { made: number }; budgets: { sent: number } };
		};

		// The sample's rent repeats monthly: Settings → Recurring lists it.
		await open(page, "/app/kharcha/settings/recurring");
		const rent = page.getByTestId("kharcha-recurring-item");
		await expect(rent).toHaveCount(1);
		await expect(rent).toContainText("Every month");

		// Its next one falls due today (the harness moves its days back a month), and the job makes it once.
		const session = (await (await page.request.get("/api/auth/get-session")).json()) as { user: { id: string } };
		const due = await fetch(`${E2E.harnessURL}/e2e/kharcha-recurring-due?user=${session.user.id}`, { method: "POST" });
		expect(due.status).toBe(200);
		expect((await cron()).recurring.made).toBeGreaterThanOrEqual(1);
		expect((await cron()).recurring.made).toBe(0);
		await page.reload({ waitUntil: "networkidle" });
		await expect(rent).toContainText("Added 2 times");
		await open(page, "/app/kharcha/home");
		await expect(page.getByTestId("kharcha-updates")).toContainText("was added again, as it repeats");

		// A monthly budget for everything with a limit this month is over: the next run tells them, once.
		await open(page, "/app/kharcha/insights/budgets");
		await page.getByTestId("kharcha-budget-new").click();
		const dialog = page.getByTestId("kharcha-budget-dialog");
		await dialog.getByRole("textbox", { name: "Limit" }).fill("100");
		await dialog.getByRole("button", { name: "Save" }).click();
		await expect(dialog).toBeHidden();
		const everything = page.getByTestId("kharcha-budget").filter({ hasText: "Everything" });
		await expect(everything.getByTestId("kharcha-budget-meter")).toHaveAttribute("data-state", "over");
		// Other guests' budgets may alert in the same run: what counts is this guest's one line.
		expect((await cron()).budgets.sent).toBeGreaterThanOrEqual(1);
		await cron();
		await open(page, "/app/kharcha/home");
		const alert = page.getByTestId("kharcha-update").filter({ hasText: "Your Everything budget is used up" });
		await expect(alert).toHaveCount(1);
		await alert.click();
		await expect(page).toHaveURL(/\/app\/kharcha\/insights\/budgets$/);
	});

	test("a demo account signs in on Kharcha's page, uses the palette and signs out", async ({
		page,
		harness,
		guard,
	}) => {
		await harness.resetRateLimits();
		await open(page, "/app/kharcha/home");
		await expect(page).toHaveURL(/\/app\/kharcha\/sign-in\?redirect=/);
		await page.getByRole("textbox", { name: "Email" }).fill(E2E.users.kharcha.email);
		await page.getByRole("textbox", { name: "Password" }).fill(E2E.password);
		await page.getByRole("button", { name: "Log in" }).click();
		await expect(page).toHaveURL(/\/app\/kharcha\/home$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Namaste, Asha Gurung");
		await expect(page.getByTestId("kharcha-onboarding")).toHaveCount(0);
		await expect(page.getByTestId("kharcha-home-recent")).toContainText("Pokhara trip");

		await page.keyboard.press("ControlOrMeta+k");
		await expect(page.getByTestId("command-input")).toBeFocused();
		await page.keyboard.press("Escape");

		// An unknown address is a 404 inside the shell, with a way back to Home.
		guard.allow(RESOURCE_STATUS(404));
		const response = await page.goto("/app/kharcha/no-such-page");
		expect(response?.status()).toBe(404);
		await expect(page.getByTestId("kharcha-shell")).toHaveCount(1);
		await expect(page.getByTestId("not-found-page")).toBeVisible();
		await open(page, "/app/kharcha/home");

		await page.getByTestId("user-menu").first().click();
		await page.getByTestId("sign-out").click();
		await expect(page).toHaveURL(/\/app\/kharcha$/);
		await expect(page.getByTestId("kharcha-landing")).toBeVisible();
	});

	test("the Expenses app's addresses redirect, and a user it had finds their data (Task 95)", async ({
		page,
		harness,
	}) => {
		const location = async (path: string) => {
			const response = await fetch(new URL(path, E2E.baseURL), { redirect: "manual" });
			return { status: response.status, to: new URL(response.headers.get("location") ?? "", E2E.baseURL) };
		};
		const landing = await location("/apps/expenses");
		expect([landing.status, landing.to.pathname]).toEqual([301, "/app/kharcha"]);
		const month = await location("/apps/expenses?month=2026-03&currency=USD");
		expect([month.status, month.to.pathname, month.to.searchParams.get("q")]).toEqual([
			301,
			"/app/kharcha/spend",
			"date:2026-03 currency:USD",
		]);
		const categories = await location("/apps/expenses/categories");
		expect([categories.status, categories.to.pathname]).toEqual([301, "/app/kharcha/settings/categories"]);
		const csv = await location("/apps/expenses/import");
		expect([csv.status, csv.to.pathname]).toEqual([301, "/app/kharcha/import"]);
		expect((await location("/ne/apps/expenses")).to.pathname).toBe("/ne/app/kharcha");

		// The harness's Expenses user (e2e/harness/database.ts), moved by the migration.
		await harness.resetRateLimits();
		await open(page, "/app/kharcha/sign-in");
		await page.getByRole("textbox", { name: "Email" }).fill(E2E.users.moved.email);
		await page.getByRole("textbox", { name: "Password" }).fill(E2E.password);
		await page.getByRole("button", { name: "Log in" }).click();
		await expect(page).toHaveURL(/\/app\/kharcha\/home$/);
		await page.getByTestId("kharcha-onboarding").getByRole("button", { name: "Skip" }).click();

		await open(page, "/apps/expenses?month=2026-03");
		await expect(page).toHaveURL(/\/app\/kharcha\/spend\?q=date%3A2026-03$/);
		const rows = page.getByTestId("kharcha-spend-row");
		await expect(rows).toHaveCount(2);
		await expect(rows.filter({ hasText: "Trek permit" })).toContainText("3,000.00");
		await expect(rows.filter({ hasText: "Map" })).toContainText("25.00");

		await open(page, "/apps/expenses/categories");
		await expect(page).toHaveURL(/\/app\/kharcha\/settings\/categories$/);
		await expect(page.getByTestId("kharcha-settings-item").filter({ hasText: "Trekking" })).toHaveCount(1);
		await open(page, "/app/kharcha/insights/budgets");
		await expect(page.getByTestId("kharcha-budget").filter({ hasText: "Trekking" })).toContainText("5,000");
	});
});
