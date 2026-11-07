/**
 * Taskline (decisions 0208–0213): a visitor tries the sandbox from the landing and
 * works in it as a guest; a team member signs in on Taskline's own page and sees the
 * team's projects, but not a private one they aren't on; a workspace's address opens
 * its projects, and an unknown one is a 404 inside the frame. On the board a task
 * moves by keyboard and opens by its own address; a guest keeps their sandbox on
 * signing up (the emailed link) or in (two-factor and the claim cookie); Kanban's old
 * addresses redirect. From the admin, a project is created and someone invited to it, who
 * signs up from the email and lands in it, and gets a 404 once deactivated.
 * Collaboration (Task 50, 0214): assigning someone reaches their inbox and their email,
 * and an `@` mention in a comment emails the one mentioned. Finding things (Task 51):
 * tasks imported from CSV, one rescheduled on the calendar by keyboard, a view shared
 * with the project and opened by another member, search and an exact reference. Sprints
 * (Task 52): a guest plans a sprint, moves a task into it by keyboard, completes the
 * active one (its open tasks carried on) and starts the next, then reads the reports.
 * Time (Task 53): a guest's timer survives a reload and stops from the topbar, time is
 * logged by hand and typed in the timesheet; an admin's lock makes the days up to it
 * read only and refuses logging there. Timeline and dependencies (Task 54): a guest
 * reschedules a task on the timeline by keyboard and reads the milestones; with the
 * project's rule on, a blocked task can't be completed until its blockers are. Custom fields
 * (Task 55): a lead adds a choice field, filters by it, and a required one stops Done.
 * Automations (Task 56): a rule built in a project's settings acts when a task is done,
 * logs its run, and tells the project's lead.
 */
import type { Page } from "@playwright/test";
import { E2E } from "../harness/config.ts";
import { authFetch, expect, RESOURCE_STATUS, signedIn, test } from "../support/fixtures.ts";
import { totp } from "../support/totp.ts";
import { createVerifiedUser, linkIn, uniqueEmail } from "../support/users.ts";

/** Opens a page and waits until it's hydrated (no requests in flight). */
const open = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

/** Signs in on Taskline's sign-in page as a seeded member of the demo team. */
async function signInAs(page: Page, email: string) {
	await open(page, "/app/taskline/sign-in");
	await page.getByRole("textbox", { name: "Email" }).fill(email);
	await page.getByRole("textbox", { name: "Password" }).fill(E2E.password);
	await page.getByRole("button", { name: "Log in" }).click();
	await expect(page).toHaveURL(/\/app\/taskline\/home$/);
}

/** A board column's tasks, by the column's heading, in the order shown. */
const tasksIn = (page: Page, status: string) =>
	page
		.getByTestId("taskline-column")
		.filter({ has: page.getByRole("heading", { level: 3, name: status, exact: true }) })
		.getByTestId("taskline-card-title");

const nextSave = (page: Page) =>
	page.waitForResponse((response) => response.url().includes("/_serverFn/") && response.request().method() === "POST");

/** Adds a task at the foot of "To do", then moves it one column right with Alt + →, both saved. */
async function addAndMove(page: Page, title: string) {
	const todo = page
		.getByTestId("taskline-column")
		.filter({ has: page.getByRole("heading", { level: 3, name: "To do", exact: true }) });
	await todo.getByTestId("taskline-add-task-open").click();
	const field = todo.getByRole("textbox", { name: "New task in To do" });
	await field.fill(title);
	const added = nextSave(page);
	await field.press("Enter");
	await added;
	// Once the server has numbered it, its title opens it.
	await expect(todo.getByTestId("taskline-card-open").filter({ hasText: title })).toBeVisible();
	await page.getByRole("button", { name: `Move task ${title}` }).focus();
	const moved = nextSave(page);
	await page.keyboard.press("Alt+ArrowRight");
	await expect(page.getByTestId("taskline-announcement")).toHaveText(new RegExp(`${title} moved to In progress`));
	await moved;
	await expect(tasksIn(page, "In progress")).toContainText([title]);
}

/** "Try the sandbox" on the landing, then the sample project's board. */
async function startGuest(page: Page) {
	await open(page, "/app/taskline");
	await page.getByTestId("try-sandbox").click();
	await expect(page).toHaveURL(/\/app\/taskline\/home$/);
	await expect(page.getByTestId("guest-banner")).toBeVisible();
	await open(page, "/app/taskline/sandbox/p/WEB/board");
}

/** The sandbox as the account sees it: the guest's move is there. */
async function sandboxKept(page: Page, title: string) {
	await open(page, "/app/taskline/sandbox/p/WEB/board");
	await expect(page.getByTestId("guest-banner")).toHaveCount(0);
	await expect(tasksIn(page, "In progress")).toContainText([title]);
}

