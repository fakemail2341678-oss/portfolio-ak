/**
 * Chaal's foundation (Task 71, decisions 0254–0256): connecting Lichess through the OAuth
 * routes and the harness's fake Lichess, the account and scopes in the lab, the event
 * stream through our server, a token Lichess revoked, and disconnecting. In a production
 * build under the real CSP (the guard fails on any violation). CI never calls Lichess.
 * Task 73 (decision 0259): the frame (palette, shortcuts, the phone's More), preferences in
 * the browser and on the account, and connecting from the settings page as a visitor.
 * Task 76 (decision 0265): local games against Stockfish and over the board, kept in the
 * browser, and moved to the account when a session opens Chaal.
 * Task 77 (decision 0266): online play against the fake Lichess: the Lichess AI to mate, a
 * challenge with offers, chat, a reconnect mid-game and a claimed win, a real-time challenge
 * kept open, an open link, and two tabs sharing one event stream.
 * Task 79 (decision 0268): the admin turns play off (pages say so, the streams refuse), revokes
 * a connection (the lab says reconnect), and blocks an account (connecting it is refused).
 * Task 81 (decision 0271): leaderboards, a player's page and games, the palette's search, a
 * finished game's replay, and following a player while connected.
 * Task 82 (decision 0272): the TV live from the fake Lichess's feeds and a channel on the big
 * board, following a game being played to its end, the broadcasts' lists and a tournament, and
 * a round being played on its PGN stream.
 * Task 83 (decision 0273): the arenas, an arena and a Swiss tournament, teams and studies as a
 * visitor; joining an arena and pausing, joining and leaving a team, and saving the analysis
 * board to a study while connected.
 */
import type { Page } from "@playwright/test";
import { E2E } from "../harness/config.ts";
import { expect, RESOURCE_STATUS, signedIn, test } from "../support/fixtures.ts";
import { reviewPage } from "../support/review.ts";

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
		// A challenge waiting for the account: the stream restates it when it opens.
		await harness("/e2e/lichess/challenge", "POST", { from: "e2e_rival", to: "e2e_player", days: 3 });
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
		await expect(page.getByTestId("ch-lab-stream-counts")).toContainText(/[1-9]\d* keepalives/);
		// An event Chaal doesn't know is dropped; one Lichess sends now arrives at once.
		await harness("/e2e/lichess/event", "POST", {
			account: "e2e_player",
			event: { type: "aFutureEventChaalDoesNotKnow" },
		});
		const pushed = await harness("/e2e/lichess/event", "POST", {
			account: "e2e_player",
			event: {
				type: "challengeCanceled",
				challenge: { id: "liveOne1", status: "canceled", variant: { key: "standard" }, speed: "rapid" },
			},
		});
		expect(((await pushed.json()) as { sent: number }).sent).toBe(1);
		await expect(events).toContainText("liveOne1");
		await expect(events).not.toContainText("aFutureEventChaalDoesNotKnow");
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

	test("/admin/chaal is the overview, its range in the URL", async ({ page }) => {
		await page.goto("/admin/chaal", { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-admin-overview")).toBeVisible();
		await page.getByTestId("chaal-range-30d").click();
		await expect(page).toHaveURL(/\/admin\/chaal\?range=30d$/);
		await expect(page.getByTestId("chaal-overview-modes")).toBeVisible();
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
		// After connecting, the frame's event stream keeps a request open: networkidle never comes.
		const opened = eventStreamOpened(page);
		await page.getByRole("button", { name: "Approve" }).click();
		await page.waitForURL(/\/app\/chaal\/settings\?lichess=connected$/);
		await opened;

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

test.describe("Chaal's local games (Task 76)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ harness }) => {
		await harness.resetRateLimits();
	});

	const board = (page: Page) => page.getByTestId("chaal-local-board");
	const play = async (page: Page, from: string, to: string) => {
		await board(page).locator(`[data-square="${from}"]`).click();
		await board(page).locator(`[data-square="${to}"]`).click();
	};
	const moves = (page: Page) => page.getByTestId("chaal-moves").filter({ visible: true }).locator("[data-node]");
	const choose = (page: Page, group: string, value: string) =>
		page.getByTestId(group).locator(`label:has(input[value="${value}"])`).click();

	test("plays Stockfish at level 1 in the browser, goes on after a reload, resigns and analyses", async ({ page }) => {
		await page.goto("/app/chaal/play", { waitUntil: "networkidle" });
		await choose(page, "chaal-play-level", "1");
		await choose(page, "chaal-play-side", "white");
		await page.getByTestId("chaal-play-computer-start").click();
		await expect(page).toHaveURL(/\/app\/chaal\/local\/[0-9a-f-]{36}$/);
		await play(page, "e2", "e4");
		// The real engine, in its worker under the production CSP, answers.
		await expect(moves(page)).toHaveCount(2, { timeout: 30_000 });
		await page.reload({ waitUntil: "networkidle" });
		await expect(moves(page)).toHaveCount(2);
		await page.getByTestId("chaal-local-resign").click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Resign" }).click();
		await expect(page.getByTestId("chaal-result")).toContainText("Black wins");
		await page.getByTestId("chaal-local-analyse").click();
		await expect(page).toHaveURL(/\/app\/chaal\/analysis\?moves=e2e4_[a-h][1-8][a-h][1-8]$/);
	});

	test("over the board: the board turns, the clock runs, a takeback, and the history keeps the game", async ({
		page,
	}) => {
		await page.goto("/app/chaal/play", { waitUntil: "networkidle" });
		await choose(page, "chaal-play-board-clock", "300+3");
		await choose(page, "chaal-play-layout", "flip");
		await page.getByTestId("chaal-play-board-start").click();
		await expect(page).toHaveURL(/\/app\/chaal\/local\//);
		const firstSquare = () => board(page).locator("[data-square]").first();
		await expect(firstSquare()).toHaveAttribute("data-square", "a8");
		await play(page, "e2", "e4");
		// Black to move: Black at the bottom, Black's clock running.
		await expect(firstSquare()).toHaveAttribute("data-square", "h1");
		await expect(page.locator('[role="timer"][data-running]')).toHaveCount(1);
		await play(page, "e7", "e5");
		await expect(moves(page)).toHaveCount(2);
		await page.getByTestId("chaal-local-takeback").click();
		await expect(moves(page)).toHaveCount(1);
		await page.getByRole("link", { name: "Back to Play" }).click();
		await expect(page.getByTestId("chaal-history-row").first()).toHaveAttribute("data-status", "playing");
		await expect(page.getByTestId("chaal-history-row")).toHaveCount(1);
	});
});

test.describe("Chaal's local games for a member (Task 76)", () => {
	test.use(signedIn("viewer"));

	test("a browser's games move to the account when a session opens Chaal", async ({ page }) => {
		const id = "6d5c4b3a-2f1e-4d0c-8b9a-7f6e5d4c3b2a";
		const at = new Date().toISOString();
		const record = {
			id,
			mode: "board",
			level: null,
			color: null,
			clock: null,
			layout: "tablet",
			pgn: '[Event "?"]\n[Site "Chaal"]\n[Date "2026.11.09"]\n[Round "?"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n1. d4 d5 *\n',
			clocks: null,
			result: null,
			reason: null,
			status: "playing",
			createdAt: at,
			updatedAt: at,
		};
		await page.addInitScript(
			([key, value]: [string, string]) => {
				if (!sessionStorage.getItem("seeded")) {
					localStorage.setItem(key, value);
					sessionStorage.setItem("seeded", "1");
				}
			},
			[`chaal:game:${id}`, JSON.stringify(record)] as [string, string],
		);
		await page.goto("/app/chaal/play", { waitUntil: "networkidle" });
		await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), `chaal:game:${id}`)).toBeNull();
		await page.reload({ waitUntil: "networkidle" });
		await expect(page.locator(`a[href$="/local/${id}"]`)).toBeVisible();
		// Drawn on the server from the account now.
		const html = await (await page.request.get(`/app/chaal/local/${id}`)).text();
		expect(html).toContain('data-at="d5"');
	});
});

/**
 * A connected player's page has hydrated once the frame opens their event stream; `networkidle`
 * never comes while it's open (Task 77).
 */
const eventStreamOpened = (page: Page) =>
	page.waitForRequest((request) => request.url().includes("/api/chaal/stream/events"));

