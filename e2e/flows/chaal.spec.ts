/**
 * Chaal's foundation (Task 71, decisions 0254–0256): connecting Lichess through the OAuth
 * routes and the harness's fake Lichess, the account and scopes in the lab, the event
 * stream through our server, a token Lichess revoked, and disconnecting. In a production
 * build under the real CSP (the guard fails on any violation). CI never calls Lichess.
 */
import type { Page } from "@playwright/test";
import { E2E } from "../harness/config.ts";
import { expect, RESOURCE_STATUS, signedIn, test } from "../support/fixtures.ts";

const harness = (path: string, method: string, body?: unknown) =>
	fetch(`${E2E.harnessURL}${path}`, {
		method,
		...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
	});

test.describe("Chaal's routes without a session", () => {
	test("connecting returns to the page with no-session, never to another site", async ({ request }) => {
		const start = await request.get("/api/chaal/oauth/start?return=/admin/chaal/lab", { maxRedirects: 0 });
		expect(start.status()).toBe(302);
		expect(start.headers().location).toBe("/admin/chaal/lab?lichess=no-session");
		const outside = await request.get("/api/chaal/oauth/start?return=https://evil.example/", { maxRedirects: 0 });
		expect(outside.headers().location).toBe("/app/chaal?lichess=no-session");
	});

	test("the event stream needs a session", async ({ request }) => {
		const response = await request.get("/api/chaal/stream/events");
		expect(response.status()).toBe(401);
		expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
	});
});

test.describe("Chaal's lab as the viewer", () => {
	test.use(signedIn("viewer"));

	test("is a 403", async ({ page, guard }) => {
		guard.allow(RESOURCE_STATUS(403));
		const response = await page.goto("/admin/chaal/lab", { waitUntil: "networkidle" });
		expect(response?.status()).toBe(403);
	});
});

test.describe("Chaal's lab as the admin", () => {
	test.use(signedIn("admin"));
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async () => {
		await harness("/e2e/lichess", "DELETE");
		await harness("/e2e/chaal-connections", "DELETE");
	});

	/** Connect through the fake Lichess's approval page, approving or denying. */
	const connect = async (page: Page, decision: "Approve" | "Deny" = "Approve") => {
		await page.goto("/admin/chaal/lab", { waitUntil: "networkidle" });
		await expect(page.getByTestId("ch-lab-not-connected")).toBeVisible();
		await page.getByRole("link", { name: "Connect Lichess" }).click();
		await expect(page.getByRole("heading", { name: "Authorize chaal-e2e" })).toBeVisible();
		await expect(page.locator("#scopes")).toContainText("board:play challenge:read challenge:write");
		await page.getByRole("button", { name: decision }).click();
		// Back on the lab: wait until it's hydrated (no requests in flight), so its buttons are live.
		await page.waitForURL(/\/admin\/chaal\/lab\?lichess=/);
		await page.waitForLoadState("networkidle");
	};

	test("connects Lichess, shows the account and scopes, streams events and disconnects", async ({ page }) => {
		await connect(page);
		await expect(page).toHaveURL(/\/admin\/chaal\/lab\?lichess=connected$/);
		await expect(page.getByTestId("ch-lab-result")).toContainText("Lichess is connected.");
		await expect(page.getByTestId("ch-lab-account")).toHaveText("E2E_Player");
		await expect(page.getByTestId("ch-lab-state")).toHaveText("Connected");
		// The page never holds the token, sealed or not ("portfolio_" in other keys isn't one).
		expect(await page.content()).not.toMatch(/(?<![\w-])lio_[\w-]{10,}|\bv1\.[\w-]{8}\.[\w-]{16}\./);

		await page.getByRole("button", { name: "Open the stream" }).click();
		const events = page.getByTestId("ch-lab-events");
		await expect(page.getByTestId("ch-lab-stream-state")).toContainText("Open: the first byte came after");
		await expect(events).toContainText('"type":"challenge"');
		await expect(events).toContainText('"type":"gameFinish"');
		await expect(events).not.toContainText("aFutureEventChaalDoesNotKnow");
		await expect(page.getByTestId("ch-lab-stream-counts")).toContainText(/[1-9]\d* keepalives/);
		// An event Lichess sends now arrives at once.
		const pushed = await harness("/e2e/lichess/event", "POST", {
			account: "e2e_player",
			event: {
				type: "challengeCanceled",
				challenge: { id: "liveOne1", status: "canceled", variant: { key: "standard" }, speed: "rapid" },
			},
		});
		expect(((await pushed.json()) as { sent: number }).sent).toBe(1);
		await expect(events).toContainText("liveOne1");
		await page.getByRole("button", { name: "Stop" }).click();
		await expect(page.getByTestId("ch-lab-stream-state")).toContainText("You stopped it after");

		await page.getByRole("button", { name: "Disconnect" }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Disconnect" }).click();
		await expect(page.getByTestId("ch-lab-not-connected")).toBeVisible();
	});

	test("Deny on Lichess comes back as cancelled, with nothing connected", async ({ page }) => {
		await connect(page, "Deny");
		await expect(page).toHaveURL(/\?lichess=denied$/);
		await expect(page.getByTestId("ch-lab-result")).toContainText("Connecting was cancelled on Lichess.");
		await expect(page.getByTestId("ch-lab-not-connected")).toBeVisible();
	});

	test("a token Lichess revoked is refused, and the lab says reconnect", async ({ page, guard }) => {
		guard.allow(RESOURCE_STATUS(403));
		await connect(page);
		await expect(page.getByTestId("ch-lab-state")).toHaveText("Connected");
		await harness("/e2e/lichess/revoke", "POST", { account: "e2e_player" });
		await page.getByRole("button", { name: "Open the stream" }).click();
		await expect(page.getByTestId("ch-lab-stream-state")).toContainText("Refused (status 403)");
		await expect(page.getByTestId("ch-lab-state")).toHaveText("Reconnect needed");
	});

	test("/admin/chaal opens the lab until the overview arrives", async ({ page }) => {
		await page.goto("/admin/chaal", { waitUntil: "networkidle" });
		await expect(page).toHaveURL(/\/admin\/chaal\/lab$/);
	});

	test("the public lane reads the daily puzzle through the client and counts the call", async ({ page }) => {
		await page.goto("/admin/chaal/lab", { waitUntil: "networkidle" });
		await page.getByRole("button", { name: "Check the public lane" }).click();
		await expect(page.getByTestId("ch-lab-lane")).toContainText(/Daily puzzle \w+ in/);
		await expect(page.getByRole("cell", { name: "puzzle-daily" })).toBeVisible();
	});

	test("on a phone, connected and with the calls table, nothing scrolls sideways", async ({ page }) => {
		// The browser review sees the lab empty; the table and the scopes only appear here.
		await page.setViewportSize({ width: 390, height: 844 });
		await connect(page);
		await page.getByRole("button", { name: "Check the public lane" }).click();
		await expect(page.getByRole("cell", { name: "puzzle-daily" })).toBeVisible();
		const widths = await page.evaluate(() => [
			document.documentElement.scrollWidth,
			document.documentElement.clientWidth,
		]);
		expect(widths[0]).toBeLessThanOrEqual(widths[1] ?? 0);
	});
});