test.describe("Taskline", () => {
	test("a visitor tries the sandbox from the landing", async ({ page, harness }) => {
		await harness.resetRateLimits();
		await open(page, "/app/taskline");
		await expect(page.getByRole("heading", { level: 1 })).toContainText("Plan the work");
		await page.getByTestId("try-sandbox").click();
		await expect(page).toHaveURL(/\/app\/taskline\/home$/);
		await expect(page.getByTestId("guest-banner")).toBeVisible();
		await expect(page.getByTestId("taskline-sidebar")).toBeVisible();
		// No other section's chrome: the apps' switcher isn't here.
		await expect(page.getByTestId("app-switcher")).toHaveCount(0);
		await expect(page.getByTestId("recent-projects")).toContainText("Website relaunch");

		await page.getByTestId("taskline-sidebar").getByRole("link", { name: "Projects" }).click();
		await expect(page).toHaveURL(/\/app\/taskline\/sandbox\/projects$/);
		await page.getByTestId("project-cards").getByRole("link", { name: "Website relaunch" }).click();
		await expect(page.getByRole("heading", { level: 1, name: "Website relaunch" })).toBeVisible();
		await expect(page.getByTestId("project-statuses")).toContainText("In progress");

		// The landing sends a signed-in visitor (a guest too) straight to Home.
		await open(page, "/app/taskline");
		await expect(page).toHaveURL(/\/app\/taskline\/home$/);
	});

	test("a member sees the team's projects, and not a private one they aren't on", async ({ page, harness, guard }) => {
		await harness.resetRateLimits();
		await signInAs(page, "asha@taskline.example.com");
		await expect(page.getByTestId("my-tasks")).toBeVisible();

		await page.getByTestId("taskline-sidebar").getByRole("link", { name: "Projects" }).click();
		await expect(page).toHaveURL(/\/app\/taskline\/team\/projects$/);
		const cards = page.getByTestId("project-cards");
		await expect(cards.getByRole("link", { name: "Website relaunch" })).toBeVisible();
		await expect(cards.getByRole("link", { name: "Mobile app" })).toBeVisible();
		await expect(cards.getByRole("link", { name: "Operations" })).toHaveCount(0);
		// The private project is simply not there for them: a 404 page.
		guard.allow(RESOURCE_STATUS(404));
		await open(page, "/app/taskline/team/p/OPS");
		await expect(page.getByTestId("not-found-page")).toBeVisible();
		await expect(page.getByTestId("taskline-sidebar")).toBeVisible();

		// Stars show in the sidebar.
		await open(page, "/app/taskline/team/projects");
		await page.getByTestId("star-WEB").click();
		await expect(page.getByTestId("nav-starred")).toContainText("Website relaunch");
		await page.getByTestId("star-WEB").click();
		await expect(page.getByTestId("nav-starred")).toHaveCount(0);

		// The palette finds a project by its key.
		await page.keyboard.press("Control+k");
		await page.getByTestId("command-input").fill("APP");
		await page.keyboard.press("Enter");
		await expect(page.getByRole("heading", { level: 1, name: "Mobile app" })).toBeVisible();
	});

	test("a workspace opens on its projects, and an unknown one is a 404 in the frame", async ({
		page,
		harness,
		guard,
	}) => {
		await harness.resetRateLimits();
		await signInAs(page, "bikash@taskline.example.com");
		await open(page, "/app/taskline/team");
		await expect(page).toHaveURL(/\/app\/taskline\/team\/projects$/);
		// Bikash is on the private project.
		await expect(page.getByTestId("project-cards").getByRole("link", { name: "Operations" })).toBeVisible();
		guard.allow(RESOURCE_STATUS(404));
		const response = await page.goto("/app/taskline/elsewhere/projects");
		expect(response?.status()).toBe(404);
		await expect(page.getByTestId("not-found-page")).toBeVisible();
		await expect(page.getByRole("link", { name: "Go to Taskline" })).toBeVisible();
	});

	test("a visitor is sent to Taskline's own sign-in, and comes back", async ({ page }) => {
		await open(page, "/app/taskline/home");
		await expect(page).toHaveURL(/\/app\/taskline\/sign-in\?redirect=/);
		await expect(page.getByTestId("taskline-auth-panel")).toBeAttached();
		await expect(page.getByRole("heading", { level: 1, name: "Sign in to Taskline" })).toBeVisible();
	});

	test("a member moves a task by keyboard and opens it by its address", async ({ page, harness }) => {
		await harness.resetRateLimits();
		await signInAs(page, "asha@taskline.example.com");
		await open(page, "/app/taskline/team/p/WEB/board");
		const title = `Moved by keyboard ${Date.now()}`;
		await addAndMove(page, title);
		// Saved: a reload (server-rendered from the database) shows it moved.
		await page.reload({ waitUntil: "networkidle" });
		await expect(tasksIn(page, "In progress")).toContainText([title]);

		// It opens in a sheet over the board, at its own address.
		await page.getByTestId("taskline-card-open").filter({ hasText: title }).click();
		await expect(page.getByTestId("task-sheet")).toBeVisible();
		await expect(page).toHaveURL(/\/app\/taskline\/team\/t\/WEB-\d+$/);
		// That address, opened anew, is the task's page.
		await open(page, page.url());
		await expect(page.getByTestId("task-page")).toBeVisible();
		await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
	});

	test("a member imports tasks, reschedules one on the calendar by keyboard, shares a view and finds them", async ({
		page,
		browser,
		harness,
	}) => {
		await harness.resetRateLimits();
		await signInAs(page, "asha@taskline.example.com");
		// Not all digits: a numeric `?q=` would be read as a number by the router and dropped.
		const stamp = `k${Date.now()}`;
		const day = (offset: number) =>
			new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(
				new Date(Date.now() + offset * 86_400_000),
			);

		// The import: pasted CSV, previewed, imported once.
		await open(page, "/app/taskline/team/p/WEB/list");
		await page.getByTestId("import-open").click();
		const dialog = page.getByTestId("import-dialog");
		await dialog
			.getByTestId("import-paste")
			.fill(`Title,Due date,Labels\nImported A ${stamp},${day(0)},\nImported B ${stamp},,`);
		await dialog.getByTestId("import-paste-read").click();
		await expect(dialog.getByTestId("import-summary")).toContainText("Ready to import: 2");
		const imported = nextSave(page);
		await dialog.getByTestId("import-submit").click();
		await imported;
		await expect(page.getByText("Tasks imported: 2")).toBeVisible();
		await expect(dialog).toHaveCount(0);

		// The calendar: Alt + → moves the dated one a day later, saved.
		await open(page, `/app/taskline/team/p/WEB/calendar?date=${day(0)}`);
		const handle = page.getByRole("button", { name: `Reschedule Imported A ${stamp}` });
		await handle.focus();
		const moved = nextSave(page);
		await page.keyboard.press("Alt+ArrowRight");
		await expect(page.getByTestId("taskline-announcement")).toContainText(`Imported A ${stamp} moved to`);
		await moved;
		await expect(page.getByTestId("calendar-undated")).toContainText(`Imported B ${stamp}`);
		await open(page, `/app/taskline/team/p/WEB/calendar?date=${day(1)}`);
		await expect(page.locator(`[data-day="${day(1)}"]`)).toContainText(`Imported A ${stamp}`);

		// A view shared with the project: another member opens it from their menu.
		await open(page, `/app/taskline/team/p/WEB/list?q=${stamp}`);
		await page.getByTestId("saved-views").click();
		await page.getByTestId("saved-view-name").fill(`Imports ${stamp}`);
		await page.getByTestId("saved-view-share").click();
		const saved = nextSave(page);
		await page.getByTestId("saved-view-save").click();
		await saved;
		await expect(page.getByTestId("saved-views-list")).toContainText(`Imports ${stamp}`);
		const other = await browser.newPage();
		await signInAs(other, "bikash@taskline.example.com");
		await open(other, "/app/taskline/team/p/WEB/list");
		await other.getByTestId("saved-views").click();
		await other.getByRole("button", { name: new RegExp(`Imports ${stamp}`) }).click();
		await expect(other).toHaveURL(/[?&]q=/);
		await expect(other.getByTestId("task-row-open")).toHaveText([`Imported A ${stamp}`, `Imported B ${stamp}`]);
		await other.close();

		// Search: words find both; an exact reference goes straight to the task.
		await open(page, `/app/taskline/team/search?q=${encodeURIComponent(`imported ${stamp}`)}`);
		await expect(page.getByTestId("search-result")).toHaveCount(2);
		await page.getByTestId("search-input").fill("web-1");
		await page.getByTestId("search-submit").click();
		await expect(page).toHaveURL(/\/app\/taskline\/team\/t\/WEB-1$/);
	});

	test("assigning reaches the assignee's inbox and email, and a mention in a comment emails the one mentioned", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		await signInAs(page, "asha@taskline.example.com");
		await open(page, "/app/taskline/team/p/WEB/board");
		const title = `Needs a reviewer ${Date.now()}`;
		const todo = page
			.getByTestId("taskline-column")
			.filter({ has: page.getByRole("heading", { level: 3, name: "To do", exact: true }) });
		await todo.getByTestId("taskline-add-task-open").click();
		const field = todo.getByRole("textbox", { name: "New task in To do" });
		await field.fill(title);
		const added = nextSave(page);
		await field.press("Enter");
		await added;
		await todo.getByTestId("taskline-card-open").filter({ hasText: title }).click();
		await expect(page.getByTestId("task-sheet")).toBeVisible();
		const ref = /\/t\/(WEB-\d+)$/.exec(page.url())?.[1] ?? "";
		expect(ref).not.toBe("");

		// Assigning Sita: an email at once (her default for being assigned).
		const assigned = nextSave(page);
		await page.getByTestId("task-assignee").selectOption({ label: "Sita Rai" });
		await assigned;
		await expect
			.poll(async () =>
				(await harness.emails("sita@taskline.example.com")).some(
					(email) => email.tag === "taskline-notification" && email.subject.includes(ref),
				),
			)
			.toBe(true);
		const sent = (await harness.emails("sita@taskline.example.com")).find((email) => email.subject.includes(ref));
		expect(sent?.text).toContain(`Asha Gurung assigned you ${ref}`);

		// A comment mentioning Bikash: he's picked from the suggestions, and emailed.
		await page.getByTestId("task-tab-comments").click();
		const box = page.getByRole("textbox", { name: "Add a comment" });
		await box.click();
		await box.pressSequentially("@Bik");
		await page.getByTestId("mention-list").getByRole("option", { name: "Bikash Thapa" }).click();
		await box.pressSequentially("could you review this?");
		const commented = nextSave(page);
		await page.getByTestId("comment-box").getByRole("button", { name: "Comment" }).click();
		await commented;
		await expect(page.getByTestId("task-comment").last()).toContainText("@Bikash Thapa");
		await expect
			.poll(async () =>
				(await harness.emails("bikash@taskline.example.com")).some(
					(email) => email.tag === "taskline-notification" && email.text.includes(`mentioned you on ${ref}`),
				),
			)
			.toBe(true);

		// Sita's inbox has it, unread; opening it marks it read.
		await page.context().clearCookies();
		await signInAs(page, "sita@taskline.example.com");
		await expect(page.getByTestId("nav-inbox-badge")).toBeVisible();
		await page.getByTestId("nav-inbox").click();
		await expect(page).toHaveURL(/\/app\/taskline\/inbox$/);
		const item = page.getByTestId("inbox-item").filter({ hasText: `Asha Gurung assigned you ${ref}` });
		await expect(item).toBeVisible();
		await item.getByRole("link").click();
		await expect(page).toHaveURL(new RegExp(`/app/taskline/team/t/${ref}$`));
		await open(page, "/app/taskline/inbox?filter=all");
		await expect(page.getByTestId("inbox-item").filter({ hasText: `assigned you ${ref}` })).toHaveCount(1);
		await open(page, "/app/taskline/inbox");
		await expect(page.getByTestId("inbox-item").filter({ hasText: `assigned you ${ref}` })).toHaveCount(0);
	});

	test("Kanban's old addresses redirect to Taskline", async ({ page, harness }) => {
		const landing = await fetch(new URL("/apps/kanban", E2E.baseURL), { redirect: "manual" });
		expect(landing.status).toBe(301);
		expect(landing.headers.get("location")).toMatch(/\/app\/taskline$/);

		await harness.resetRateLimits();
		await signInAs(page, "asha@taskline.example.com");
		await open(page, `/apps/kanban/${await harness.tasklineProjectId("WEB")}`);
		await expect(page).toHaveURL(/\/app\/taskline\/team\/p\/WEB\/board$/);
		await expect(page.getByTestId("taskline-board")).toBeVisible();
		// An id that is no project of theirs: Taskline itself (signed in, that's Home).
		await open(page, `/apps/kanban/${crypto.randomUUID()}`);
		await expect(page).toHaveURL(/\/app\/taskline\/home$/);
	});

	test("a guest moves a task in the sandbox, signs up, verifies and keeps it", async ({ page, harness }) => {
		await harness.resetRateLimits();
		await startGuest(page);
		await addAndMove(page, "Kept after sign-up");

		// A guest's account page is Taskline's sign-up.
		await open(page, "/app/taskline/account");
		await expect(page).toHaveURL(/\/app\/taskline\/sign-up\?redirect=/);
		const email = uniqueEmail("tl-guest");
		await page.getByLabel("Name").fill("Guest Upgrader");
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Password", { exact: true }).fill(E2E.password);
		await page.getByLabel("Confirm password").fill(E2E.password);
		await page.getByRole("button", { name: "Create account" }).click();
		await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
		const verification = await harness.nextEmail(email, "verify-email");
		await open(page, linkIn(verification.text));
		await expect(page.getByText("Your email is verified and you're signed in.")).toBeVisible();

		await sandboxKept(page, "Kept after sign-up");
	});

	test("a guest signs in to an account with two-factor and keeps the sandbox", async ({ page, harness }) => {
		await harness.resetRateLimits();
		// An account with two-factor on, set up through Better Auth's API.
		const user = await createVerifiedUser(harness, "tl-guest-2fa");
		const signIn = await authFetch("/api/auth/sign-in/email", { email: user.email, password: user.password });
		const cookie = signIn.headers
			.getSetCookie()
			.map((header) => header.split(";")[0])
			.join("; ");
		const post = (path: string, body: unknown) =>
			fetch(new URL(path, E2E.baseURL), {
				method: "POST",
				headers: { "content-type": "application/json", origin: E2E.baseURL, cookie },
				body: JSON.stringify(body),
			});
		const enabled = (await (await post("/api/auth/two-factor/enable", { password: user.password })).json()) as {
			totpURI: string;
		};
		const secret = new URL(enabled.totpURI).searchParams.get("secret") ?? "";
		expect((await post("/api/auth/two-factor/verify-totp", { code: totp(secret) })).status).toBe(200);

		await startGuest(page);
		await addAndMove(page, "Kept after two-factor");

		// The password step drops the guest's session; the code finishes the sign-in, and the
		// claim cookie brings the sandbox along.
		await open(page, "/login?redirect=/app/taskline/home");
		await page.getByLabel("Email").fill(user.email);
		await page.getByLabel("Password", { exact: true }).fill(user.password);
		await page.getByRole("button", { name: "Log in" }).click();
		await page.getByLabel("6-digit code").fill(totp(secret));
		await page.getByRole("button", { name: "Sign in" }).click();
		// The whole address: the login page's own (`?redirect=/app/taskline/home`) ends the same way.
		await expect(page).toHaveURL(new URL("/app/taskline/home", E2E.baseURL).href);

		await sandboxKept(page, "Kept after two-factor");
	});
});

