/**
 * User management and the audit log end to end (decisions.md 0132–0134): an
 * invitation from email to first sign-in, signing a user out everywhere,
 * impersonation with its banner and way back, each leaving its audit row (found
 * by the request id), and the audit log refused to an editor, page and function.
 */
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { E2E } from "../harness/config.ts";
import { authFetch, expect, RESOURCE_STATUS, signedIn, signInState, test } from "../support/fixtures.ts";
import { createVerifiedUser, linkIn, uniqueEmail } from "../support/users.ts";

const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

/** The audit rows matching `search`, as the page lists them. */
const auditRows = async (page: Page, search: Record<string, string>) => {
	await open(page, `/admin/audit?${new URLSearchParams(search)}`);
	return page.getByTestId("audit-table").locator("tbody tr");
};

/** Opens a user's row menu on /admin/users and confirms `action` in the dialog. */
const confirmUserAction = async (page: Page, email: string, name: string, action: string) => {
	await open(page, `/admin/users?q=${encodeURIComponent(email)}`);
	await page.getByRole("button", { name: `Actions for ${name}` }).click();
	await page.getByRole("menuitem", { name: action }).click();
	const dialog = page.getByRole("alertdialog");
	const done = page.waitForResponse(
		(response) => response.url().includes("/_serverFn/") && response.request().method() === "POST",
	);
	await dialog.getByRole("button", { name: action }).click();
	return (await done).headers()["x-request-id"] ?? "";
};

const cookieHeaderOf = async (user: "editor") => {
	const state = JSON.parse(await readFile(await signInState(user), "utf8")) as {
		cookies: Array<{ name: string; value: string }>;
	};
	return state.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
};

test.beforeEach(async ({ harness }) => {
	await harness.resetRateLimits();
});

test.describe("as an admin", () => {
	test.use(signedIn("admin"));

	test("an invitation: email in the chosen language, password from the link, sign-in, audit row", async ({
		page,
		browser,
		harness,
	}) => {
		const email = uniqueEmail("invited");
		await open(page, "/admin/users");
		await page.getByRole("button", { name: "Invite user" }).click();
		const dialog = page.getByTestId("invite-user-dialog");
		await dialog.getByLabel("Name").fill("Invited Person");
		await dialog.getByLabel("Email", { exact: true }).fill(email);
		// The save is the POST (the address check while typing is a GET).
		const sent = page.waitForResponse(
			(response) => response.url().includes("/_serverFn/") && response.request().method() === "POST",
		);
		await dialog.getByRole("button", { name: "Send invitation" }).click();
		const requestId = (await sent).headers()["x-request-id"] ?? "";
		expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
		await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();

		const invitation = await harness.nextEmail(email, "invite");
		expect(invitation.text).toContain("E2E Admin invited you");
		const link = linkIn(invitation.text);
		expect(link).toContain("invite=1");

		// The invitee, in a browser of their own, chooses a password.
		const context = await browser.newContext();
		const invitee = await context.newPage();
		await open(invitee, link);
		await expect(invitee.getByRole("heading", { level: 1, name: "Accept your invitation" })).toBeVisible();
		await invitee.getByLabel("New password").fill("invited-password-1234");
		await invitee.getByLabel("Confirm password").fill("invited-password-1234");
		await invitee.getByRole("button", { name: "Set password" }).click();
		await expect(invitee.getByText("Your account is ready.")).toBeVisible();
		await context.close();
		// The link proved the address: password sign-in works at once.
		const signIn = await authFetch("/api/auth/sign-in/email", { email, password: "invited-password-1234" });
		expect(signIn.status, await signIn.text()).toBe(200);

		const rows = await auditRows(page, { q: requestId });
		await expect(rows).toHaveCount(1);
		await expect(rows.first()).toContainText("User invited");
		await expect(rows.first()).toContainText(email);
	});

	test("sign out everywhere ends the user's sessions", async ({ page, harness }) => {
		const user = await createVerifiedUser(harness, "signed-out");
		const signIn = await authFetch("/api/auth/sign-in/email", user);
		expect(signIn.status).toBe(200);
		const cookie = signIn.headers
			.getSetCookie()
			.map((header) => header.split(";")[0])
			.join("; ");
		const session = () =>
			fetch(new URL("/api/auth/get-session", E2E.baseURL), { headers: { cookie } }).then(
				(response) => response.json() as Promise<{ user?: { email: string } } | null>,
			);
		await open(page, "/admin/users");
		expect((await session())?.user?.email).toBe(user.email);

		const requestId = await confirmUserAction(page, user.email, "E2E signed-out", "Sign out everywhere");
		await expect(page.getByText("E2E signed-out was signed out everywhere.")).toBeVisible();
		expect(await session()).toBeNull();
		const rows = await auditRows(page, { q: requestId, action: "user.sessions-revoke" });
		await expect(rows).toHaveCount(1);
		await expect(rows.first()).toContainText(user.email);
	});

	test("impersonation: the user's view with a banner, one click back, both audited", async ({ page }) => {
		await confirmUserAction(page, "member@example.com", "Demo Member", "View as this user");
		const banner = page.getByTestId("impersonation-banner");
		await expect(banner).toContainText("You're viewing the app as Demo Member (member@example.com).");
		// The member's permissions, not the admin's.
		await open(page, "/account");
		await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
		await expect(banner).toBeVisible();
		await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

		await banner.getByRole("button", { name: "Back to my account" }).click();
		await expect(page).toHaveURL(/\/admin\/users$/);
		await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
		await expect(page.getByTestId("impersonation-banner")).toHaveCount(0);

		const rows = await auditRows(page, { q: "member@example.com", target: "user" });
		await expect(rows.filter({ hasText: "Impersonation started" }).first()).toBeVisible();
		await expect(rows.filter({ hasText: "Impersonation ended" }).first()).toBeVisible();
	});

	test("an editor gets a 403 from the audit log's server function", async ({ page }) => {
		// The admin's own call, captured from a client-side navigation to the page: the one
		// answering with audit entries (the session can be revalidated on the way)…
		await open(page, "/admin");
		const listed = page.waitForResponse(
			async (response) => response.url().includes("/_serverFn/") && (await response.text()).includes('"action"'),
		);
		await page.getByRole("link", { name: "Audit log" }).first().click();
		const request = (await listed).request();
		await expect(page.getByTestId("audit-table")).toBeVisible();
		// …replayed with the editor's session.
		const replay = await fetch(request.url(), {
			headers: { ...(await request.allHeaders()), cookie: await cookieHeaderOf("editor") },
		});
		const body = await replay.text();
		expect(body).toContain("FORBIDDEN");
	});
});

test.describe("as an editor (no audit:read)", () => {
	test.use(signedIn("editor"));

	test("the audit page is a 403", async ({ page, guard }) => {
		guard.allow(RESOURCE_STATUS(403));
		const response = await page.goto("/admin/audit", { waitUntil: "networkidle" });
		expect(response?.status()).toBe(403);
		await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
	});
});