/** Plays a move by clicking its two squares. */
const move = async (page: Page, uci: string) => {
	const board = page.getByTestId("chaal-game-board");
	await board.locator(`[data-square="${uci.slice(0, 2)}"]`).click();
	await board.locator(`[data-square="${uci.slice(2, 4)}"]`).click();
};

/** A piece on a square of the game's board ("wP", "bN"…). */
const pieceAt = (page: Page, square: string, piece: string) =>
	page.getByTestId("chaal-game-board").locator(`[data-at="${square}"][data-piece="${piece}"]`);

/** The rival's side of a game, played by the test. */
const rival = (game: string, action: string, extra: Record<string, unknown> = {}) =>
	harness("/e2e/lichess/act", "POST", { game, account: "e2e_rival", action, ...extra });

/** Picks a choice in one of the hub's ruled rows. */
const choose = (page: Page, row: string, value: string) =>
	page.getByTestId(row).locator(`label:has(input[value="${value}"])`).click();

test.describe("Chaal's online play (Task 77)", () => {
	// Not the review's viewer: Lichess allows one event stream per token, and the review opens Chaal's pages as the viewer meanwhile.
	test.use(signedIn("member"));
	test.describe.configure({ mode: "serial" });

	// Nothing stays connected or in play for the pages the review visits meanwhile (Task 78).
	test.afterAll(async () => {
		await harness("/e2e/lichess", "DELETE");
		await harness("/e2e/chaal-connections", "DELETE");
	});

	test.beforeEach(async ({ page }) => {
		await harness("/e2e/lichess", "DELETE");
		await harness("/e2e/chaal-connections", "DELETE");
		await page.goto("/app/chaal/play", { waitUntil: "networkidle" });
		await page.getByTestId("chaal-online-connect-button").click();
		await page.getByRole("button", { name: "Approve" }).click();
		const opened = eventStreamOpened(page);
		await page.waitForURL(/\/app\/chaal\/play\?lichess=connected$/);
		await opened;
	});

	test("plays the Lichess AI to mate, then Analyse opens the game", async ({ page }) => {
		await choose(page, "chaal-online-ai-side", "white");
		await page.getByTestId("chaal-online-ai-start").click();
		await page.waitForURL(/\/app\/chaal\/game\/[A-Za-z0-9]{8}$/);
		await expect(page.getByTestId("chaal-game-link")).toHaveAttribute("data-link", "open");
		// The AI answers from its script: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#.
		const replies: Array<[string, string, string]> = [
			["e2e4", "e5", "bP"],
			["f1c4", "c6", "bN"],
			["d1h5", "f6", "bN"],
		];
		for (const [mine, square, piece] of replies) {
			await move(page, mine);
			await expect(pieceAt(page, square, piece)).toBeVisible();
		}
		await move(page, "h5f7");
		await expect(page.getByTestId("chaal-result")).toContainText("1–0");
		await expect(page.getByTestId("chaal-game-again")).toBeVisible();
		await page.getByTestId("chaal-game-analyse").click();
		await page.waitForURL(/\/app\/chaal\/analysis\?.*moves=e2e4_e7e5_f1c4_b8c6_d1h5_g8f6_h5f7/);
	});

	test("a challenge from a player: accepted, offers, chat, a reconnect mid-game, and the win claimed when they leave", async ({
		page,
	}) => {
		const created = await harness("/e2e/lichess/challenge", "POST", {
			from: "e2e_rival",
			to: "e2e_player",
			clock: { limit: 600, increment: 5 },
			color: "black",
		});
		const { id } = (await created.json()) as { id: string };
		// The event stream brings it to the open page.
		const incoming = page.getByTestId("chaal-challenge-in");
		await expect(incoming).toContainText("E2E_Rival");
		await incoming.getByTestId("chaal-challenge-accept").click();
		await page.waitForURL(new RegExp(`/app/chaal/game/${id}$`));
		await expect(page.getByTestId("chaal-game-link")).toHaveAttribute("data-link", "open");

		await move(page, "e2e4");
		await expect(pieceAt(page, "e4", "wP")).toBeVisible();
		await expect.poll(async () => (await rival(id, "move", { uci: "e7e5" })).status).toBe(200);
		await expect(pieceAt(page, "e5", "bP")).toBeVisible();

		await rival(id, "draw-yes");
		await expect(page.getByTestId("chaal-game-draw-offer")).toBeVisible();
		await page.getByTestId("chaal-game-draw-offer-decline").click();
		await expect(page.getByTestId("chaal-game-draw-offer")).toBeHidden();

		await rival(id, "chat", { text: "<b>good luck</b>" });
		const chat = page.getByTestId("chaal-game-chat-lines");
		// Other people's words are text, never HTML.
		await expect(chat).toContainText("<b>good luck</b>");
		await page.getByTestId("chaal-game-chat-input").fill("you too");
		await page.getByTestId("chaal-game-chat-input").press("Enter");
		await expect(chat).toContainText("you too");

		// The connection drops and the rival's offer comes meanwhile: the reconnect restates the game.
		await harness("/e2e/lichess/drop", "POST", { account: "e2e_player" });
		await rival(id, "draw-yes");
		await expect(page.getByTestId("chaal-game-draw-offer")).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId("chaal-game-link")).toHaveAttribute("data-link", "open");
		await page.getByTestId("chaal-game-draw-offer-decline").click();
		await move(page, "g1f3");
		await expect.poll(async () => (await rival(id, "move", { uci: "b8c6" })).status).toBe(200);
		await expect(pieceAt(page, "c6", "bN")).toBeVisible();

		await rival(id, "gone", { claimWinInSeconds: 0 });
		await page.getByTestId("chaal-game-claim-victory").click();
		await expect(page.getByTestId("chaal-result")).toContainText("1–0");
		const games = (await (await harness("/e2e/lichess/games", "GET")).json()) as Array<{ id: string; status: string }>;
		expect(games.find((game) => game.id === id)?.status).toBe("timeout");
	});

	test("a real-time challenge waits while the page is open: declined with a reason, then accepted", async ({
		page,
	}) => {
		await choose(page, "chaal-online-opponent", "friend");
		await page.getByTestId("chaal-online-username").fill("E2E_Rival");
		await page.getByTestId("chaal-online-friend-start").click();
		const sent = page.getByTestId("chaal-online-sent");
		await expect(sent).toHaveAttribute("data-state", "waiting");
		const waiting = async () => {
			const list = (await (await harness("/e2e/lichess/challenges", "GET")).json()) as Array<{
				id: string;
				status: string;
			}>;
			return list.find((challenge) => challenge.status === "created")?.id;
		};
		const first = await waiting();
		await harness("/e2e/lichess/respond", "POST", { id: first, decision: "decline", reason: "tooFast" });
		await expect(sent).toHaveAttribute("data-state", "declined");
		await expect(sent).toContainText("Too fast for me.");

		await page.getByTestId("chaal-online-friend-start").click();
		await expect(sent).toHaveAttribute("data-state", "waiting");
		const second = await waiting();
		await harness("/e2e/lichess/respond", "POST", { id: second, decision: "accept" });
		await page.waitForURL(new RegExp(`/app/chaal/game/${second}$`));
		await expect(page.getByTestId("chaal-game-bottom")).toContainText("E2E_Player");
	});

	test("an open challenge's link: the game opens when the friend joins", async ({ page }) => {
		await choose(page, "chaal-online-opponent", "link");
		await page.getByTestId("chaal-online-link-start").click();
		const value = await page.getByTestId("chaal-online-link-value").inputValue();
		const id = /\/([A-Za-z0-9]{8})\?color=/.exec(value)?.[1];
		expect(id).toBeTruthy();
		await harness("/e2e/lichess/respond", "POST", { id, account: "e2e_rival", decision: "accept" });
		await page.waitForURL(new RegExp(`/app/chaal/game/${id}$`));
	});

	test("two tabs share one event stream; when the leader closes, the other takes it over", async ({ page }) => {
		const streams = async () =>
			((await (await harness("/e2e/lichess/streams?account=e2e_player", "GET")).json()) as { events: number }).events;
		await expect.poll(streams).toBe(1);
		const second = await page.context().newPage();
		await second.goto("/app/chaal/play", { waitUntil: "load" });
		await harness("/e2e/lichess/challenge", "POST", { from: "e2e_rival", to: "e2e_player", days: 3 });
		await expect(second.getByTestId("chaal-challenge-in")).toHaveCount(1);
		await expect(page.getByTestId("chaal-challenge-in")).toHaveCount(1);
		expect(await streams()).toBe(1);

		await page.close();
		await expect.poll(streams, { timeout: 15_000 }).toBe(1);
		await harness("/e2e/lichess/challenge", "POST", { from: "e2e_rival", to: "e2e_player", days: 7 });
		await expect(second.getByTestId("chaal-challenge-in")).toHaveCount(2);
		await second.close();
	});
});