test.describe("Taskline from the admin", () => {
	test.use(signedIn("admin"));

	test("an admin creates a project and invites someone, who signs up from the email and lands in it; once deactivated, it's a 404", async ({
		page,
		browser,
		harness,
	}) => {
		await harness.resetRateLimits();
		// A key of its own, so a retry against the same server doesn't meet the first attempt's project.
		const key = `L${Date.now().toString(36).slice(-4).toUpperCase()}`;
		const name = `Launch plan ${key}`;
		// A private project with no lead yet.
		await open(page, "/admin/taskline/projects/new");
		await page.getByLabel("Name").fill(name);
		await page.getByLabel("Key").fill(key);
		await page.getByRole("combobox", { name: "Who can see it" }).click();
		await page.getByRole("option", { name: "Private", exact: true }).click();
		await page.getByRole("button", { name: "Create project" }).click();
		await expect(page).toHaveURL(/\/admin\/taskline\/projects\/[0-9a-f-]{36}$/);
		await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

		// Invite a new address onto it.
		const email = uniqueEmail("tl-invite");
		await open(page, "/admin/taskline/members");
		await page.getByTestId("invite-member").click();
		const dialog = page.getByTestId("invite-member-dialog");
		await dialog.getByLabel("Email").fill(email);
		await dialog.getByRole("combobox", { name: "Start on a project" }).click();
		await page.getByRole("option", { name: `${key} · ${name}` }).click();
		await dialog.getByRole("button", { name: "Send invitation" }).click();
		await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();
		await open(page, "/admin/taskline/invitations");
		await expect(page.getByTestId("taskline-admin-invitations")).toContainText(email);

		// The invitee, in a browser of their own: the email's link, sign-up, the verification link, Continue.
		const invite = await harness.nextEmail(email, "taskline-invite");
		// Not the admin: the test's signed-in state would otherwise apply to this context too.
		const context = await browser.newContext({ baseURL: E2E.baseURL, storageState: { cookies: [], origins: [] } });
		const invitee = await context.newPage();
		await open(invitee, linkIn(invite.text));
		await expect(invitee).toHaveURL(/\/app\/taskline\/sign-up\?redirect=/);
		await invitee.getByLabel("Name").fill("Invited Ira");
		await invitee.getByLabel("Email").fill(email);
		await invitee.getByLabel("Password", { exact: true }).fill(E2E.password);
		await invitee.getByLabel("Confirm password").fill(E2E.password);
		await invitee.getByRole("button", { name: "Create account" }).click();
		await expect(invitee.getByRole("heading", { name: "Check your email" })).toBeVisible();
		const verification = await harness.nextEmail(email, "verify-email");
		await open(invitee, linkIn(verification.text));
		await invitee.getByRole("link", { name: "Continue" }).click();
		await expect(invitee).toHaveURL(new RegExp(`/app/taskline/team/p/${key}$`));
		await expect(invitee.getByRole("heading", { level: 1, name })).toBeVisible();

		// Deactivated, the project is simply not found for them.
		await open(page, "/admin/taskline/members");
		await page.getByRole("button", { name: "Actions for Invited Ira" }).click();
		await page.getByRole("menuitem", { name: "Deactivate" }).click();
		const deactivate = page.getByTestId("deactivate-member-dialog");
		await deactivate.getByRole("button", { name: "Deactivate" }).click();
		await expect(page.getByText(/Invited Ira deactivated/)).toBeVisible();
		const response = await invitee.goto(`/app/taskline/team/p/${key}`);
		expect(response?.status()).toBe(404);
		await context.close();
	});
});

