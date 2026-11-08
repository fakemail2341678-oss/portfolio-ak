/**
 * Chaal's foundation (Task 71, decisions 0254–0256): connecting Lichess through the OAuth
 * routes and the harness's fake Lichess, the account and scopes in the lab, the event
 * stream through our server, a token Lichess revoked, and disconnecting. In a production
 * build under the real CSP (the guard fails on any violation). CI never calls Lichess.
 * Task 73 (decision 0259): the frame (palette, shortcuts, the phone's More), preferences in
 * the browser and on the account, and connecting from the settings page as a visitor.
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

/** The board theme the settings page has picked (its radio), and the diagram on the home. */
const pickedTheme = (page: Page) => page.getByTestId("chaal-board-themes").getByRole("radio", { checked: true });

test.describe("Chaal's pages for a visitor (Task 73)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ harness }) => {
		await harness.resetRateLimits();
		await fetch(`${E2E.harnessURL}/e2e/lichess`, { method: "DELETE" });
		await fetch(`${E2E.harnessURL}/e2e/chaal-connections`, { method: "DELETE" });
	});

	test("the frame: the palette (Ctrl K) goes to a page, and ? lists the shortcuts", async ({ page }) => {
		await page.goto("/app/chaal", { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-home")).toBeVisible();
		await page.keyboard.press("Control+k");
		await page.getByTestId("command-input").fill("About");
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(/\/app\/chaal\/about$/);
		await expect(page.getByRole("heading", { level: 1, name: "About Chaal" })).toBeVisible();
		await page.keyboard.press("Shift+?");
		await expect(page.getByTestId("chaal-shortcuts")).toBeVisible();
	});

	test("settings keep a visitor's board theme in this browser, and Delete this device's data forgets it", async ({
		page,
	}) => {
		await page.goto("/app/chaal/settings", { waitUntil: "networkidle" });
		await expect(page.getByText("Your choices are saved in this browser")).toBeVisible();
		await page.getByTestId("chaal-board-print").click();
		await page.reload({ waitUntil: "networkidle" });
		await expect(pickedTheme(page)).toHaveAttribute("value", "print");
		// The home's diagram follows it.
		await page.goto("/app/chaal", { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-mini-board")).toHaveAttribute("data-ch-board", "print");

		await page.goto("/app/chaal/settings", { waitUntil: "networkidle" });
		await page.getByTestId("chaal-settings-clear-device").click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Delete this device's data" }).click();
		await expect(pickedTheme(page)).toHaveAttribute("value", "diagram");
	});

	test("Connect Lichess from settings starts a guest, connects, brings the browser's preferences and disconnects", async ({
		page,
	}) => {
		await page.goto("/app/chaal/settings", { waitUntil: "networkidle" });
		await page.getByTestId("chaal-board-stone").click();
		await expect(page.getByTestId("chaal-not-connected")).toBeVisible();
		await page.getByTestId("chaal-settings-connect").click();
		await expect(page.getByRole("heading", { name: "Authorize chaal-e2e" })).toBeVisible();
		await page.getByRole("button", { name: "Approve" }).click();
		await page.waitForURL(/\/app\/chaal\/settings\?lichess=connected$/);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("chaal-connect-result")).toContainText("Lichess is connected.");
		await expect(page.getByTestId("chaal-connection-account")).toContainText("E2E_Player");
		await expect(page.getByTestId("user-menu")).toContainText("E2E_Player");
		// The guest's session took the browser's choice, and the page now saves to it.
		await expect(page.getByText("Your choices are saved to your account")).toBeVisible();
		await expect(pickedTheme(page)).toHaveAttribute("value", "stone");
		expect(await page.content()).not.toMatch(/(?<![\w-])lio_[\w-]{10,}|\bv1\.[\w-]{8}\.[\w-]{16}\./);

		await page.getByTestId("chaal-settings-disconnect").click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Disconnect" }).click();
		await expect(page.getByTestId("chaal-not-connected")).toBeVisible();
	});

	test("on a phone, More opens the other pages", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/app/chaal", { waitUntil: "networkidle" });
		await page.getByTestId("chaal-more").click();
		await page.getByTestId("chaal-more-settings").click();
		await expect(page).toHaveURL(/\/app\/chaal\/settings$/);
		await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
	});
});

test.describe("Chaal's settings for a member", () => {
	test.use(signedIn("viewer"));

	test("a member's preferences are saved to the account and survive a reload", async ({ page }) => {
		await fetch(`${E2E.harnessURL}/e2e/chaal-connections`, { method: "DELETE" });
		await page.goto("/app/chaal/settings", { waitUntil: "networkidle" });
		await expect(page.getByText("Your choices are saved to your account")).toBeVisible();
		await page.getByTestId("chaal-board-print").click();
		await expect(page.getByText("Saved to your account.")).toBeAttached();
		await page.reload({ waitUntil: "networkidle" });
		await expect(pickedTheme(page)).toHaveAttribute("value", "print");
	});
});

