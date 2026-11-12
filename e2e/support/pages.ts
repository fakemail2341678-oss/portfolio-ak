/**
 * The pages the browser review visits (e2e/review.spec.ts). Every route in
 * src/routeTree.gen.ts must be either reviewed or excluded here with a reason;
 * tests/unit/e2e-pages.test.ts fails otherwise, so a new route can't skip the review.
 *
 * Plain data without Playwright imports, so the unit test can read it.
 */

import type { E2EUser } from "../harness/config.ts";
import type { PardaFixturePage } from "../harness/tmdb.ts"; // @parda

export type ReviewedPage = {
	/** The route's path as in FileRoutesByTo (`$param` segments included). */
	route: string;
	/** Who visits it; anonymous when unset. */
	as?: E2EUser;
	/** How a `$param` route gets a concrete URL (or give its `path`). */
	params?:
		| { from: "sitemap" }
		| { from: "test-crud-id" }
		| { from: "seeded-slug" }
		| { from: "portfolio-project-id" } // @portfolio
		| { from: "portfolio-post-id" } // @portfolio
		| { from: "taskline-project-id" } // @taskline
		| { from: "taskline-sprint-id"; state: "active" | "completed" } // @taskline
		| { from: "note-id" } // @apps
		| { from: "shared-note-token" } // @apps
		| { from: "link-id" } // @apps
		| { from: "expenses-data" } // @apps
		| { from: "habit-data" } // @apps
		| { from: "habit-id" } // @apps
		| { from: "form-data" } // @apps
		| { from: "form-id" } // @apps
		| { from: "form-slug" } // @apps
		| { from: "parda"; page: PardaFixturePage } // @parda
		| { from: "parda-source-id" } // @parda
		| { from: "parda-party" } // @parda
		| { from: "parda-curated"; id: "slug" | "billboard" | "collection" } // @parda
		| { from: "kharcha-expense-id" } // @kharcha
		| { from: "kharcha-thread"; tab?: "settings" } // @kharcha
		| { from: "kharcha-invite" }; // @kharcha
	/** The concrete path, when it isn't `route` (the not-found page, a fixed `$param`). */
	path?: string;
	/** The expected HTTP status when it isn't 200. */
	status?: 403 | 404;
	/** A name for pages reviewed more than once (e.g. a route as two users). */
	label?: string;
	/**
	 * The page keeps a stream open (Chaal's live boards, Task 82): the network never goes idle,
	 * so the review waits for the load and a quiet moment instead.
	 */
	live?: true;
};

/** A seeded Test CRUD item (scripts/lib/demo-data.ts) for admin detail pages (a draft: every third item is). */
export const SEEDED_ITEM_SLUG = "momo-masterclass-1";
/** A seeded, published one, for the public detail page. */
export const SEEDED_PUBLISHED_SLUG = "thangka-painting-1";