test.describe("Taskline sprints", () => {
	test("a guest plans a sprint, moves a task into it by keyboard, completes the active one and starts the next", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		await startGuest(page);
		await page.getByTestId("view-backlog").click();
		await expect(page).toHaveURL(/\/app\/taskline\/sandbox\/p\/WEB\/backlog$/);
		const sprints = page.getByTestId("backlog-sprint");
		await expect(sprints).toHaveCount(2);
		await expect(sprints.first()).toHaveAttribute("data-state", "active");
		await expect(sprints.first().getByTestId("backlog-over")).toBeVisible();

		// Plan: the dialog suggests the next name and dates.
		await page.getByTestId("sprint-new").click();
		const dialog = page.getByTestId("sprint-dialog");
		await expect(dialog.getByRole("textbox", { name: "Name" })).toHaveValue("Sprint 4");
		await dialog.getByRole("button", { name: "Create sprint" }).click();
		await expect(dialog).toHaveCount(0);
		await expect(sprints).toHaveCount(3);
		await expect(sprints.nth(2).getByRole("heading", { level: 2 })).toHaveText("Sprint 4");

		// Alt + ↑ on the backlog's first task moves it into the sprint above it.
		const backlog = page.getByTestId("backlog-section");
		const title = (await backlog.getByTestId("backlog-title").first().textContent()) ?? "";
		await backlog.getByTestId("backlog-handle").first().focus();
		const moved = nextSave(page);
		await page.keyboard.press("Alt+ArrowUp");
		await expect(page.getByTestId("taskline-announcement")).toHaveText(new RegExp(`${title} moved to Sprint 4`));
		await moved;
		await expect(sprints.nth(2).getByTestId("backlog-title")).toHaveText([title]);

		// Complete the active sprint: its unfinished tasks go to the next planned one (Sprint 3).
		const carried = await sprints.first().getByTestId("backlog-title").count();
		await sprints.first().getByTestId("sprint-complete").click();
		const complete = page.getByTestId("complete-sprint-dialog");
		await expect(complete.getByRole("radio", { name: "The next planned sprint" })).toBeChecked();
		await complete.getByRole("button", { name: "Complete sprint" }).click();
		await expect(complete).toHaveCount(0);
		await expect(sprints).toHaveCount(2);
		await expect(sprints.first().getByRole("heading", { level: 2 })).toHaveText("Sprint 3");
		// The done task stayed with the completed sprint; the rest came along.
		await expect(sprints.first().getByTestId("backlog-title")).toHaveCount(carried);

		// Start Sprint 3, then read its report and the completed one's.
		await sprints.first().getByTestId("sprint-start").click();
		await expect(sprints.first()).toHaveAttribute("data-state", "active");
		await sprints.first().getByTestId("sprint-report-link").click();
		await expect(page).toHaveURL(/\/app\/taskline\/sandbox\/p\/WEB\/sprints\/[0-9a-f-]+$/);
		await expect(page.getByTestId("sprint-state")).toHaveText("Active");
		await expect(page.getByRole("heading", { name: "Burndown" })).toBeVisible();
		const switcher = page.getByTestId("sprint-switch");
		await switcher.selectOption({ label: "Sprint 2 (Completed)" });
		await expect(page.getByTestId("sprint-state")).toHaveText("Completed");
		await expect(page.getByTestId("sprint-tasks")).toBeVisible();
	});
});