test.describe("Chaal's online play II (Task 78)", () => {
	// Not the review's viewer: Lichess allows one event stream per token, and the review opens Chaal's pages as the viewer meanwhile.
	test.use(signedIn("member"));
	test.describe.configure({ mode: "serial" });

	// Nothing stays connected or in play for the pages the review visits meanwhile (Task 78).
	test.afterAll(async () => {
		await harness("/e2e/lichess", "DELETE");
		await harness("/e2e/chaal-connections", "DELETE");
	});

	test.beforeEach(async ({ page }) => {
		await harness("/e2e/lichess", "DELETE");
		await harness("/e2e/chaal-connections", "DELETE");
		await page.goto("/app/chaal/play", { waitUntil: "networkidle" });
		await page.getByTestId("chaal-online-connect-button").click();
		await page.getByRole("button", { name: "Approve" }).click();
		const opened = eventStreamOpened(page);
		await page.waitForURL(/\/app\/chaal\/play\?lichess=connected$/);
		await opened;
	});

	type Seek = { id: string; clock: { initial: number; increment: number } | null; days: number | null; open: boolean };
	const seeks = async () => (await (await harness("/e2e/lichess/seeks", "GET")).json()) as Seek[];
	const tile = (page: Page, pace: string) => page.locator(`[data-testid="chaal-quick-tile"][data-pace="${pace}"]`);

	test("quick pairing on a clock: the seek waits while the page is open, Cancel takes it back, and an accepted one opens the game", async ({
		page,
	}) => {
		const status = page.getByTestId("chaal-quick-status");
		await expect(status).toHaveAttribute("data-state", "ready");
		await tile(page, "600+5").click();
		await expect(status).toHaveAttribute("data-state", "seeking");
		await expect
			.poll(seeks)
			.toEqual([expect.objectContaining({ clock: { initial: 600_000, increment: 5_000 }, open: true })]);
		await page.getByTestId("chaal-quick-cancel").click();
		await expect(status).toHaveAttribute("data-state", "ready");
		// Closing the stream cancelled the seek at Lichess.
		await expect.poll(seeks).toEqual([]);

		await tile(page, "1800+20").click();
		await expect.poll(seeks).toHaveLength(1);
		const accepted = await harness("/e2e/lichess/seek-accept", "POST", { account: "e2e_player" });
		const { id } = (await accepted.json()) as { id: string };
		await page.waitForURL(new RegExp(`/app/chaal/game/${id}$`));
		await expect(page.getByTestId("chaal-game-link")).toHaveAttribute("data-link", "open");
	});

	test("a correspondence seek waits on Lichess; its game starting is a toast, and the player's move shows on the bell, Play and My games", async ({
		page,
	}) => {
		await tile(page, "d3").click();
		await expect(page.getByTestId("chaal-quick-status")).toHaveAttribute("data-state", "posted");
		await expect.poll(seeks).toEqual([expect.objectContaining({ days: 3, open: false })]);
		// The rival takes it as White.
		const accepted = await harness("/e2e/lichess/seek-accept", "POST", { account: "e2e_player", color: "black" });
		const { id } = (await accepted.json()) as { id: string };
		await expect(page.getByText("Your game with E2E_Rival has started")).toBeVisible();
		await expect(page.getByTestId("chaal-bell")).toHaveAttribute("data-count", "0");
		await expect.poll(async () => (await rival(id, "move", { uci: "e2e4" })).status).toBe(200);

		// The event stream never says a move was made: a fresh page reads the games in progress.
		const opened = eventStreamOpened(page);
		await page.reload();
		await opened;
		await expect(page.getByTestId("chaal-bell")).toHaveAttribute("data-count", "1");
		await expect(page.getByTestId("chaal-header").getByTestId("chaal-play-badge")).toContainText("1");
		const row = page.getByTestId("chaal-online-game").first();
		await expect(row).toHaveAttribute("data-my-turn", "true");
		await expect(row.getByTestId("chaal-online-game-left")).toContainText("left");
		await page.getByTestId("chaal-bell").click();
		await page.getByTestId("chaal-bell-game").click();
		await page.waitForURL(new RegExp(`/app/chaal/game/${id}$`));
	});

	test("an arena game: berserk halves the clock; zen leaves only the board, and z brings the page back", async ({
		page,
	}) => {
		const created = await harness("/e2e/lichess/arena", "POST", { clock: { limit: 300, increment: 0 } });
		const { id } = (await created.json()) as { id: string };
		await page.goto(`/app/chaal/game/${id}`);
		await expect(page.getByTestId("chaal-game-link")).toHaveAttribute("data-link", "open");
		await page.getByTestId("chaal-game-berserk").click();
		await expect(page.getByTestId("chaal-game-berserk")).toBeHidden();
		await expect(page.getByTestId("chaal-game-bottom")).toContainText("2:30");

		await page.keyboard.press("z");
		await expect(page.getByTestId("chaal-frame")).toHaveAttribute("data-zen", "true");
		await expect(page.getByTestId("chaal-header")).toHaveCount(0);
		await expect(page.getByTestId("chaal-game-board")).toBeVisible();
		await page.keyboard.press("z");
		await expect(page.getByTestId("chaal-header")).toBeVisible();
	});

	test("on a phone on its side, the board, both clocks and the controls fit without a scroll", async ({ page }) => {
		const created = await harness("/e2e/lichess/arena", "POST", { clock: { limit: 600, increment: 0 } });
		const { id } = (await created.json()) as { id: string };
		await page.setViewportSize({ width: 844, height: 390 });
		await page.goto(`/app/chaal/game/${id}`);
		await expect(page.getByTestId("chaal-game-link")).toHaveAttribute("data-link", "open");
		const board = await page.getByTestId("chaal-game-board").boundingBox();
		const bottom = await page.getByTestId("chaal-game-bottom").boundingBox();
		const top = await page.getByTestId("chaal-game-top").boundingBox();
		if (!board || !bottom || !top) throw new Error("not laid out");
		expect(board.y + board.height).toBeLessThanOrEqual(390);
		// The strips sit beside the board, on screen.
		expect(top.x).toBeGreaterThanOrEqual(board.x + board.width);
		expect(bottom.y + bottom.height).toBeLessThanOrEqual(390);
		await expect(page.getByTestId("chaal-tab-bar")).toBeHidden();
	});
});