export const REVIEWED_PAGES: ReadonlyArray<ReviewedPage> = [
	// The home page: the portfolio (a neutral landing page once it is stripped)
	{ route: "/" },
	// portfolio:start
	{ route: "/about" },
	{ route: "/contact" },
	{ route: "/work" },
	{ route: "/work/$slug", params: { from: "sitemap" } },
	{ route: "/journal" },
	{ route: "/journal/$slug", params: { from: "sitemap" } },
	// portfolio:end
	// Public pages outside any section
	{ route: "/health" },
	{ route: "/verify-email" },
	{ route: "/reset-password" },
	// The demo and references under /dev (the harness builds with VITE_DEV_ROUTES=true)
	{ route: "/dev" },
	{ route: "/dev/stack" },
	{ route: "/dev/test-crud" },
	{ route: "/dev/test-crud/$slug", params: { from: "seeded-slug" } },
	{ route: "/dev/forms" },
	{ route: "/dev/examples" },
	{ route: "/dev/examples/loader-query" },
	{ route: "/dev/examples/streaming" },
	{ route: "/dev/examples/filters" },
	{ route: "/dev/examples/masking" },
	{ route: "/dev/examples/forms" },
	{ route: "/dev/examples/components" },
	{ route: "/dev/examples/fields" },
	{ route: "/dev/examples/data-table" },
	{ route: "/dev/examples/optimistic" },
	{ route: "/dev/examples/preferences" },
	{ route: "/dev/examples/permissions" },
	{ route: "/dev/examples/attachments" },
	{ route: "/dev/examples/seo" },
	{ route: "/dev/examples/i18n" },
	{ route: "/dev/examples/idempotency" },
	{ route: "/dev/examples/errors" },
	{ route: "/dev/examples/analytics" },
	{ route: "/dev/examples/list-extras" },
	{ route: "/dev/examples/caching" },
	{ route: "/dev/examples/background-jobs" },
	{ route: "/dev/examples/contact" },
	// A fixed in-memory task (src/server/examples/tasks.ts).
	{ route: "/dev/examples/masking/$id", path: "/dev/examples/masking/00000000-0000-4000-8000-000000000001" },
	// Signing in
	{ route: "/login" },
	{ route: "/register" },
	{ route: "/forgot-password" },
	{ route: "/sign-in-code" },
	// A guest is sent here from account pages; a visitor sees the same offer.
	{ route: "/upgrade" },
	// Account and admin
	{ route: "/account", as: "member" },
	// Without the emailed token it only explains where the link comes from (nothing is deleted).
	{ route: "/account/delete", as: "member" },
	{ route: "/admin", as: "admin" },
	{ route: "/admin", as: "member", status: 403, label: "forbidden" },
	{ route: "/admin/test-crud", as: "admin" },
	{ route: "/admin/test-crud/new", as: "admin" },
	{ route: "/admin/test-crud/$id", as: "admin", params: { from: "test-crud-id" } },
	{ route: "/admin/roles", as: "admin" },
	{ route: "/admin/roles/permissions", as: "admin" },
	{ route: "/admin/users", as: "admin" },
	{ route: "/admin/audit", as: "admin" },
	{ route: "/admin/settings/appearance", as: "admin" },
	// The editor's roles don't include audit:read (decisions.md 0132).
	{ route: "/admin/audit", as: "editor", status: 403, label: "forbidden" },
	// portfolio:start
	{ route: "/admin/portfolio/profile", as: "admin" },
	{ route: "/admin/portfolio/projects", as: "admin" },
	{ route: "/admin/portfolio/projects/new", as: "admin" },
	{ route: "/admin/portfolio/projects/$id", as: "admin", params: { from: "portfolio-project-id" } },
	{ route: "/admin/portfolio/journal", as: "admin" },
	{ route: "/admin/portfolio/journal/new", as: "admin" },
	{ route: "/admin/portfolio/journal/$id", as: "admin", params: { from: "portfolio-post-id" } },
	{ route: "/admin/portfolio/experience", as: "admin" },
	{ route: "/admin/portfolio/skills", as: "admin" },
	{ route: "/admin/portfolio/process", as: "admin" },
	{ route: "/admin/portfolio/testimonials", as: "admin" },
	{ route: "/admin/portfolio/messages", as: "admin" },
	{ route: "/admin/media", as: "admin" },
	// The demo editor writes the portfolio but doesn't read the inbox.
	{ route: "/admin/portfolio/messages", as: "editor", status: 403, label: "forbidden" },
	// portfolio:end
	// apps:start
	// The showcase apps (decision 0187): landings for visitors, the app for a user.
	{ route: "/apps" },
	{ route: "/apps/notes" },
	{ route: "/apps/notes", as: "member", label: "notes" },
	{ route: "/apps/notes/$noteId", as: "member", params: { from: "note-id" } },
	// Public to anyone with the link: reviewed signed out.
	{ route: "/apps/notes/s/$token", params: { from: "shared-note-token" } },
	{ route: "/apps/links" },
	{ route: "/apps/links", as: "member", label: "links" },
	{ route: "/apps/links/$linkId", as: "member", params: { from: "link-id" } },
	{ route: "/apps/expenses" },
	// With a month of expenses, budgets and categories (the harness adds them on first ask).
	{ route: "/apps/expenses", as: "member", label: "expenses", params: { from: "expenses-data" } },
	{ route: "/apps/expenses/categories", as: "member", params: { from: "expenses-data" } },
	{ route: "/apps/expenses/import", as: "member" },
	{ route: "/apps/habits" },
	{ route: "/apps/habits", as: "member", label: "habits", params: { from: "habit-data" } },
	{ route: "/apps/habits/$habitId", as: "member", params: { from: "habit-id" } },
	{ route: "/apps/forms" },
	{ route: "/apps/forms", as: "member", label: "forms", params: { from: "form-data" } },
	{ route: "/apps/forms/$formId", as: "member", params: { from: "form-id" } },
	{ route: "/apps/forms/$formId/results", as: "member", params: { from: "form-id" } },
	// A published form, for anyone with the link (signed out).
	{ route: "/f/$slug", params: { from: "form-slug" } },
	{ route: "/admin/apps", as: "admin" },
	{ route: "/admin/links", as: "admin" },
	// apps:end
	// taskline:start
	// Taskline (decision 0208): the landing and its sign-in pages for visitors; the app as a team member (the admin
	// is on the seeded demo team) and as an account with neither the team nor a sandbox.
	{ route: "/app/taskline" },
	{ route: "/app/taskline/sign-in" },
	{ route: "/app/taskline/sign-up" },
	{ route: "/app/taskline/home", as: "admin" },
	{ route: "/app/taskline/home", as: "editor", label: "no team" },
	{ route: "/app/taskline/account", as: "admin" },
	// The inbox and "My settings" (Task 50).
	{ route: "/app/taskline/inbox", as: "admin" },
	{ route: "/app/taskline/inbox", as: "admin", path: "/app/taskline/inbox?filter=all", label: "everything" },
	{ route: "/app/taskline/settings", as: "admin" },
	{ route: "/app/taskline/$ws/projects", as: "admin", path: "/app/taskline/team/projects" },
	{ route: "/app/taskline/$ws/p/$key", as: "admin", path: "/app/taskline/team/p/WEB" },
	// The views and the task (Task 48): the admin leads nothing but holds taskline:manage, so the lead's settings open.
	{ route: "/app/taskline/$ws/p/$key/board", as: "admin", path: "/app/taskline/team/p/WEB/board" },
	{
		route: "/app/taskline/$ws/p/$key/board",
		as: "admin",
		path: "/app/taskline/team/p/WEB/board?swimlanes=assignee",
		label: "swimlanes",
	},
	{ route: "/app/taskline/$ws/p/$key/list", as: "admin", path: "/app/taskline/team/p/WEB/list" },
	{
		route: "/app/taskline/$ws/p/$key/list",
		as: "admin",
		path: "/app/taskline/team/p/WEB/list?group=status",
		label: "grouped",
	},
	// More views and finding things (Task 51)
	{ route: "/app/taskline/$ws/p/$key/calendar", as: "admin", path: "/app/taskline/team/p/WEB/calendar" },
	{
		route: "/app/taskline/$ws/p/$key/calendar",
		as: "admin",
		path: "/app/taskline/team/p/WEB/calendar?mode=week&by=start",
		label: "a week by start date",
	},
	// Timeline, milestones and dependencies (Task 54): the demo team's WEB has milestones and dependencies.
	{ route: "/app/taskline/$ws/p/$key/timeline", as: "admin", path: "/app/taskline/team/p/WEB/timeline" },
	{
		route: "/app/taskline/$ws/p/$key/timeline",
		as: "admin",
		path: "/app/taskline/team/p/WEB/timeline?zoom=day&group=milestone",
		label: "days by milestone",
	},
	{
		route: "/app/taskline/$ws/p/$key/timeline",
		as: "admin",
		path: "/app/taskline/team/p/APP/timeline?zoom=month&group=assignee",
		label: "months by assignee",
	},
	{ route: "/app/taskline/$ws/p/$key/milestones", as: "admin", path: "/app/taskline/team/p/WEB/milestones" },
	{
		route: "/app/taskline/$ws/p/$key/milestones",
		as: "admin",
		path: "/app/taskline/team/p/APP/milestones",
		label: "none yet",
	},
	// Sprints and backlog (Task 52): the demo team's APP plans in sprints.
	{ route: "/app/taskline/$ws/p/$key/backlog", as: "admin", path: "/app/taskline/team/p/APP/backlog" },
	{
		route: "/app/taskline/$ws/p/$key/backlog",
		as: "admin",
		path: "/app/taskline/team/p/WEB/backlog",
		label: "sprints off",
	},
	{
		route: "/app/taskline/$ws/p/$key/sprints/$sprintId",
		as: "admin",
		params: { from: "taskline-sprint-id", state: "active" },
	},
	{
		route: "/app/taskline/$ws/p/$key/sprints/$sprintId",
		as: "admin",
		params: { from: "taskline-sprint-id", state: "completed" },
		label: "completed",
	},
	// Time tracking (Task 53): the admin is on the demo team, whose seed logged time on WEB and APP.
	{ route: "/app/taskline/$ws/timesheet", as: "admin", path: "/app/taskline/team/timesheet" },
	{ route: "/app/taskline/$ws/p/$key/time", as: "admin", path: "/app/taskline/team/p/WEB/time" },
	{
		route: "/app/taskline/$ws/p/$key/time",
		as: "admin",
		path: "/app/taskline/team/p/WEB/time?by=member",
		label: "by member",
	},
	{ route: "/app/taskline/$ws/search", as: "admin", path: "/app/taskline/team/search" },
	{ route: "/app/taskline/$ws/search", as: "admin", path: "/app/taskline/team/search?q=design", label: "results" },
	{ route: "/app/taskline/home", as: "admin", path: "/app/taskline/home?show=all", label: "assigned and watched" },
	{ route: "/app/taskline/$ws/t/$ref", as: "admin", path: "/app/taskline/team/t/WEB-1" },
	{
		route: "/app/taskline/$ws/p/$key/settings/general",
		as: "admin",
		path: "/app/taskline/team/p/WEB/settings/general",
	},
	{
		route: "/app/taskline/$ws/p/$key/settings/members",
		as: "admin",
		path: "/app/taskline/team/p/WEB/settings/members",
	},
	{
		route: "/app/taskline/$ws/p/$key/settings/workflow",
		as: "admin",
		path: "/app/taskline/team/p/WEB/settings/workflow",
	},
	{ route: "/app/taskline/$ws/p/$key/settings/labels", as: "admin", path: "/app/taskline/team/p/WEB/settings/labels" },
	// Custom fields (Task 55): the demo team has a workspace field and WEB fields of its own.
	{ route: "/app/taskline/$ws/p/$key/settings/fields", as: "admin", path: "/app/taskline/team/p/WEB/settings/fields" },
	{
		route: "/app/taskline/$ws/p/$key/settings/fields",
		as: "admin",
		path: "/app/taskline/team/p/OPS/settings/fields",
		label: "none of its own",
	},
	// Automations (Task 56): the demo team's WEB has rules of its own, a workspace rule and runs; OPS has none of its own.
	{
		route: "/app/taskline/$ws/p/$key/settings/automations",
		as: "admin",
		path: "/app/taskline/team/p/WEB/settings/automations",
	},
	{
		route: "/app/taskline/$ws/p/$key/settings/automations",
		as: "admin",
		path: "/app/taskline/team/p/OPS/settings/automations",
		label: "none of its own",
	},
	{ route: "/app/taskline/$ws/p/$key/settings/trash", as: "admin", path: "/app/taskline/team/p/WEB/settings/trash" },
	// Reports (Task 57): the demo team's WEB has work of every kind; OPS is small and private.
	{ route: "/app/taskline/$ws/p/$key/reports", as: "admin", path: "/app/taskline/team/p/WEB/reports" },
	{
		route: "/app/taskline/$ws/p/$key/reports",
		as: "admin",
		path: "/app/taskline/team/p/OPS/reports?range=4w",
		label: "small, four weeks",
	},
	{
		route: "/app/taskline/$ws/t/$ref",
		as: "admin",
		path: "/app/taskline/team/t/WEB-9999",
		status: 404,
		label: "unknown task",
	},
	{
		route: "/app/taskline/$ws/projects",
		as: "admin",
		path: "/app/taskline/nope/projects",
		status: 404,
		label: "unknown workspace",
	},
	// The admin's Taskline (Task 49).
	{ route: "/admin/taskline", as: "admin" },
	{ route: "/admin/taskline/projects", as: "admin" },
	{ route: "/admin/taskline/projects/new", as: "admin" },
	{ route: "/admin/taskline/projects/$id", as: "admin", params: { from: "taskline-project-id" } },
	{ route: "/admin/taskline/projects/$id/members", as: "admin", params: { from: "taskline-project-id" } },
	{ route: "/admin/taskline/projects/$id/workflow", as: "admin", params: { from: "taskline-project-id" } },
	{ route: "/admin/taskline/projects/$id/labels", as: "admin", params: { from: "taskline-project-id" } },
	{ route: "/admin/taskline/members", as: "admin" },
	{ route: "/admin/taskline/invitations", as: "admin" },
	{ route: "/admin/taskline/workflows", as: "admin" },
	{ route: "/admin/taskline/fields", as: "admin" },
	{ route: "/admin/taskline/automations", as: "admin" },
	{ route: "/admin/taskline/templates", as: "admin" },
	{ route: "/admin/taskline/reports", as: "admin" },
	{ route: "/admin/taskline/settings", as: "admin" },
	{ route: "/admin/taskline/activity", as: "admin" },
	{ route: "/admin/taskline/timesheets", as: "admin" },
	{ route: "/admin/taskline/timesheets/utilization", as: "admin" },
	// taskline:end
	// parda:start
	// Parda (decision 0228): its pages for visitors, in its own frame (Task 61), the hubs and a title (Task 62).
	{ route: "/app/parda" },
	{ route: "/app/parda/$hub", path: "/app/parda/movies", label: "movies" },
	{ route: "/app/parda/$hub", path: "/app/parda/series", label: "series" },
	{ route: "/app/parda/$hub", path: "/app/parda/anime", label: "anime" },
	{ route: "/app/parda/$type/$id", params: { from: "parda", page: "movie" }, label: "movie" },
	{ route: "/app/parda/$type/$id", params: { from: "parda", page: "series" }, label: "series" },
	{ route: "/app/parda/$type/$id/credits", params: { from: "parda", page: "credits" } },
	{ route: "/app/parda/person/$id", params: { from: "parda", page: "person" } },
	{ route: "/app/parda/collection/$id", params: { from: "parda", page: "collection" } },
	{ route: "/app/parda/watch/$type/$id", params: { from: "parda", page: "watch-movie" }, label: "movie" },
	{ route: "/app/parda/watch/$type/$id", params: { from: "parda", page: "watch-series" }, label: "series" },
	{ route: "/app/parda/about" },
	// Search and Discover (Task 66): empty, with results, with nothing found; Discover as it opens and filtered.
	{ route: "/app/parda/search", label: "empty" },
	{ route: "/app/parda/search", path: "/app/parda/search?q=star", label: "results" },
	{ route: "/app/parda/search", path: "/app/parda/search?q=star&tab=people", label: "people" },
	{ route: "/app/parda/search", path: "/app/parda/search?q=qzxv+no+such+title", label: "nothing found" },
	{ route: "/app/parda/discover", label: "default" },
	{ route: "/app/parda/discover", path: "/app/parda/discover?type=series&sort=rating", label: "filtered" },
	// The library and profiles (Task 67): signed out they say how they start; as a viewer, each tab.
	{ route: "/app/parda/library/$tab", path: "/app/parda/library/list", label: "signed out" },
	{ route: "/app/parda/library/$tab", path: "/app/parda/library/list", as: "viewer", label: "my list" },
	{ route: "/app/parda/library/$tab", path: "/app/parda/library/favourites", as: "viewer", label: "favourites" },
	{ route: "/app/parda/library/$tab", path: "/app/parda/library/continue", as: "viewer", label: "continue" },
	{ route: "/app/parda/library/$tab", path: "/app/parda/library/history", as: "viewer", label: "history" },
	{ route: "/app/parda/profiles", label: "signed out" },
	{ route: "/app/parda/profiles", as: "viewer", label: "viewer" },
	{ route: "/app/parda/schedule", label: "signed out" },
	{ route: "/app/parda/schedule", as: "viewer", label: "viewer" },
	// A visitor is sent to sign-in, a guest to sign-up (0249): only an account has the page.
	{ route: "/app/parda/account", as: "viewer", label: "viewer" },
	{ route: "/app/parda/sign-in" },
	{ route: "/app/parda/sign-up" },
	{ route: "/app/parda/$", path: "/app/parda/no/such/page", status: 404, label: "unknown page" },
	{ route: "/admin/parda/player-lab", as: "admin" },
	// The admin's Parda, part one (Task 65): sources, takedowns, reports, settings.
	{ route: "/admin/parda/sources", as: "admin" },
	{ route: "/admin/parda/sources/new", as: "admin" },
	{ route: "/admin/parda/sources/$id", as: "admin", params: { from: "parda-source-id" } },
	{ route: "/admin/parda/titles", as: "admin" },
	{ route: "/admin/parda/titles/new", as: "admin" },
	{ route: "/admin/parda/reports", as: "admin" },
	{ route: "/admin/parda/settings", as: "admin" },
	// Task 69: the overview, curation and the layout, and a curated collection's page.
	{ route: "/admin/parda", as: "admin" },
	{ route: "/admin/parda/billboard", as: "admin" },
	{ route: "/admin/parda/billboard/new", as: "admin" },
	{ route: "/admin/parda/billboard/$id", as: "admin", params: { from: "parda-curated", id: "billboard" } },
	{ route: "/admin/parda/collections", as: "admin" },
	{ route: "/admin/parda/collections/new", as: "admin" },
	{ route: "/admin/parda/collections/$id", as: "admin", params: { from: "parda-curated", id: "collection" } },
	{ route: "/admin/parda/layout", as: "admin" },
	{ route: "/app/parda/c/$slug", params: { from: "parda-curated", id: "slug" } },
	// Task 69a: a party's page, before and after taking a seat.
	{ route: "/app/parda/party/$code", params: { from: "parda-party" }, label: "signed out" },
	{ route: "/app/parda/party/$code", params: { from: "parda-party" }, as: "viewer", label: "viewer" },
	// parda:end
	// chaal:start
	// Chaal (decision 0254): Task 71's lab, and its own pages in its frame (Task 73, decision 0259).
	{ route: "/admin/chaal/lab", as: "admin" },
	// Task 79: the admin's settings, connections and blocks, and the API's health.
	{ route: "/admin/chaal/settings", as: "admin" },
	{ route: "/admin/chaal/connections", as: "admin" },
	{ route: "/admin/chaal/blocks", as: "admin" },
	{ route: "/admin/chaal/health", as: "admin" },
	// Task 84: the overview and curation.
	{ route: "/admin/chaal", as: "admin" },
	{ route: "/admin/chaal/curation", as: "admin" },
	{ route: "/app/chaal" },
	{ route: "/app/chaal", as: "viewer", label: "viewer" },
	{ route: "/app/chaal/about" },
	// The analysis board (Task 75): empty, at a position (drawn on the server), and the tablebase's.
	{ route: "/app/chaal/analysis" },
	{
		route: "/app/chaal/analysis",
		path: "/app/chaal/analysis?moves=e2e4_c7c5_g1f3&orientation=black",
		label: "a position",
	},
	{ route: "/app/chaal/analysis", as: "viewer", label: "viewer" },
	{ route: "/app/chaal/play" },
	{ route: "/app/chaal/play", as: "viewer", label: "viewer" },
	// Puzzles (Task 80): the daily one, training, the streak, a puzzle by id, and the viewer's progress.
	{ route: "/app/chaal/puzzles" },
	{ route: "/app/chaal/puzzles", path: "/app/chaal/puzzles?mode=train&theme=fork", label: "training" },
	{ route: "/app/chaal/puzzles", path: "/app/chaal/puzzles?mode=streak", label: "the streak" },
	{ route: "/app/chaal/puzzles", as: "viewer", label: "viewer" },
	{ route: "/app/chaal/puzzles/$id", path: "/app/chaal/puzzles/xSeW5", label: "the daily one by id" },
	{
		route: "/app/chaal/local/$id",
		path: "/app/chaal/local/00000000-0000-4000-8000-000000000000",
		label: "a game not in this browser",
	},
	// Players and games (Task 81): the leaderboards, a player (the recorded one), their games, a replay.
	{ route: "/app/chaal/players" },
	{ route: "/app/chaal/players", path: "/app/chaal/players?perf=rapid", label: "rapid" },
	{ route: "/app/chaal/players/$username", path: "/app/chaal/players/nihalsarin2004", label: "a player" },
	{
		route: "/app/chaal/players/$username",
		path: "/app/chaal/players/nihalsarin2004?tab=games",
		label: "their games",
	},
	{
		route: "/app/chaal/players/$username",
		path: "/app/chaal/players/nobody_here",
		status: 404,
		label: "no such player",
	},
	// A game on Lichess: its replay (Task 81), or said where the board would be (Lichess has no such game).
	{ route: "/app/chaal/game/$id", path: "/app/chaal/game/T8myeL3d", label: "a replay" },
	{ route: "/app/chaal/game/$id", path: "/app/chaal/game/abcdEFGH", label: "no such game" },
	// Watch (Task 82): the TV and a channel, live from the fake Lichess's feeds; a game being played
	// (the fake's own), followed; the broadcasts' lists, the recorded tournament, a board, an unknown one.
	{ route: "/app/chaal/watch", live: true },
	{ route: "/app/chaal/watch/$channel", path: "/app/chaal/watch/rapid", label: "a channel", live: true },
	{ route: "/app/chaal/watch/$channel", path: "/app/chaal/watch/horde", status: 404, label: "a variant's channel" },
	{ route: "/app/chaal/game/$id", path: "/app/chaal/game/e2eWatch", label: "a game being played", live: true },
	{ route: "/app/chaal/broadcasts" },
	{ route: "/app/chaal/broadcasts", path: "/app/chaal/broadcasts?view=official", label: "official" },
	{ route: "/app/chaal/broadcasts", path: "/app/chaal/broadcasts?q=spice", label: "a search" },
	{ route: "/app/chaal/broadcasts/$id", path: "/app/chaal/broadcasts/9NE16qcS", label: "a tournament" },
	{
		route: "/app/chaal/broadcasts/$id",
		path: "/app/chaal/broadcasts/9NE16qcS?round=9gsZmGXg&board=qA1AQnT5",
		label: "a board",
	},
	{
		route: "/app/chaal/broadcasts/$id",
		path: "/app/chaal/broadcasts/nOtThere",
		status: 404,
		label: "no such broadcast",
	},
	// Community (Task 83): the arenas (coming up, being played, finished) and one of each, the
	// recorded finished Swiss and one coming up (its team's list), the teams' lists, the recorded
	// team, the studies' lists, a study and a chapter, and unknown ones.
	{ route: "/app/chaal/tournaments" },
	{ route: "/app/chaal/tournaments", path: "/app/chaal/tournaments?view=started", label: "playing now" },
	{ route: "/app/chaal/tournaments", path: "/app/chaal/tournaments?view=finished", label: "finished" },
	{ route: "/app/chaal/tournaments/$id", path: "/app/chaal/tournaments/yc48o9PO", label: "an arena coming up" },
	{ route: "/app/chaal/tournaments/$id", path: "/app/chaal/tournaments/e2eArena", label: "an arena being played" },
	{ route: "/app/chaal/tournaments/$id", path: "/app/chaal/tournaments/aEMoQUDF", label: "a finished arena" },
	{
		route: "/app/chaal/tournaments/$id",
		path: "/app/chaal/tournaments/aEMoQUDF?page=2",
		label: "standings, page 2",
	},
	{ route: "/app/chaal/tournaments/$id", path: "/app/chaal/tournaments/DeKa4OGD?kind=swiss", label: "a Swiss" },
	{
		route: "/app/chaal/tournaments/$id",
		path: "/app/chaal/tournaments/ZvN9AlF4?kind=swiss",
		label: "a Swiss coming up",
	},
	{
		route: "/app/chaal/tournaments/$id",
		path: "/app/chaal/tournaments/nOtThere",
		status: 404,
		label: "no such tournament",
	},
	{ route: "/app/chaal/teams" },
	{ route: "/app/chaal/teams", path: "/app/chaal/teams?q=nepal", label: "a search" },
	{ route: "/app/chaal/teams", path: "/app/chaal/teams?view=mine", label: "mine, not connected" },
	{ route: "/app/chaal/teams/$id", path: "/app/chaal/teams/lichess-swiss", label: "a team" },
	{ route: "/app/chaal/teams/$id", path: "/app/chaal/teams/no-such-team", status: 404, label: "no such team" },
	{ route: "/app/chaal/studies" },
	{ route: "/app/chaal/studies", path: "/app/chaal/studies?view=mine", label: "mine, not connected" },
	{ route: "/app/chaal/studies/$id", path: "/app/chaal/studies/Zwqt6BdF", label: "a study" },
	{
		route: "/app/chaal/studies/$id",
		path: "/app/chaal/studies/Zwqt6BdF?chapter=OQbOOUdX",
		label: "a chapter",
	},
	{ route: "/app/chaal/studies/$id", path: "/app/chaal/studies/nOtThere", status: 404, label: "no such study" },
	{ route: "/app/chaal/settings", label: "signed out" },
	{ route: "/app/chaal/settings", as: "viewer", label: "viewer" },
	{ route: "/app/chaal/settings", path: "/app/chaal/settings?lichess=denied", label: "connect result" },
	{ route: "/app/chaal/sign-in" },
	{ route: "/app/chaal/sign-up" },
	{ route: "/app/chaal/$", path: "/app/chaal/no/such/page", status: 404, label: "unknown page" },
	// chaal:end
	// kharcha:start
	// Kharcha (decisions 0277 and 0282): the landing and its sign-in pages for visitors; Home as a demo account (onboarded,
	// with a shared group) and as an account new to Kharcha, whose first visit opens onboarding; the account page.
	{ route: "/app/kharcha" },
	{ route: "/app/kharcha/sign-in" },
	{ route: "/app/kharcha/sign-up" },
	{ route: "/app/kharcha/home", as: "kharcha" },
	{ route: "/app/kharcha/home", as: "member", label: "first visit" },
	{ route: "/app/kharcha/account", as: "kharcha" },
	// Task 89: Spend, an expense's page, and the four Settings tabs.
	{ route: "/app/kharcha/spend", as: "kharcha" },
	{ route: "/app/kharcha/e/$expenseId", as: "kharcha", params: { from: "kharcha-expense-id" } },
	{ route: "/app/kharcha/settings/$tab", as: "kharcha", path: "/app/kharcha/settings/categories", label: "categories" },
	{ route: "/app/kharcha/settings/$tab", as: "kharcha", path: "/app/kharcha/settings/tags", label: "tags" },
	{ route: "/app/kharcha/settings/$tab", as: "kharcha", path: "/app/kharcha/settings/methods", label: "methods" },
	{ route: "/app/kharcha/settings/$tab", as: "kharcha", path: "/app/kharcha/settings/rules", label: "rules" },
	{ route: "/app/kharcha/people", as: "kharcha" },
	{ route: "/app/kharcha/g/$groupId", as: "kharcha", params: { from: "kharcha-thread" } },
	{
		route: "/app/kharcha/g/$groupId",
		as: "kharcha",
		params: { from: "kharcha-thread", tab: "settings" },
		label: "settings",
	},
	{ route: "/app/kharcha/f/$personId", as: "kharcha", params: { from: "kharcha-thread" } },
	{ route: "/app/kharcha/join/$token", params: { from: "kharcha-invite" } },
	{
		route: "/app/kharcha/join/$token",
		as: "member",
		params: { from: "kharcha-invite" },
		label: "signed in",
	},
	// kharcha:end
	// @new-feature:reviewed-pages
	// Errors
	{ route: "(not found)", path: "/no-such-page", status: 404 },
];