/** Today (or another day) in Kathmandu, the team's and the sandbox's time zone, as YYYY-MM-DD. */
const kathmanduDay = (offset = 0) =>
	new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date(Date.now() + offset * 86_400_000));

test.describe("Taskline time", () => {
	test("a guest runs a timer that survives a reload, logs time by hand and types it in the timesheet", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		await startGuest(page);
		await open(page, "/app/taskline/sandbox/t/WEB-1");
		await page.getByTestId("task-timer-start").click();
		await expect(page.getByTestId("timer-pill")).toContainText("WEB-1");
		// The server keeps it: a reload shows it still running.
		await page.reload({ waitUntil: "networkidle" });
		await expect(page.getByTestId("timer-pill")).toContainText("WEB-1");
		await expect(page.getByTestId("task-timer-stop")).toBeVisible();
		await page.getByTestId("timer-pill-stop").click();
		// Under a minute it is dropped; on a slow machine the reload may pass a minute and log it.
		await expect(page.getByText(/^Timer stopped/)).toBeVisible();
		await expect(page.getByTestId("timer-pill")).toHaveCount(0);

		// By hand, on the task.
		await page.getByTestId("task-tab-time").click();
		await page.getByTestId("time-log-open").click();
		await page.getByTestId("time-duration").fill("1h 30m");
		const logged = nextSave(page);
		await page.getByTestId("time-submit").click();
		await logged;
		await expect(page.getByTestId("time-entries")).toContainText("1h 30m");

		// The week: WEB-1's cell for today, typed and saved, is there after a reload.
		await page.getByTestId("nav-timesheet").click();
		await expect(page).toHaveURL(/\/app\/taskline\/sandbox\/timesheet$/);
		const today = page
			.getByTestId("timesheet-row")
			.filter({ hasText: "WEB-1" })
			.locator(`[data-testid="timesheet-cell"][data-day="${kathmanduDay()}"]`);
		await today.focus();
		const saved = nextSave(page);
		await page.keyboard.type("3");
		await page.keyboard.press("Tab");
		await saved;
		await page.reload({ waitUntil: "networkidle" });
		await expect(today).toHaveValue("3:00");
	});
});