test.describe("Chaal's analysis board (Task 75)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ harness }) => {
		await harness.resetRateLimits();
		await fetch(`${E2E.harnessURL}/e2e/lichess`, { method: "DELETE" });
		await fetch(`${E2E.harnessURL}/e2e/chaal-connections`, { method: "DELETE" });
	});

	const square = (page: Page, name: string) =>
		page.getByTestId("chaal-analysis-board").locator(`[data-square="${name}"]`);
	const play = async (page: Page, from: string, to: string) => {
		await square(page, from).click();
		await square(page, to).click();
	};
	const menu = async (page: Page, item: string) => {
		await page.getByTestId("chaal-analysis-menu").click();
		await page.getByTestId(item).click();
	};

	test("moves on the board follow into the URL, and a link opens that board drawn on the server", async ({ page }) => {
		await page.goto("/app/chaal/analysis", { waitUntil: "networkidle" });
		await play(page, "e2", "e4");
		await play(page, "c7", "c5");
		await expect(page).toHaveURL(/\?moves=e2e4_c7c5$/);
		await expect(page.getByTestId("chaal-moves")).toContainText("c5");
		await page.getByRole("button", { name: "Previous move" }).click();
		await expect(page).toHaveURL(/moves=e2e4_c7c5&ply=1$/);

		const html = await (await page.request.get("/app/chaal/analysis?moves=e2e4_c7c5_g1f3&orientation=black")).text();
		expect(html).toContain('data-at="f3"');
		expect(html).toContain('<link rel="canonical" href="');
	});

	test("imports a PGN, annotates a move and exports it back", async ({ page }) => {
		await page.goto("/app/chaal/analysis", { waitUntil: "networkidle" });
		await menu(page, "chaal-import");
		await page
			.getByTestId("chaal-import-text")
			.fill('[White "Tal"]\n[Black "Botvinnik"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 *');
		await page.getByTestId("chaal-import-submit").click();
		await expect(page.getByTestId("chaal-moves")).toContainText("b5");
		await page.getByTestId("chaal-nag-1").click();
		await menu(page, "chaal-export-open");
		await expect(page.getByTestId("chaal-export-pgn")).toHaveValue(/\[White "Tal"\][\s\S]*3\. Bb5 \$1/);
		await expect(page.getByTestId("chaal-export-link")).toHaveValue(
			/\/app\/chaal\/analysis\?moves=e2e4_e7e5_g1f3_b8c6_f1b5$/,
		);
	});

	test("opens a finished Lichess game from its address, and refuses a game that isn't there", async ({ page }) => {
		const { readFileSync } = await import("node:fs");
		const daily = JSON.parse(readFileSync("tests/fixtures/lichess/api_puzzle_daily.json", "utf8")) as {
			game: { id: string };
		};
		await page.goto("/app/chaal/analysis", { waitUntil: "networkidle" });
		await menu(page, "chaal-import");
		await page.getByTestId("chaal-import-text").fill("https://lichess.org/Missing1");
		await page.getByTestId("chaal-import-submit").click();
		await expect(page.getByRole("alert")).toContainText("Lichess has no game with that address.");
		await page.getByTestId("chaal-import-text").fill(`https://lichess.org/${daily.game.id}`);
		await page.getByTestId("chaal-import-submit").click();
		await expect(page.getByTestId("chaal-import-form")).toBeHidden();
		await expect(page).toHaveURL(/moves=(?:[a-h1-8qrbn]{4,5}_){10,}/);
	});

	test("the explorer: masters after 1.e4, the opening's name, and a move from it played", async ({ page }) => {
		await page.goto("/app/chaal/analysis?moves=e2e4", { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-opening")).toContainText("B00");
		await page.getByTestId("chaal-tab-explorer").click();
		const moves = page.getByTestId("chaal-explorer-move");
		await expect(moves.first()).toBeVisible();
		expect(await moves.count()).toBeGreaterThan(3);
		await moves.first().click();
		await expect(page).toHaveURL(/moves=e2e4_[a-h][1-8][a-h][1-8]$/);
	});

	test("the tablebase knows an ending of seven pieces or fewer", async ({ page }) => {
		await page.goto(`/app/chaal/analysis?fen=${encodeURIComponent("4k3/6KP/8/8/8/8/7p/8 w - - 0 1")}`, {
			waitUntil: "networkidle",
		});
		await page.getByTestId("chaal-tab-tablebase").click();
		await expect(page.getByTestId("chaal-tablebase")).toContainText("Win");
		await page.getByTestId("chaal-tablebase").getByRole("button").first().click();
		await expect(page).toHaveURL(/moves=h7h8q/);
	});

	test("saving as a visitor starts a guest, and My analyses opens it again", async ({ page }) => {
		await page.goto("/app/chaal/analysis?moves=e2e4_e7e5", { waitUntil: "networkidle" });
		await page.getByTestId("chaal-save").click();
		await page.getByTestId("chaal-save-name").fill("Open game");
		await page.getByTestId("chaal-save-submit").click();
		await expect(page.getByText("Saved as “Open game”.")).toBeVisible();
		await expect(page).toHaveURL(/\?id=[0-9a-f-]{36}$/);
		await page.reload({ waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-analysis-status")).toContainText("Open game: saved");
		await expect(page.getByTestId("chaal-moves")).toContainText("e5");
		await menu(page, "chaal-analyses-open");
		await expect(page.getByTestId("chaal-analysis-open")).toContainText("Open game");
	});

	test("Stockfish runs in the browser under the CSP, at a low depth", async ({ page }) => {
		// No cloud eval is recorded for this position, so the engine on this device answers.
		await page.goto("/app/chaal/analysis?moves=e2e4_c7c5_g1f3", { waitUntil: "networkidle" });
		await page.getByTestId("chaal-engine-switch").click();
		await expect(page.getByTestId("chaal-engine-lines").locator("li").first()).toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId("chaal-engine-where")).toHaveText(/depth ([5-9]|\d\d) · this device/, {
			timeout: 30_000,
		});
		await expect(page.getByTestId("chaal-engine-score")).toHaveText(/^(?:[+−-]?\d|#)/);
		await page.getByTestId("chaal-engine-switch").click();
		await expect(page.getByTestId("chaal-engine-lines")).toBeHidden();
	});
});