/** Routes the review skips, each with the reason. */
export const NOT_REVIEWED: Readonly<Record<string, string>> = {
	"/robots.txt": "not a page (text)",
	"/sitemap.xml": "not a page (XML); the review reads it to find $slug URLs",
	"/api/auth/$": "Better Auth's HTTP API",
	"/api/health": "JSON for uptime monitors (checked by e2e/flows/health.spec.ts)",
	"/api/account/export": "a JSON download (checked by e2e/flows/account.spec.ts)",
	"/api/csp-report": "POST endpoint for CSP reports (checked by e2e/flows/frontend.spec.ts)",
	"/l/$slug": "a redirect, or the 404 (checked by e2e/flows/apps.spec.ts)", // @apps
	"/app/taskline/$ws": "a redirect to the workspace's projects (checked by e2e/flows/taskline.spec.ts)", // @taskline
	"/app/parda/surprise": "a redirect to a random title (checked by e2e/flows/parda.spec.ts)", // @parda
	"/app/taskline/$ws/p/$key/settings": "a redirect to the settings' first section", // @taskline
	"/apps/kanban": "Kanban's old address, a redirect to Taskline (checked by e2e/flows/taskline.spec.ts)", // @taskline
	"/apps/kanban/$boardId": "an old board's address, a redirect to its project (checked by e2e/flows/taskline.spec.ts)", // @taskline
	// @new-feature:not-reviewed
};

/** `/ne` prefix for Nepali (English is unprefixed). */
export const localizedPath = (path: string, locale: "en" | "ne") =>
	locale === "en" ? path : path === "/" ? "/ne" : `/ne${path}`;

/** A RegExp matching the route's concrete paths (each `$param` is one segment). */
export const routePattern = (route: string) =>
	new RegExp(`^${route.replace(/[.*+?^{}()|[\]\\]/g, "\\$&").replace(/\$[a-zA-Z]+/g, "[^/]+")}$`);