test.describe("Taskline time from the admin", () => {
	test.use(signedIn("admin"));

	test("an admin locks the days up to yesterday: they read only in the timesheet, and logging there is refused", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		const yesterday = kathmanduDay(-1);
		// The admin is on the demo team: time on WEB-2 yesterday, before the lock.
		await open(page, "/app/taskline/team/t/WEB-2");
		await page.getByTestId("task-tab-time").click();
		await page.getByTestId("time-log-open").click();
		const form = page.getByTestId("time-log-form");
		await form.getByLabel("Day").fill(yesterday);
		await form.getByTestId("time-duration").fill("1:00");
		const logged = nextSave(page);
		await form.getByTestId("time-submit").click();
		await logged;

		await open(page, "/admin/taskline/timesheets");
		await page.getByTestId("time-lock-open").click();
		const dialog = page.getByTestId("time-lock-dialog");
		await dialog.getByTestId("time-lock-day").fill(yesterday);
		await dialog.getByTestId("time-lock-save").click();
		await expect(page.getByText(/^Locked through /).first()).toBeVisible();

		try {
			// Yesterday's cell can't be typed into any more.
			await open(page, `/app/taskline/team/timesheet?week=${yesterday}`);
			const row = page.getByTestId("timesheet-row").filter({ hasText: "WEB-2" });
			await expect(row.locator(`[data-testid="timesheet-cell"][data-day="${yesterday}"]`)).toHaveCount(0);
			await expect(row.locator(`[data-testid="timesheet-cell-readonly"][data-day="${yesterday}"]`)).toContainText(
				"1:00",
			);
			// Nor logged on by hand.
			await open(page, "/app/taskline/team/t/WEB-2");
			await page.getByTestId("task-tab-time").click();
			await page.getByTestId("time-log-open").click();
			await form.getByLabel("Day").fill(yesterday);
			await form.getByTestId("time-duration").fill("30m");
			await form.getByTestId("time-submit").click();
			await expect(page.getByText(/is locked\./)).toBeVisible();
		} finally {
			// The lock is the team's: put it back for the other flows.
			await open(page, "/admin/taskline/timesheets");
			await page.getByTestId("time-lock-open").click();
			await page.getByTestId("time-lock-dialog").getByRole("button", { name: "Unlock everything" }).click();
			await expect(page.getByText("Nothing is locked").first()).toBeVisible();
		}
	});
});