test.describe("Chaal's admin (Task 79)", () => {
	test.use(signedIn("admin"));
	test.describe.configure({ mode: "serial" });

	const reset = async () => {
		await harness("/e2e/lichess", "DELETE");
		await harness("/e2e/chaal-connections", "DELETE");
	};
	test.beforeEach(reset);
	// Play back on and nothing blocked for the flows and pages after these.
	test.afterAll(reset);

	/** Past the 5 s the Nitro routes keep the settings and blocks (src/server/chaal/controls.ts). */
	const CONTROLS_TTL_MS = 5_500;

	/** Connects the admin's session to the fake Lichess from the lab. */
	const connectFromLab = async (page: Page) => {
		await page.goto("/admin/chaal/lab", { waitUntil: "networkidle" });
		await page.getByRole("link", { name: "Connect Lichess" }).click();
		await page.getByRole("button", { name: "Approve" }).click();
		await page.waitForURL(/\/admin\/chaal\/lab\?lichess=/);
		await page.waitForLoadState("networkidle");
	};

	/** Sets the play switch on the settings page and saves. */
	const setPlay = async (page: Page, on: boolean) => {
		await page.goto("/admin/chaal/settings", { waitUntil: "networkidle" });
		const toggle = page.getByTestId("chaal-settings-form").getByRole("switch", { name: "Online play" });
		if ((await toggle.isChecked()) !== on) await toggle.click();
		const saved = page.waitForResponse(
			(response) => response.url().includes("/_serverFn/") && response.request().method() === "POST",
		);
		await page.getByRole("button", { name: "Save changes" }).click();
		expect((await saved).ok()).toBe(true);
	};

	test("play off: the play page says so and the streams refuse; back on, the page offers play again", async ({
		page,
		guard,
	}) => {
		guard.allow(RESOURCE_STATUS(403));
		await connectFromLab(page);
		await expect(page.getByTestId("ch-lab-state")).toHaveText("Connected");
		await setPlay(page, false);
		await page.goto("/app/chaal/play", { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-online-off")).toBeVisible();
		// The stream routes are their own bundle with their own 5 s cache of the settings: they refuse within 5 s.
		const openEvents = () =>
			page.evaluate(async () => {
				const controller = new AbortController();
				const response = await fetch("/api/chaal/stream/events", { signal: controller.signal });
				const body = response.status === 200 ? null : await response.json();
				controller.abort();
				return { status: response.status, body };
			});
		await expect.poll(openEvents, { timeout: 10_000, intervals: [1_000] }).toEqual({
			status: 403,
			body: { error: "FORBIDDEN" },
		});

		await setPlay(page, true);
		await page.goto("/app/chaal/play", { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-online-off")).toHaveCount(0);
	});

	test("revoking a connection on the admin's list leaves its player Reconnect", async ({ page }) => {
		await connectFromLab(page);
		await page.goto("/admin/chaal/connections", { waitUntil: "networkidle" });
		const table = page.getByTestId("chaal-connections-table");
		await expect(table.getByTestId("chaal-connection-lichess")).toHaveText("E2E_Player");
		await table.getByRole("button", { name: "Actions for E2E_Player" }).click();
		await page.getByRole("menuitem", { name: "Revoke" }).click();
		const done = page.waitForResponse(
			(response) => response.url().includes("/_serverFn/") && response.request().method() === "POST",
		);
		await page.getByRole("alertdialog").getByRole("button", { name: "Revoke" }).click();
		expect((await done).ok()).toBe(true);
		await expect(table.getByText("Revoked")).toBeVisible();
		await page.goto("/admin/chaal/lab", { waitUntil: "networkidle" });
		await expect(page.getByTestId("ch-lab-state")).toHaveText("Reconnect needed");
	});

	test("blocking a Lichess account refuses connecting it; unblocking lets it connect", async ({ page }) => {
		await page.goto("/admin/chaal/blocks", { waitUntil: "networkidle" });
		await page.getByTestId("chaal-block-open").first().click();
		const dialog = page.getByTestId("chaal-block-dialog");
		await dialog.getByLabel("Lichess username").fill("e2e_player");
		await dialog.getByLabel("Reason").fill("e2e: a block");
		await dialog.getByRole("button", { name: "Block", exact: true }).click();
		await expect(dialog).toBeHidden();
		await expect(page.getByTestId("chaal-blocks-table").getByText("e2e: a block")).toBeVisible();

		// The OAuth routes are their own bundle, with their own 5 s cache of the blocks (decision 0268).
		await page.waitForTimeout(CONTROLS_TTL_MS);
		await connectFromLab(page);
		await expect(page).toHaveURL(/\?lichess=blocked$/);
		await expect(page.getByTestId("ch-lab-result")).toContainText("This account can't connect Lichess here.");
		await expect(page.getByTestId("ch-lab-not-connected")).toBeVisible();

		await page.goto("/admin/chaal/blocks", { waitUntil: "networkidle" });
		const table = page.getByTestId("chaal-blocks-table");
		await table.getByRole("button", { name: "Actions for e2e_player" }).click();
		await page.getByRole("menuitem", { name: "Delete" }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
		await expect(table.getByText("e2e: a block")).toHaveCount(0);
		await page.waitForTimeout(CONTROLS_TTL_MS);
		await connectFromLab(page);
		await expect(page).toHaveURL(/\?lichess=connected$/);
	});
});

/** A puzzle as the fake Lichess has it (its pool: the recorded batch and the daily one). */
const fakePuzzle = async (id: string) =>
	(await (await harness(`/lichess/api/puzzle/${id}`, "GET")).json()) as {
		game: { pgn: string };
		puzzle: { id: string; solution: string[] };
	};

/** The puzzle on the board: its id, and its trainer's state. */
const puzzleBoard = (page: Page) => page.getByTestId("chaal-puzzle-board");

/** Waits for the player's turn on a puzzle (the opponent's move plays first). */
const puzzleTurn = (page: Page) => expect(puzzleBoard(page)).toHaveAttribute("data-phase", "play");

/** Plays a move on the puzzle's board by clicking its two squares. */
const puzzleMove = async (page: Page, uci: string) => {
	await puzzleBoard(page)
		.locator(`[data-square="${uci.slice(0, 2)}"]`)
		.click();
	await puzzleBoard(page)
		.locator(`[data-square="${uci.slice(2, 4)}"]`)
		.click();
};

/** Solves the puzzle on the board: the player's moves of its solution, the replies between. */
async function solvePuzzle(page: Page) {
	const id = (await puzzleBoard(page).getAttribute("data-puzzle")) ?? "";
	const { puzzle } = await fakePuzzle(id);
	for (let index = 0; index < puzzle.solution.length; index += 2) {
		await puzzleTurn(page);
		await puzzleMove(page, puzzle.solution[index] ?? "");
	}
	await expect(page.getByTestId("chaal-puzzle-status")).toHaveAttribute("data-won", "true");
	return id;
}

/** A legal move on the board that isn't the puzzle's first one and doesn't mate (a miss). */
async function missPuzzle(page: Page) {
	const { Chess } = await import("chess.js");
	const id = (await puzzleBoard(page).getAttribute("data-puzzle")) ?? "";
	const { game, puzzle } = await fakePuzzle(id);
	const chess = new Chess();
	for (const san of game.pgn.split(" ")) chess.move(san);
	const wrong = chess
		.moves({ verbose: true })
		.find(
			(entry) =>
				`${entry.from}${entry.to}` !== puzzle.solution[0]?.slice(0, 4) && !entry.san.includes("#") && !entry.promotion,
		);
	if (!wrong) throw new Error(`no wrong move in ${id}`);
	await puzzleTurn(page);
	await puzzleMove(page, `${wrong.from}${wrong.to}`);
}

test.describe("Chaal's puzzles for a visitor (Task 80)", () => {
	test.describe.configure({ mode: "serial" });

	test("the daily puzzle is drawn on the server, solved move by move, and its rating and themes follow", async ({
		page,
	}) => {
		const html = await (await page.request.get("/app/chaal/puzzles")).text();
		expect(html).toContain('data-phase="intro"');
		await page.goto("/app/chaal/puzzles", { waitUntil: "networkidle" });
		const id = await solvePuzzle(page);
		await expect(page.getByTestId("chaal-puzzle-rating")).toBeVisible();
		await expect(page.getByTestId("chaal-puzzle-themes")).toBeVisible();
		await expect(page.getByTestId("chaal-puzzle-analyse")).toHaveAttribute("href", /\/app\/chaal\/analysis\?fen=/);
		// Kept in this browser, and the progress panel counts it.
		await expect
			.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("chaal:puzzles") ?? "[]").length))
			.toBe(1);
		await expect(page.getByTestId("chaal-puzzle-solved")).toContainText("1");
		await expect(page.getByTestId("chaal-puzzle-recent").getByRole("link", { name: `Puzzle ${id}` })).toBeVisible();
	});

	test("training: a wrong move goes back for another try, the solution shows, and Next brings another puzzle", async ({
		page,
	}) => {
		await page.goto("/app/chaal/puzzles?mode=train", { waitUntil: "networkidle" });
		const first = await puzzleBoard(page).getAttribute("data-puzzle");
		await missPuzzle(page);
		await expect(puzzleBoard(page)).toHaveAttribute("data-phase", "wrong");
		await puzzleTurn(page);
		await page.getByTestId("chaal-puzzle-hint").click();
		await expect(page.getByTestId("chaal-puzzle-hint")).toBeDisabled();
		await page.getByTestId("chaal-puzzle-solution").click();
		await expect(puzzleBoard(page)).toHaveAttribute("data-phase", "failed");
		await expect(page.getByTestId("chaal-puzzle-status")).toHaveAttribute("data-won", "false");
		await page.getByTestId("chaal-puzzle-next").click();
		await expect(puzzleBoard(page)).not.toHaveAttribute("data-puzzle", first ?? "");
		await puzzleTurn(page);
		// A theme is a new address: the choice is in the URL.
		await page.getByTestId("chaal-puzzle-difficulty").click();
		await page.getByRole("option", { name: "Harder", exact: true }).click();
		await expect(page).toHaveURL(/difficulty=harder/);
		await puzzleTurn(page);
	});

	test("the streak: solved puzzles count, a miss ends it, and the best is kept", async ({ page }) => {
		await page.goto("/app/chaal/puzzles?mode=streak", { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-puzzle-hint")).toHaveCount(0);
		await solvePuzzle(page);
		await expect(page.getByTestId("chaal-puzzle-streak-count")).toHaveText("1");
		await page.getByTestId("chaal-puzzle-next").click();
		await missPuzzle(page);
		await expect(puzzleBoard(page)).toHaveAttribute("data-phase", "failed", { timeout: 15_000 });
		await page.getByTestId("chaal-puzzle-next").click();
		await expect(page.getByTestId("chaal-puzzle-streak-count")).toHaveText("0");
		await expect(page.getByTestId("chaal-puzzle-streak")).toContainText("1");
		await expect(page.getByTestId("chaal-puzzle-best-streak")).toHaveText("1");
	});
});

test.describe("Chaal's puzzles connected to Lichess (Task 80)", () => {
	// Not the review's viewer: Lichess allows one event stream per token (Task 77).
	test.use(signedIn("member"));
	test.describe.configure({ mode: "serial" });

	test.afterAll(async () => {
		await harness("/e2e/lichess", "DELETE");
		await harness("/e2e/chaal-connections", "DELETE");
	});

	test("training at the player's rating posts results to Lichess in batches; its dashboard and replays follow", async ({
		page,
	}) => {
		await harness("/e2e/lichess", "DELETE");
		await harness("/e2e/chaal-connections", "DELETE");
		await page.goto("/app/chaal/puzzles?mode=train", { waitUntil: "networkidle" });
		await page.getByTestId("chaal-puzzle-connect").click();
		await page.getByRole("button", { name: "Approve" }).click();
		const opened = eventStreamOpened(page);
		await page.waitForURL(/\/app\/chaal\/puzzles\?mode=train&lichess=connected$/);
		await opened;
		await expect(page.getByTestId("chaal-puzzle-my-rating")).toContainText("1,500");

		// Five finished puzzles: the solution shown each time (a miss), posted together at the fifth.
		for (let count = 0; count < 5; count++) {
			await puzzleTurn(page);
			await page.getByTestId("chaal-puzzle-solution").click();
			await expect(puzzleBoard(page)).toHaveAttribute("data-phase", "failed", { timeout: 15_000 });
			await page.getByTestId("chaal-puzzle-next").click();
		}
		await expect
			.poll(async () => {
				const answer = await harness("/e2e/lichess/puzzle-solutions?account=e2e_player", "GET");
				return ((await answer.json()) as { solutions: unknown[] }).solutions.length;
			})
			.toBe(5);

		await page.reload();
		await expect(page.getByTestId("chaal-puzzle-lichess")).toContainText("5");
		const replay = page.getByTestId("chaal-puzzle-lichess").locator('a[data-testid^="chaal-puzzle-replay-"]').first();
		await replay.click();
		await expect(page).toHaveURL(/mode=replay/);
		await puzzleTurn(page);
	});
});

/** The player the fake Lichess knows (recorded by `pnpm lichess:record players`). */
const RECORDED_PLAYER = "nihalsarin2004";

const replayPiece = (page: Page, square: string, piece: string) =>
	page.getByTestId("chaal-replay-board").locator(`[data-at="${square}"][data-piece="${piece}"]`);

test.describe("Chaal's players and games for a visitor (Task 81)", () => {
	test.describe.configure({ mode: "serial" });

	test("a leaderboard links to a player; their page renders on the server and streams the rest", async ({ page }) => {
		await page.goto("/app/chaal/players?perf=ultraBullet", { waitUntil: "networkidle" });
		const rows = page.getByTestId("chaal-leaderboard").locator("tbody tr");
		await expect(rows.first()).toBeVisible();
		expect(await rows.count()).toBeGreaterThan(10);
		await expect(page.getByTestId("chaal-players-perf-ultraBullet")).toHaveAttribute("aria-current", "page");

		await page.goto(`/app/chaal/players/${RECORDED_PLAYER}`, { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-player-header")).toContainText(RECORDED_PLAYER, { ignoreCase: true });
		// The rating with the most games opens, with its details, the latest games and the activity.
		await expect(page.getByTestId("chaal-player-perf-ultraBullet")).toHaveAttribute("aria-current", "true");
		await expect(page.getByTestId("chaal-player-perf")).toBeVisible();
		await expect(page.getByTestId("chaal-player-latest").getByTestId("chaal-game-row").first()).toBeVisible();
		await expect(page.getByTestId("chaal-player-activity")).toBeVisible();
		await expect(page.locator("[data-chart-frame]")).toBeVisible();
		// No follow button for a visitor; Challenge fills in the play hub.
		await expect(page.getByTestId("chaal-player-follow")).toHaveCount(0);
		await page.getByTestId("chaal-player-challenge").click();
		await page.waitForURL(
			(url) =>
				url.pathname === "/app/chaal/play" &&
				url.searchParams.get("with") === "friend" &&
				url.searchParams.get("opponent")?.toLowerCase() === RECORDED_PLAYER,
		);
	});

	test("the games tab: filters go in the URL and an empty result says so", async ({ page }) => {
		await page.goto(`/app/chaal/players/${RECORDED_PLAYER}?tab=games`, { waitUntil: "networkidle" });
		const rows = page.getByTestId("chaal-player-games").getByTestId("chaal-game-row");
		expect(await rows.count()).toBe(20);
		await expect(page.getByTestId("chaal-player-games-older")).toBeVisible();
		// A filter changes the URL at once (the fake has recorded only the first page without one).
		await page.locator('select[name="result"]').selectOption("win");
		await expect(page).toHaveURL(/tab=games.*result=win|result=win.*tab=games/);
	});

	test("a player Lichess doesn't know is Chaal's 404", async ({ page, guard }) => {
		guard.allow(RESOURCE_STATUS(404));
		const response = await page.goto("/app/chaal/players/nobody_here");
		expect(response?.status()).toBe(404);
	});

	test("the palette finds a player by name", async ({ page }) => {
		await page.goto("/app/chaal", { waitUntil: "networkidle" });
		await page.keyboard.press("Control+k");
		// One fill: the search waits for a pause, so only the recorded term is asked for.
		await page.getByTestId("command-input").fill("nihalsarin200");
		await page.getByRole("option", { name: new RegExp(`(^|\\s)${RECORDED_PLAYER}$`, "i") }).click();
		await expect(page).toHaveURL(new RegExp(`/app/chaal/players/${RECORDED_PLAYER}$`, "i"));
	});

	test("a finished game replays: at the end, stepping back, the clocks, Lichess's analysis and Analyse", async ({
		page,
	}) => {
		await page.goto("/app/chaal/game/T8myeL3d", { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-replay")).toBeVisible();
		await expect(page.getByTestId("chaal-replay-summary")).toBeVisible();
		// The end: Black's rook mated on h4.
		await expect(replayPiece(page, "h4", "bR")).toBeVisible();
		await page.keyboard.press("Home");
		await expect(replayPiece(page, "c2", "wP")).toBeVisible();
		await page.keyboard.press("ArrowRight");
		await expect(replayPiece(page, "c4", "wP")).toBeVisible();
		// Lichess's judgements are the annotator's symbols beside the moves.
		await expect(page.getByText("??").first()).toBeAttached();
		await page.getByRole("link", { name: "Analyse" }).click();
		await expect(page).toHaveURL(/\/app\/chaal\/analysis\?moves=c2c4_/);
	});

	test("a game Lichess doesn't have is said where the board would be", async ({ page }) => {
		await page.goto("/app/chaal/game/abcdEFGH", { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-game-missing")).toBeVisible();
	});
});

test.describe("Chaal's players connected to Lichess (Task 81)", () => {
	// Not the review's viewer: Lichess allows one event stream per token (Task 77).
	test.use(signedIn("member"));
	test.describe.configure({ mode: "serial" });

	test.afterAll(async () => {
		await harness("/e2e/lichess", "DELETE");
		await harness("/e2e/chaal-connections", "DELETE");
	});

	test("follow and unfollow a player; the leaderboards' page lists whom you follow; the score with you", async ({
		page,
	}) => {
		await harness("/e2e/lichess", "DELETE");
		await harness("/e2e/chaal-connections", "DELETE");
		await page.goto("/app/chaal/settings", { waitUntil: "networkidle" });
		await page.getByTestId("chaal-settings-connect").click();
		const opened = eventStreamOpened(page);
		await page.getByRole("button", { name: "Approve" }).click();
		await page.waitForURL(/\/app\/chaal\/settings\?lichess=connected$/);
		await opened;

		await page.goto(`/app/chaal/players/${RECORDED_PLAYER}`);
		await expect(page.getByTestId("chaal-crosstable")).toBeVisible();
		const follow = page.getByTestId("chaal-player-follow");
		await expect(follow).toHaveAttribute("aria-pressed", "false");
		await follow.click();
		await expect(follow).toHaveAttribute("aria-pressed", "true");
		await expect
			.poll(async () => {
				const answer = await harness("/e2e/lichess/following?account=e2e_player", "GET");
				return ((await answer.json()) as { following: string[] }).following;
			})
			.toEqual([RECORDED_PLAYER]);

		await page.goto("/app/chaal/players");
		await expect(page.getByTestId("chaal-following")).toContainText(RECORDED_PLAYER);

		await page.goto(`/app/chaal/players/${RECORDED_PLAYER}`);
		await expect(follow).toHaveAttribute("aria-pressed", "true");
		await follow.click();
		await expect(follow).toHaveAttribute("aria-pressed", "false");
		await expect
			.poll(async () => {
				const answer = await harness("/e2e/lichess/following?account=e2e_player", "GET");
				return ((await answer.json()) as { following: string[] }).following;
			})
			.toEqual([]);
	});
});

/** The fake Lichess's watch (e2e/harness/lichess-watch.ts): what the browser holds open there. */
const watchStreams = async () =>
	(await (await harness("/e2e/lichess/watch-streams", "GET")).json()) as {
		feeds: Record<string, number>;
		game: number;
		rounds: Record<string, number>;
	};

/** The recorded tournament (pnpm lichess:record watch), its default round, and its first round, played live by the fake. */
const TOUR = "9NE16qcS";
const LIVE_ROUND = "HUCtFdGE";
const LIVE_BOARD = "WgYhKv3x";

/** A board's PGN as the round's stream sends it: the board's address names it. */
const boardPgn = (moves: string) =>
	`[Event "Round 1"]\n[White "Sonis, Francesco"]\n[Black "Wilber, Matthew K"]\n[Result "*"]\n[GameURL "https://lichess.org/broadcast/20th-annual-spice-cup/round-1/${LIVE_ROUND}/${LIVE_BOARD}"]\n\n${moves} *`;

test.describe("Chaal's watch (Task 82)", () => {
	test.describe.configure({ mode: "serial" });
	test.beforeAll(() => harness("/e2e/lichess/watch-reset", "POST"));
	test.afterAll(() => harness("/e2e/lichess/watch-reset", "POST"));

	test("the TV: every channel drawn on the server, then live from its feed; a channel on the big board follows its game", async ({
		page,
	}) => {
		// Live pages keep their feeds open: networkidle never comes.
		await page.goto("/app/chaal/watch", { waitUntil: "load" });
		const rapid = page.locator('[data-testid="chaal-tv-card"][data-channel="rapid"]');
		await expect(rapid).toHaveAttribute("data-game", "e2eWatch");
		expect(await page.getByTestId("chaal-tv-card").count()).toBeGreaterThan(5);
		await expect(page.getByTestId("chaal-streamer").first()).toBeVisible();
		await expect(page.getByTestId("chaal-nav-watch")).toHaveAttribute("aria-current", "page");
		await expect.poll(async () => (await watchStreams()).feeds.rapid ?? 0).toBeGreaterThan(0);
		// 3. Bb5 on Lichess: the card's diagram moves.
		await harness("/e2e/lichess/watch-move", "POST", { uci: "f1b5", wc: 590 });
		await expect(rapid).toHaveAttribute("data-fen", /^r1bqkbnr\/pppp1ppp\/2n5\/1B2p3\//);

		await rapid.getByRole("link").click();
		await expect(page).toHaveURL(/\/app\/chaal\/watch\/rapid$/);
		const board = page.getByTestId("chaal-channel-board");
		await expect(board).toHaveAttribute("data-game", "e2eWatch");
		await expect(board.locator('[data-at="b5"][data-piece="wB"]')).toBeVisible();
		await expect(page.getByTestId("chaal-watch-live")).toHaveAttribute("data-link", "open");
		await harness("/e2e/lichess/watch-move", "POST", { uci: "a7a6", bc: 580 });
		await expect(board.locator('[data-at="a6"][data-piece="bP"]')).toBeVisible();
		await expect(page.getByTestId("chaal-channel-others").getByTestId("chaal-channel-link").first()).toBeVisible();
	});

	test("a channel Chaal doesn't show is its 404", async ({ page, guard }) => {
		guard.allow(RESOURCE_STATUS(404));
		const response = await page.goto("/app/chaal/watch/horde");
		expect(response?.status()).toBe(404);
	});

	test("following a game being played: its moves so far, each new one, looking back, and how it ended", async ({
		page,
	}) => {
		await page.goto("/app/chaal/watch/rapid", { waitUntil: "load" });
		await page.getByTestId("chaal-channel-follow").click();
		await expect(page).toHaveURL(/\/app\/chaal\/game\/e2eWatch$/);
		const board = page.getByTestId("chaal-spectate-board");
		await expect(board).toHaveAttribute("data-ply", "6");
		await expect.poll(async () => (await watchStreams()).game).toBeGreaterThan(0);
		await harness("/e2e/lichess/watch-move", "POST", { uci: "b5a4" });
		await expect(board).toHaveAttribute("data-ply", "7");
		await expect(board.locator('[data-at="a4"][data-piece="wB"]')).toBeVisible();
		// Looking back keeps the board where it is while moves come in.
		await page.getByRole("button", { name: "Start position" }).click();
		await expect(board).toHaveAttribute("data-ply", "0");
		await harness("/e2e/lichess/watch-move", "POST", { uci: "g8f6" });
		await expect(page.getByTestId("chaal-spectate-note")).toContainText("earlier move");
		await expect(board).toHaveAttribute("data-ply", "0");
		await page.getByTestId("chaal-spectate-live").click();
		await expect(board).toHaveAttribute("data-ply", "8");
		await harness("/e2e/lichess/watch-end", "POST", { status: "resign", winner: "white" });
		await expect(page.getByTestId("chaal-result")).toBeVisible();
	});

	test("broadcasts: live now, the official ones, a search, a tournament's rounds and a finished round's board replayed", async ({
		page,
	}) => {
		await page.goto("/app/chaal/broadcasts", { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-broadcasts-live").getByTestId("chaal-broadcast-row").first()).toBeVisible();
		await expect(page.getByTestId("chaal-nav-watch")).toHaveAttribute("aria-current", "page");
		await page.getByTestId("chaal-broadcasts-official").click();
		await expect(page).toHaveURL(/view=official/);
		await expect(page.getByTestId("chaal-broadcasts-official").getByTestId("chaal-broadcast-row")).toHaveCount(20);
		await page.getByTestId("chaal-broadcasts-q").fill("spice");
		await page.getByTestId("chaal-broadcasts-q").press("Enter");
		await expect(page).toHaveURL(/q=spice/);
		await expect(page.locator(`[data-testid="chaal-broadcast-row"][data-tour="${TOUR}"]`)).toBeVisible();

		await page.goto(`/app/chaal/broadcasts/${TOUR}`, { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-broadcast-name")).toContainText("SPICE");
		await expect(page.getByTestId("chaal-broadcast-round")).toHaveCount(9);
		await expect(page.locator('[data-testid="chaal-broadcast-round"][data-round="9gsZmGXg"]')).toHaveAttribute(
			"aria-current",
			"page",
		);
		await page.getByTestId("chaal-broadcast-board").first().getByRole("link").click();
		await expect(page).toHaveURL(/board=qA1AQnT5/);
		const focused = page.getByTestId("chaal-broadcast-focus-board");
		await expect(page.getByTestId("chaal-result")).toBeVisible();
		await page.keyboard.press("Home");
		await expect(focused).toHaveAttribute("data-ply", "0");
		await page.getByTestId("chaal-broadcast-all-boards").click();
		await expect(page.getByTestId("chaal-broadcast-boards")).toBeVisible();
	});

	test("a round being played: its boards follow the round's PGN stream, and a followed board takes each move", async ({
		page,
	}) => {
		await page.goto(`/app/chaal/broadcasts/${TOUR}?round=${LIVE_ROUND}`, { waitUntil: "load" });
		await expect(page.getByTestId("chaal-watch-live")).toBeVisible();
		await expect.poll(async () => (await watchStreams()).rounds[LIVE_ROUND] ?? 0).toBeGreaterThan(0);
		await harness("/e2e/lichess/round-push", "POST", { round: LIVE_ROUND, pgn: boardPgn("1. e4 e5 2. Nf3") });
		const board = page.locator(`[data-testid="chaal-broadcast-board"][data-board="${LIVE_BOARD}"]`);
		await expect(board).toHaveAttribute("data-fen", "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2");
		await board.getByRole("link").click();
		const focused = page.getByTestId("chaal-broadcast-focus-board");
		await expect(focused).toHaveAttribute("data-ply", "3");
		await harness("/e2e/lichess/round-push", "POST", { round: LIVE_ROUND, pgn: boardPgn("1. e4 e5 2. Nf3 Nc6") });
		await expect(focused).toHaveAttribute("data-ply", "4");
		await expect(focused.locator('[data-at="c6"][data-piece="bN"]')).toBeVisible();
	});
});

// --- Community (Task 83) ----------------------------------------------------------------------

/** The fake's arena being played (e2e/harness/lichess-community.ts) and a recorded finished one. */
const ARENA_PLAYED = "e2eArena";
const ARENA_FINISHED = "aEMoQUDF";
/** Task 84 features the recorded arena. */
const TOUR_ARENA = ARENA_FINISHED;
const RECORDED_TEAM = "lichess-swiss";
const RECORDED_STUDY = "Zwqt6BdF";
const NEXT_MOVE = /^Next move$/;

const community = async (account: string) =>
	(await (await harness(`/e2e/lichess/community?account=${account}`, "GET")).json()) as {
		arenas: Record<string, { withdraw: boolean; form: Record<string, string> }>;
		teams: string[];
		chapters: Array<{ id: string; name: string }>;
	};

test.describe("Chaal's community for a visitor (Task 83)", () => {
	test.describe.configure({ mode: "serial" });

	test("the arenas' lists open an arena: its podium, its standings a page at a time, and Connect to join one", async ({
		page,
	}) => {
		await page.goto("/app/chaal/tournaments?view=finished");
		await page.locator(`[data-testid=chaal-arena-row][data-tournament=${ARENA_FINISHED}] a`).click();
		await page.waitForURL(new RegExp(`/app/chaal/tournaments/${ARENA_FINISHED}$`));
		await expect(page.getByTestId("chaal-tournament-podium")).toBeVisible();
		const first = page.getByTestId("chaal-standing").first();
		await expect(first).toContainText("1");
		await page.getByTestId("chaal-tournament-pages-next").click();
		await page.waitForURL(/\?page=2$/);
		await expect(page.getByTestId("chaal-standing").first().locator("td").first()).toHaveText("11");
		// Finished: nothing to join.
		await expect(page.getByTestId("chaal-tournament-join")).toHaveCount(0);

		await page.goto(`/app/chaal/tournaments/${ARENA_PLAYED}`);
		await expect(page.getByTestId("chaal-tournament-connect")).toBeVisible();
	});

	test("a team found by search; the recorded team's members and Swiss tournaments; a Swiss tournament's standings", async ({
		page,
	}) => {
		await page.goto("/app/chaal/teams");
		await page.getByTestId("chaal-teams-q").fill("nepal");
		await page.getByTestId("chaal-teams-q").press("Enter");
		await page.waitForURL(/\/app\/chaal\/teams\?q=nepal$/);
		await expect(page.getByTestId("chaal-team-row").first()).toBeVisible();

		await page.goto(`/app/chaal/teams/${RECORDED_TEAM}`);
		await expect(page.getByTestId("chaal-team-members").locator("li")).toHaveCount(30);
		await page.getByTestId("chaal-swiss-row").first().locator("a").click();
		await page.waitForURL(/\/app\/chaal\/tournaments\/[A-Za-z0-9]{8}\?kind=swiss$/);
		await expect(page.getByTestId("chaal-tournament-name")).toBeVisible();

		await page.goto("/app/chaal/tournaments/DeKa4OGD?kind=swiss");
		await expect(page.getByTestId("chaal-standing")).toHaveCount(20);
	});

	test("studies: Lichess's list opens a study; a chapter steps with the keys and Analyse takes its line", async ({
		page,
	}) => {
		await page.goto("/app/chaal/studies");
		await page.locator(`[data-testid=chaal-study-row][data-study=${RECORDED_STUDY}] a`).click();
		await page.waitForURL(new RegExp(`/app/chaal/studies/${RECORDED_STUDY}$`));
		await page.getByTestId("chaal-study-chapter").nth(1).click();
		await page.waitForURL(/\?chapter=[A-Za-z0-9]{8}$/);
		const analyse = page.getByTestId("chaal-study-analyse");
		await expect(analyse).not.toHaveAttribute("href", /moves=/);
		await page.getByTestId("chaal-study-viewer").getByRole("button", { name: NEXT_MOVE }).click();
		await expect(analyse).toHaveAttribute("href", /moves=/);

		// A study's address opens it too.
		await page.goto("/app/chaal/studies");
		await page.getByTestId("chaal-studies-open-input").fill(`https://lichess.org/study/${RECORDED_STUDY}`);
		await page.getByTestId("chaal-studies-open-input").press("Enter");
		await page.waitForURL(new RegExp(`/app/chaal/studies/${RECORDED_STUDY}$`));
		await expect(page.getByTestId("chaal-study-viewer")).toBeVisible();
	});
});

test.describe("Chaal's community connected to Lichess (Task 83)", () => {
	// Not the review's viewer: Lichess allows one event stream per token (Task 77).
	test.use(signedIn("member"));
	test.describe.configure({ mode: "serial" });

	test.beforeAll(async () => {
		await harness("/e2e/lichess", "DELETE");
		await harness("/e2e/chaal-connections", "DELETE");
	});
	test.afterAll(async () => {
		await harness("/e2e/lichess", "DELETE");
		await harness("/e2e/chaal-connections", "DELETE");
	});

	test("joins an arena being played with pair-me-ASAP, is in it, and pauses", async ({ page }) => {
		await page.goto("/app/chaal/settings", { waitUntil: "networkidle" });
		await page.getByTestId("chaal-settings-connect").click();
		const opened = eventStreamOpened(page);
		await page.getByRole("button", { name: "Approve" }).click();
		await page.waitForURL(/\/app\/chaal\/settings\?lichess=connected$/);
		await opened;

		const streamOpen = eventStreamOpened(page);
		await page.goto(`/app/chaal/tournaments/${ARENA_PLAYED}`);
		await streamOpen;
		await page.getByTestId("chaal-tournament-asap").click();
		await page.getByTestId("chaal-tournament-join").click();
		await expect(page.getByTestId("chaal-tournament-joined")).toBeVisible();
		await expect
			.poll(async () => (await community("e2e_player")).arenas[ARENA_PLAYED]?.form)
			.toEqual({ pairMeAsap: "true" });

		await page.getByTestId("chaal-tournament-withdraw").click();
		await expect(page.getByTestId("chaal-tournament-join")).toBeVisible();
		await expect.poll(async () => (await community("e2e_player")).arenas[ARENA_PLAYED]?.withdraw).toBe(true);
	});

	test("joins an open team, finds it among My teams, and leaves it", async ({ page }) => {
		const streamOpen = eventStreamOpened(page);
		await page.goto(`/app/chaal/teams/${RECORDED_TEAM}`);
		await streamOpen;
		await page.getByTestId("chaal-team-join").click();
		await expect(page.getByTestId("chaal-team-joined")).toBeVisible();
		await expect.poll(async () => (await community("e2e_player")).teams).toEqual([RECORDED_TEAM]);

		await page.goto("/app/chaal/teams?view=mine");
		await expect(page.locator(`[data-testid=chaal-team-row][data-team=${RECORDED_TEAM}]`)).toBeVisible();

		const streamAgain = eventStreamOpened(page);
		await page.goto(`/app/chaal/teams/${RECORDED_TEAM}`);
		await streamAgain;
		await page.getByTestId("chaal-team-leave").click();
		await expect(page.getByTestId("chaal-team-join")).toBeVisible();
		await expect.poll(async () => (await community("e2e_player")).teams).toEqual([]);
	});

	test("saves the analysis board to a study, then opens the new chapter", async ({ page }) => {
		// The event stream stays open (a connected player): the network never goes idle.
		await page.goto("/app/chaal/analysis?moves=e2e4_e7e5_g1f3", { waitUntil: "load" });
		await page.getByTestId("chaal-analysis-menu").click();
		await page.getByTestId("chaal-save-study-open").click();
		await page.getByTestId("chaal-save-study-name").fill("Open game");
		await page.getByTestId("chaal-save-study-submit").click();
		await expect
			.poll(async () => (await community("e2e_player")).chapters.map((chapter) => chapter.name))
			.toEqual(["Open game"]);

		await page.goto("/app/chaal/studies?view=mine");
		await page.getByTestId("chaal-study-row").first().locator("a").click();
		await page.getByTestId("chaal-study-chapter").nth(1).click();
		await expect(page.getByTestId("chaal-study-chapter-name")).toHaveText("Open game");
	});
});

test.describe("Chaal's curation (Task 84)", () => {
	test.use(signedIn("admin"));
	test.describe.configure({ mode: "serial" });

	const reset = () => harness("/e2e/chaal-connections", "DELETE");
	test.beforeEach(reset);
	test.afterAll(reset);

	/** Waits for the next server function's POST and checks it worked. */
	const saved = (page: Page) =>
		page.waitForResponse(
			(response) => response.url().includes("/_serverFn/") && response.request().method() === "POST",
		);

	test("an arena featured from its Lichess address leads the home's tournaments and opens there", async ({ page }) => {
		await page.goto("/admin/chaal/curation?tab=tournaments", { waitUntil: "networkidle" });
		await page.getByTestId("chaal-featured-add").click();
		const dialog = page.getByTestId("chaal-featured-dialog");
		await dialog.getByLabel("Lichess id or address").fill(`https://lichess.org/tournament/${TOUR_ARENA}`);
		await dialog
			.getByRole("textbox", { name: /^Title/ })
			.first()
			.fill("Club arena");
		const created = saved(page);
		await dialog.getByRole("button", { name: "Feature" }).click();
		expect((await created).ok()).toBe(true);
		await expect(page.getByTestId("chaal-featured-row")).toContainText(TOUR_ARENA);

		// The same arena twice is refused on its field.
		await page.getByTestId("chaal-featured-add").click();
		await dialog.getByLabel("Lichess id or address").fill(TOUR_ARENA);
		await dialog
			.getByRole("textbox", { name: /^Title/ })
			.first()
			.fill("Again");
		await dialog.getByRole("button", { name: "Feature" }).click();
		await expect(dialog.getByText("This is already featured.", { exact: true })).toBeVisible();
		await dialog.getByRole("button", { name: "Cancel" }).click();

		await page.goto("/app/chaal", { waitUntil: "networkidle" });
		const tournaments = page.getByTestId("chaal-home-tournaments");
		await expect(tournaments.getByRole("link", { name: /Club arena/ })).toBeVisible();
		await tournaments.getByRole("link", { name: /Club arena/ }).click();
		await page.waitForURL(new RegExp(`/app/chaal/tournaments/${TOUR_ARENA}$`));
	});

	test("the announcement and the sections' order reach the home; the review passes with them", async ({ page }) => {
		await page.goto("/admin/chaal/curation?tab=home", { waitUntil: "networkidle" });
		const form = page.getByTestId("chaal-announcement-form");
		await form.getByRole("textbox").first().fill("Club night moves to Friday.");
		const announced = saved(page);
		await form.getByRole("button", { name: "Save" }).click();
		expect((await announced).ok()).toBe(true);

		await page.getByRole("switch", { name: "Show Start here" }).click();
		const ordered = saved(page);
		await page.getByTestId("chaal-home-sections-save").click();
		expect((await ordered).ok()).toBe(true);

		await page.goto("/app/chaal", { waitUntil: "networkidle" });
		await expect(page.getByTestId("chaal-home-announcement")).toContainText("Club night moves to Friday.");
		await expect(page.getByTestId("chaal-entry-play")).toHaveCount(0);
		await reviewPage(page, "/app/chaal");
	});
});

/**
 * Task 85's accessibility pass, kept as a flow: a whole game, a puzzle and an analysis with
 * the keyboard alone. Each control is reached with Tab (never clicked or focused directly);
 * moves are played on the board's grid with the arrows and Enter, or typed after `/`.
 */
test.describe("Chaal by keyboard only (Task 85)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ harness }) => {
		await harness.resetRateLimits();
	});

	/** Presses Tab until `target` has focus: proof it can be reached without a mouse. */
	const tabTo = async (page: Page, target: ReturnType<Page["locator"]>, limit = 80) => {
		for (let presses = 0; presses < limit; presses += 1) {
			if (await target.evaluate((element) => element === document.activeElement)) return;
			await page.keyboard.press("Tab");
		}
		throw new Error(`not reached with ${limit} presses of Tab`);
	};

	/** Moves the grid's cursor to a square with the arrows, then presses Enter there. */
	const cursorTo = async (page: Page, grid: ReturnType<Page["locator"]>, square: string) => {
		const white = (await grid.locator("[data-square]").first().getAttribute("data-square")) === "a8";
		const at = ((await grid.getAttribute("aria-activedescendant")) ?? "").slice(-2);
		const files = (square.charCodeAt(0) - at.charCodeAt(0)) * (white ? 1 : -1);
		const ranks = (Number(square[1]) - Number(at[1])) * (white ? 1 : -1);
		for (let step = 0; step < Math.abs(files); step += 1)
			await page.keyboard.press(files > 0 ? "ArrowRight" : "ArrowLeft");
		for (let step = 0; step < Math.abs(ranks); step += 1)
			await page.keyboard.press(ranks > 0 ? "ArrowUp" : "ArrowDown");
		await expect(grid).toHaveAttribute("aria-activedescendant", new RegExp(`${square}$`));
		await page.keyboard.press("Enter");
	};

	/** A move on the focused grid: Enter on the piece, then Enter on its square. */
	const gridMove = async (page: Page, grid: ReturnType<Page["locator"]>, uci: string) => {
		await cursorTo(page, grid, uci.slice(0, 2));
		await cursorTo(page, grid, uci.slice(2, 4));
	};

	test("over the board, a whole game to mate: the grid for White, typed moves for Black", async ({ page }) => {
		await page.goto("/app/chaal/play", { waitUntil: "networkidle" });
		await tabTo(page, page.getByTestId("chaal-play-board-start"));
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(/\/app\/chaal\/local\//);
		const grid = page.getByTestId("chaal-local-board").getByRole("grid");
		const moves = page.getByTestId("chaal-moves").filter({ visible: true }).locator("[data-node]");
		const typed = async (san: string) => {
			await page.keyboard.press("/");
			await page.keyboard.type(san);
			await page.keyboard.press("Enter");
		};
		await tabTo(page, grid);
		await gridMove(page, grid, "f2f3");
		await expect(moves).toHaveCount(1);
		await typed("e5");
		await expect(moves).toHaveCount(2);
		await tabTo(page, grid);
		await gridMove(page, grid, "g2g4");
		await expect(moves).toHaveCount(3);
		await typed("Qh4");
		await expect(page.getByTestId("chaal-result")).toContainText("Black wins");
	});

	test("a puzzle solved on the grid", async ({ page }) => {
		await page.goto("/app/chaal/puzzles", { waitUntil: "networkidle" });
		const board = page.getByTestId("chaal-puzzle-board");
		const { puzzle } = await fakePuzzle((await board.getAttribute("data-puzzle")) ?? "");
		const grid = board.getByRole("grid");
		await tabTo(page, grid);
		for (let index = 0; index < puzzle.solution.length; index += 2) {
			await expect(board).toHaveAttribute("data-phase", "play");
			await gridMove(page, grid, puzzle.solution[index] ?? "");
		}
		await expect(page.getByTestId("chaal-puzzle-status")).toHaveAttribute("data-won", "true");
	});

	test("an analysis: moves on the grid and typed, a step back with the arrows, and the engine switched on", async ({
		page,
	}) => {
		await page.goto("/app/chaal/analysis", { waitUntil: "networkidle" });
		const grid = page.getByTestId("chaal-analysis-board").getByRole("grid");
		await tabTo(page, grid);
		await gridMove(page, grid, "e2e4");
		await page.keyboard.press("/");
		await page.keyboard.type("c5");
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(/\?moves=e2e4_c7c5$/);
		await tabTo(page, page.getByRole("button", { name: "Previous move" }));
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(/moves=e2e4_c7c5&ply=1$/);
		await tabTo(page, page.getByTestId("chaal-engine-switch"));
		await page.keyboard.press("Space");
		await expect(page.getByTestId("chaal-engine-lines").locator("li").first()).toBeVisible({ timeout: 30_000 });
	});
});
