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
});