test.describe("Taskline timeline and dependencies", () => {
	test("a guest reschedules a task on the timeline by keyboard, and its milestones show the progress", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		await startGuest(page);
		await page.getByTestId("view-timeline").click();
		await expect(page).toHaveURL(/\/app\/taskline\/sandbox\/p\/WEB\/timeline$/);
		await expect(page.getByTestId("timeline-milestone").first()).toBeVisible();
		await expect(page.getByTestId("timeline-arrow").first()).toBeAttached();
		// The contrast check starts before the copy it waits on is due.
		await expect(page.getByTestId("timeline-clash")).toHaveCount(1);

		const bar = page.locator('[data-timeline-bar][aria-label*="WEB-2 "]');
		const start = (await bar.getAttribute("data-start")) ?? "";
		const end = (await bar.getAttribute("data-end")) ?? "";
		await bar.focus();
		const moved = nextSave(page);
		await page.keyboard.press("Alt+ArrowRight");
		await expect(page.getByTestId("taskline-announcement")).toHaveText(/^WEB-2 .+ now runs from/);
		await moved;
		await expect(bar).toBeFocused();
		const resized = nextSave(page);
		await page.keyboard.press("Alt+Shift+ArrowRight");
		await resized;
		const plus = (day: string, days: number) => {
			const date = new Date(`${day}T12:00:00Z`);
			date.setUTCDate(date.getUTCDate() + days);
			return date.toISOString().slice(0, 10);
		};
		await page.reload({ waitUntil: "networkidle" });
		await expect(bar).toHaveAttribute("data-start", plus(start, 1));
		await expect(bar).toHaveAttribute("data-end", plus(end, 2));

		// The milestones: the launch's tasks, one done of them.
		await page.getByTestId("view-milestones").click();
		const launch = page.getByTestId("milestone").filter({ hasText: "Launch" });
		await expect(launch.getByTestId("milestone-progress")).toHaveText("1 of 5 tasks done");
		await expect(
			page.getByTestId("milestone").filter({ hasText: "Design signed off" }).getByTestId("milestone-complete"),
		).toBeVisible();
	});

	test("with the project's rule on, a blocked task can't be completed until its blockers are", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		await startGuest(page);
		await open(page, "/app/taskline/sandbox/p/WEB/settings/general");
		await page.getByRole("switch", { name: "A blocked task can't be completed" }).click();
		const saved = nextSave(page);
		await page.getByRole("button", { name: "Save changes" }).click();
		await saved;
		await expect(page.getByText("Changes saved.")).toBeVisible();

		// WEB-7 waits on WEB-2 and WEB-3: moving it to Done is refused and put back.
		await open(page, "/app/taskline/sandbox/t/WEB-7");
		const dependencies = page.getByTestId("task-dependencies");
		await expect(dependencies.getByTestId("task-blocked_by")).toContainText("WEB-2");
		await expect(dependencies.getByTestId("task-blocked-rule")).toBeVisible();
		const status = page.getByTestId("task-status");
		const before = await status.inputValue();
		await status.selectOption({ label: "Done" });
		await expect(page.getByText(/WEB-7 is blocked by WEB-\d, WEB-\d/)).toBeVisible();
		await expect(status).toHaveValue(before);

		// A new dependency by reference: WEB-1 now blocks it too; removing it again.
		await dependencies.getByTestId("task-dependency-relation").selectOption("blocked_by");
		await dependencies.getByTestId("task-dependency-input").fill("WEB-1");
		const added = nextSave(page);
		await dependencies.getByRole("button", { name: "Add" }).click();
		await added;
		await expect(dependencies.getByTestId("task-blocked_by").getByTestId("task-dependency")).toHaveCount(3);
		const removed = nextSave(page);
		await dependencies.getByRole("button", { name: "Remove the dependency on WEB-1" }).click();
		await removed;
		await expect(dependencies.getByTestId("task-blocked_by").getByTestId("task-dependency")).toHaveCount(2);

		// Once its blockers are done, it completes.
		for (const ref of ["WEB-2", "WEB-3"]) {
			await open(page, `/app/taskline/sandbox/t/${ref}`);
			const done = nextSave(page);
			await page.getByTestId("task-status").selectOption({ label: "Done" });
			await done;
		}
		await open(page, "/app/taskline/sandbox/t/WEB-7");
		const completed = nextSave(page);
		await page.getByTestId("task-status").selectOption({ label: "Done" });
		await completed;
		await page.reload({ waitUntil: "networkidle" });
		await expect(page.getByTestId("task-status").locator("option:checked")).toHaveText("Done");
	});

	test("a lead adds a choice field, a task gets a value, the list filters by it, and a required one stops Done", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		await startGuest(page);
		await open(page, "/app/taskline/sandbox/p/WEB/settings/fields");
		await page.getByTestId("field-new").click();
		const dialog = page.getByTestId("field-dialog");
		await dialog.getByRole("textbox", { name: "Name" }).fill("Severity");
		await dialog.getByRole("textbox", { name: "Option 1" }).fill("Low");
		await dialog.getByRole("textbox", { name: "Option 2" }).fill("High");
		const created = nextSave(page);
		await dialog.getByRole("button", { name: "Add field" }).click();
		await created;
		await expect(
			page.getByTestId("project-fields").getByTestId("field-row").filter({ hasText: "Severity" }),
		).toBeVisible();

		// WEB-3 gets High (saved at once, kept across a reload).
		await open(page, "/app/taskline/sandbox/t/WEB-3");
		const fields = page.getByTestId("task-custom-fields");
		const set = nextSave(page);
		await fields.getByLabel("Severity").selectOption({ label: "High" });
		await set;
		await page.reload({ waitUntil: "networkidle" });
		await expect(fields.getByLabel("Severity").locator("option:checked")).toHaveText("High");

		// The list filters by it: only WEB-3, with its chip.
		await open(page, "/app/taskline/sandbox/p/WEB/list");
		await page.getByTestId("task-filters").getByLabel("Severity").selectOption({ label: "High" });
		await expect(page).toHaveURL(/[?&]cf=/);
		await expect(page.getByTestId("task-row-open")).toHaveCount(1);
		await expect(page.getByTestId("task-table").getByText("WEB-3", { exact: true })).toBeVisible();
		await expect(page.getByText("Severity: High")).toBeVisible();

		// A required box: WEB-3 can't be completed until it's ticked.
		await open(page, "/app/taskline/sandbox/p/WEB/settings/fields");
		await page.getByTestId("field-new").click();
		await dialog.getByRole("textbox", { name: "Name" }).fill("QA passed");
		await dialog.getByRole("combobox", { name: "Type" }).click();
		await page.getByRole("option", { name: "Checkbox" }).click();
		await dialog.getByRole("checkbox", { name: "Required" }).check();
		const required = nextSave(page);
		await dialog.getByRole("button", { name: "Add field" }).click();
		await required;
		await open(page, "/app/taskline/sandbox/t/WEB-3");
		const status = page.getByTestId("task-status");
		const before = await status.inputValue();
		await status.selectOption({ label: "Done" });
		await expect(page.getByText("WEB-3 needs QA passed before it's completed.")).toBeVisible();
		await expect(status).toHaveValue(before);
		const ticked = nextSave(page);
		await fields.getByRole("checkbox", { name: /QA passed/ }).check();
		await ticked;
		const done = nextSave(page);
		await status.selectOption({ label: "Done" });
		await done;
		await page.reload({ waitUntil: "networkidle" });
		await expect(status.locator("option:checked")).toHaveText("Done");
	});
});

test.describe("Taskline templates, reports and updates", () => {
	test.use(signedIn("admin"));

	test("a project from a template has its statuses, fields and automation; its reports read; the lead posts an update", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		const stamp = Date.now().toString(36).slice(-4).toUpperCase();
		const key = `T${stamp}`.slice(0, 6);
		const name = `Launch ${stamp}`;

		await open(page, "/app/taskline/team/projects?create=1");
		const dialog = page.getByTestId("create-project-dialog");
		await dialog.getByLabel("Name").fill(name);
		await dialog.getByLabel("Key").fill(key);
		await dialog.getByRole("combobox", { name: "Template" }).click();
		await page.getByRole("option", { name: "Scrum software" }).click();
		await expect(dialog.getByTestId("template-summary")).toContainText("6 statuses and 4 sample tasks");
		await dialog.getByRole("button", { name: "Create project" }).click();
		await expect(page.getByTestId("project-overview")).toBeVisible();
		await expect(page).toHaveURL(new RegExp(`/app/taskline/team/p/${key}`));

		// Its statuses and sample tasks are on the board; sprints are on, as the template says.
		await expect(page.getByTestId("view-backlog")).toBeVisible();
		await page.getByTestId("view-board").click();
		await expect(page.getByText("In review").first()).toBeVisible();
		await expect(page.getByText("Write the product goal")).toBeVisible();

		await open(page, `/app/taskline/team/p/${key}/settings/fields`);
		await expect(page.getByTestId("project-fields").getByText("Severity", { exact: true })).toBeVisible();
		await open(page, `/app/taskline/team/p/${key}/settings/automations`);
		await expect(
			page.getByTestId("project-automations").getByText("New bugs get the Bug label", { exact: true }),
		).toBeVisible();

		// The reports read, and a report saves as a file.
		await open(page, `/app/taskline/team/p/${key}/reports`);
		await expect(page.getByTestId("report-status")).toBeVisible();
		const download = page.waitForEvent("download");
		await page.getByTestId("report-csv-status").click();
		expect((await download).suggestedFilename()).toContain(`${key.toLowerCase()}-status-`);
		await page.getByTestId("report-range-4w").click();
		await expect(page).toHaveURL(/range=4w/);

		// The lead posts an update, which sets the health.
		await open(page, `/app/taskline/team/p/${key}`);
		await page.getByTestId("project-update-new").click();
		const post = page.getByTestId("project-update-dialog");
		await post.getByRole("combobox", { name: "Health" }).click();
		await page.getByRole("option", { name: "At risk" }).click();
		await post.locator(".ProseMirror").fill("Two bugs to clear first.");
		await post.getByRole("button", { name: "Post", exact: true }).click();
		await expect(page.getByTestId("project-update").first()).toContainText("Two bugs to clear first.");
		await expect(page.getByTestId("project-update").first()).toContainText("At risk");
	});

	test("the admin saves a project as a template, and it can be used and deleted", async ({ page }) => {
		const stamp = Date.now().toString(36).slice(-5);
		const name = `From WEB ${stamp}`;
		await open(page, "/admin/taskline/projects");
		await page.getByRole("link", { name: "Website relaunch" }).click();
		await page.getByTestId("project-save-template").click();
		const dialog = page.getByTestId("save-template-dialog");
		await dialog.getByLabel("Name").fill(name);
		await dialog.getByRole("button", { name: "Save changes" }).click();
		await expect(page.getByText("Saved as the template").first()).toBeVisible();

		await open(page, "/admin/taskline/templates");
		const team = page.getByTestId("team-templates");
		await expect(team.getByText(name)).toBeVisible();
		await expect(page.getByTestId("builtin-templates").getByTestId("template-row")).toHaveCount(5);

		// The admin's "New project" offers it.
		await open(page, "/admin/taskline/projects/new");
		await page.getByRole("combobox", { name: "Template" }).click();
		await expect(page.getByRole("option", { name })).toBeVisible();

		await open(page, "/admin/taskline/templates");
		await page.getByRole("button", { name: `Delete ${name}` }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
		await expect(team.getByText(name)).toHaveCount(0);
	});
});

test.describe("Taskline automations", () => {
	test.use(signedIn("admin"));

	test("a rule built in the project's settings acts when a task is done, logs its run, and tells the lead", async ({
		page,
		browser,
		harness,
	}) => {
		await harness.resetRateLimits();
		const stamp = Date.now().toString(36).slice(-5);
		const name = `Ship it ${stamp}`;
		const title = `Release notes ${stamp}`;

		// A retry against the same server first clears what an earlier attempt left.
		await open(page, "/app/taskline/team/p/WEB/settings/automations");
		const leftovers = page
			.getByTestId("project-automations")
			.getByTestId("automation-row")
			.filter({ hasText: /Ship it / });
		while ((await leftovers.count()) > 0) {
			const gone = nextSave(page);
			await leftovers
				.first()
				.getByRole("button", { name: /^Delete “Ship it / })
				.click();
			await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
			await gone;
		}

		// The builder: when a task moves into a completed status, tell the lead and make it urgent.
		await page.getByTestId("automation-new").click();
		const dialog = page.getByTestId("automation-dialog");
		await dialog.getByRole("textbox", { name: "Name" }).fill(name);
		await expect(dialog.getByTestId("automation-preview")).toContainText("open tasks now");
		await dialog.getByRole("combobox", { name: "Who" }).click();
		await page.getByRole("option", { name: "The project's lead" }).click();
		await dialog.getByRole("textbox", { name: /Message/ }).fill("Ready to ship");
		await dialog.getByRole("button", { name: "Add an action" }).click();
		await dialog.getByRole("combobox", { name: "Do" }).nth(1).click();
		await page.getByRole("option", { name: "Set the priority" }).click();
		await dialog.getByRole("combobox", { name: "Priority" }).click();
		await page.getByRole("option", { name: "Urgent" }).click();
		const created = nextSave(page);
		await dialog.getByRole("button", { name: "Create automation" }).click();
		await created;
		const row = page.getByTestId("project-automations").getByTestId("automation-row").filter({ hasText: name });
		await expect(row).toContainText("When a task moves into a Completed status");

		// A new task, done from its sheet: the rule makes it urgent, and its history says so.
		await open(page, "/app/taskline/team/p/WEB/board");
		await addAndMove(page, title);
		await page.getByTestId("taskline-card-open").filter({ hasText: title }).click();
		const done = nextSave(page);
		await page.getByTestId("task-status").selectOption({ label: "Done" });
		await done;
		await page.reload({ waitUntil: "networkidle" });
		await expect(page).toHaveURL(/\/app\/taskline\/team\/t\/WEB-\d+$/);
		const ref = (page.url().match(/WEB-\d+$/) ?? [""])[0];
		await expect(page.getByTestId("task-priority")).toHaveValue("4");
		await page.getByTestId("task-tab-activity").click();
		await expect(page.getByTestId("task-activity")).toContainText(`Automation “${name}” set the priority to Urgent`);

		// The run log says it ran on that task.
		await open(page, "/app/taskline/team/p/WEB/settings/automations");
		await expect(page.getByTestId("automation-run").filter({ hasText: ref }).first()).toContainText("Ran");

		// Sita leads WEB: the rule's notice is in her inbox.
		const context = await browser.newContext({ baseURL: E2E.baseURL, storageState: { cookies: [], origins: [] } });
		const lead = await context.newPage();
		await signInAs(lead, "sita@taskline.example.com");
		await open(lead, "/app/taskline/inbox");
		await expect(lead.getByRole("link", { name: `Automation “${name}” on ${ref}: Ready to ship` })).toBeVisible();
		await context.close();

		// Deleted again, so the flows after this one meet the project as it was.
		await row.getByRole("button", { name: `Delete “${name}”?` }).click();
		const removed = nextSave(page);
		await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
		await removed;
		await expect(row).toHaveCount(0);
	});
});
