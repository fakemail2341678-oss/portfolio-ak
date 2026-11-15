/**
 * What Part 9 Task 101 renames and moves, as data (decision 0298). The codemod
 * (`../part9-structure.ts`) works out everything a rule decides by itself (a loose component goes
 * to `components/`, a schema gets `Schema`); this file holds the choices a person made.
 *
 * Done by hand, not by this data (decision 0298 says why for each):
 * - before the run: `useAppForm` (src/components/forms/index.ts became use-app-form.ts behind a
 *   new index.ts), `useFieldA11y` with `errorMessages` (use-field-a11y.ts), `useWaiting` and
 *   `useLiveNotices` (chaal/shell/hooks/use-live-notices.ts), and the type in portfolio/lib/css-vars.ts;
 * - after the run: six `await import(…)` destructurings of folded names, `useTurnstile`'s element
 *   and the script loader that went with it, sixteen route loaders that import a moved loader or
 *   section with `await import(…)`, `withPublic`'s import in functions/auth.ts, three imports of
 *   `parda/search.ts` (written `..` by the first version of `relativeSpecifier`), the portfolio's
 *   `scope` and Kharcha's admin `ROOT` (now local to their keys.ts), a strip marker that a moved
 *   declaration took along, and four comments on exports the moves made public.
 *   The template matrix then showed three more: the generator's templates (`.tpl`, which the path
 *   step does not read) still imported `rbac/route-guard`, the section-home context had to stay
 *   with its provider, and `form-method.test.ts` was named after a file only Taskline has.
 * The collection renames, `canReadFollowing`, `ensureQuietly`, `keyed` and the board's draft
 * helpers ran as a second pass, after the first showed them; they are listed here in place.
 */

const F = "src/features/";

/** `[file, name, new name]`. */
type Rename = readonly [string, string, string];

// --- Edits by hand that the moves depend on --------------------------------------------------

/** Text changed before anything else: `[file, text to find, replacement]`. Each must match once. */
export const PATCHES: ReadonlyArray<readonly [string, string, string]> = [
	// `Can` needs no JSX, so it stays with the hooks it is the component form of (hooks/use-can.ts).
	[`${F}rbac/can.tsx`, "return <>{can ? children : fallback}</>;", "return can ? children : fallback;"],
	// The three functions with no guard say they are public (function-guards).
	[
		"src/functions/health.ts",
		'createServerFn({ method: "GET" }).handler(',
		'createServerFn({ method: "GET" })\n\t.middleware([withPublic])\n\t.handler(',
	],
	[
		"src/functions/health.ts",
		'import { createServerFn } from "@tanstack/react-start";',
		'import { createServerFn } from "@tanstack/react-start";\nimport { withPublic } from "@/middleware/services";',
	],
	[
		"src/functions/feature-flags.ts",
		'createServerFn({ method: "GET" }).handler(',
		'createServerFn({ method: "GET" })\n\t.middleware([withPublic])\n\t.handler(',
	],
	[
		"src/functions/feature-flags.ts",
		'import { createServerFn } from "@tanstack/react-start";',
		'import { createServerFn } from "@tanstack/react-start";\nimport { withPublic } from "@/middleware/services";',
	],
	[
		"src/functions/auth.ts",
		'export const getAuthFeatures = createServerFn({ method: "GET" }).handler(',
		'export const getAuthFeatures = createServerFn({ method: "GET" })\n\t.middleware([withPublic])\n\t.handler(',
	],
];

// --- Names -------------------------------------------------------------------------------------

/** Guards take the vocabulary's words (`require<Layer>User`, `with<Layer>Services`, `with<Layer>Public`). */
export const GUARD_RENAMES: ReadonlyArray<Rename> = [
	["src/middleware/apps.ts", "requireAppUser", "requireAppsUser"],
	["src/middleware/apps.ts", "withAppServices", "withAppsServices"],
	["src/middleware/parda.ts", "requirePardaViewer", "requirePardaUser"],
	["src/middleware/parda.ts", "withPardaCatalog", "withPardaPublic"],
];

/** Server functions named with a folded verb, and the standard's verb for each. */
export const VERB_RENAMES: ReadonlyArray<Rename> = (
	[
		["apps/forms", "saveForm", "updateForm"],
		["auth", "ensureAdminAccess", "getAdminAccess"],
		["chaal-admin/curation", "saveChaalAnnouncement", "setChaalAnnouncement"],
		["chaal-admin/curation", "saveChaalHomeSections", "setChaalHomeSections"],
		["chaal-admin/lab", "checkChaalPublicLane", "pingChaalPublicLane"],
		["chaal/analyses", "saveChaalAnalysis", "updateChaalAnalysis"],
		["chaal/challenges", "openChaalChallenge", "createChaalChallenge"],
		["chaal/local-games", "saveChaalLocalGame", "createChaalLocalGame"],
		["chaal/my-studies", "saveChaalToStudy", "copyChaalToStudy"],
		["chaal/preferences", "saveChaalPreferences", "setChaalPreferences"],
		["chaal/tournament-entry", "withdrawChaalTournament", "leaveChaalTournament"],
		["examples-permissions", "exampleManageRoles", "pingExampleManageRoles"],
		["examples-permissions", "exampleReadItems", "pingExampleReadItems"],
		["examples", "failExample", "getExampleFailure"],
		["examples", "runExampleJobFn", "startExampleJob"],
		["kharcha-admin/senders", "suspendKharchaSender", "setKharchaSenderSuspended"],
		["kharcha/conversations", "markKharchaNotificationsRead", "setKharchaNotificationsRead"],
		["kharcha/conversations", "markKharchaThreadRead", "setKharchaThreadRead"],
		["kharcha/expenses", "markKharchaDuplicate", "setKharchaNotDuplicate"],
		["kharcha/groups", "archiveKharchaGroup", "setKharchaGroupArchived"],
		["kharcha/recurring", "pauseKharchaRecurring", "setKharchaRecurringPaused"],
		["kharcha/recurring", "repeatKharchaExpense", "createKharchaRecurring"],
		["kharcha/spend", "bulkKharchaExpenses", "updateKharchaExpenses"],
		["kharcha/spend", "renameKharchaSearch", "setKharchaSearchName"],
		["kharcha/spend", "saveKharchaSearch", "createKharchaSearch"],
		["parda-admin/curation", "savePardaLayout", "setPardaLayout"],
		["parda-admin/player-lab", "openPardaLabPlayer", "previewPardaLabPlayer"],
		["parda/alerts", "markPardaInboxRead", "setPardaInboxRead"],
		["parda/library", "clearPardaHistory", "deletePardaHistory"],
		["parda/library", "markPardaWatched", "setPardaWatched"],
		["parda/library", "savePardaProgress", "setPardaProgress"],
		["parda/party", "endPardaParty", "stopPardaParty"],
		["parda/party", "takeOverPardaParty", "claimPardaParty"],
		["parda/profiles", "switchPardaProfile", "setPardaActiveProfile"],
		["parda/search", "notePardaSearch", "recordPardaSearch"],
		["taskline-admin/automations", "toggleTasklineWorkspaceAutomation", "setTasklineWorkspaceAutomationEnabled"],
		["taskline-admin/members", "deactivateTasklineMember", "setTasklineMemberInactive"],
		["taskline-admin/members", "reactivateTasklineMember", "setTasklineMemberActive"],
		["taskline-admin/templates", "saveTasklineProjectAsTemplate", "createTasklineProjectTemplate"],
		["taskline/automations", "toggleTasklineAutomation", "setTasklineAutomationEnabled"],
		["taskline/collab", "watchTasklineTask", "followTasklineTask"],
		["taskline/find", "findTasklineTasks", "listTasklineFindResults"],
		["taskline/find", "saveTasklineSavedView", "createTasklineSavedView"],
		["taskline/inbox", "markTasklineRead", "setTasklineNotificationsRead"],
		["taskline/inbox", "saveTasklineNotifySettings", "setTasklineNotifySettings"],
		["taskline/projects", "locateTasklineProject", "getTasklineProjectLocation"],
		["taskline/projects", "postTasklineProjectUpdate", "createTasklineProjectUpdate"],
		["taskline/sprints", "rankTasklineTask", "reorderTasklineTask"],
		["taskline/tasks", "bulkUpdateTasklineTasks", "updateTasklineTasks"],
		["taskline/tasks", "patchTasklineTask", "setTasklineTaskField"],
		["taskline/time", "logTasklineTime", "recordTasklineTime"],
	] as const
).map(([file, from, to]) => [`src/functions/${file}.ts`, from, to] as const);

/** Exports whose new name is not "the old one with Schema". */
export const EXPORT_RENAMES: ReadonlyArray<Rename> = [
	[`${F}rbac/keys.ts`, "RBAC_REFRESH", "rbacRefreshKeys"],
	[`${F}taskline/admin/keys.ts`, "ALL_TASKLINE_ADMIN", "tasklineAdminAllKeys"],
	[`${F}dev/examples/collection.ts`, "exampleTasksCollection", "exampleTasksRows"],
	// collections.ts becomes collection.ts, where an export ends in Rows.
	[`${F}apps/habits/collections.ts`, "checkinsCollection", "checkinRows"],
	[`${F}apps/notes/collections.ts`, "notesCollection", "noteRows"],
	[`${F}taskline/board/collections.ts`, "projectTaskCollection", "projectTaskRows"],
	// Objects of calls to server functions: the feature's writes.
	[`${F}chaal/events/queries.ts`, "tournamentCalls", "chaalEventsMutations"],
	[`${F}chaal/play/queries.ts`, "playCalls", "chaalPlayMutations"],
	[`${F}chaal/players/queries.ts`, "followCalls", "chaalPlayersMutations"],
	[`${F}chaal/studies/queries.ts`, "studyCalls", "chaalStudiesMutations"],
	[`${F}chaal/teams/queries.ts`, "teamCalls", "chaalTeamsMutations"],
	// A shape of fields that two schemas spread, not a schema: a constant.
	[`${F}taskline/schema.ts`, "fieldChanges", "FIELD_CHANGES"],
];

/** Exports of schema.ts files that keep their name (handled in EXPORT_RENAMES). */
export const NOT_A_SCHEMA = new Set([`${F}taskline/schema.ts#fieldChanges`]);

/**
 * Single writes exported from queries.ts become keys of the feature's one `<feature>Mutations`
 * object: `[file, name, object, key]`.
 */
export const FOLDS: ReadonlyArray<readonly [string, string, string, string]> = [
	[`${F}chaal/admin/queries.ts`, "checkPublicLaneMutationOptions", "chaalAdminMutations", "checkPublicLane"],
	[`${F}chaal/analysis/queries.ts`, "saveAnalysisMutationOptions", "chaalAnalysisMutations", "save"],
	[`${F}chaal/analysis/queries.ts`, "deleteAnalysisMutationOptions", "chaalAnalysisMutations", "delete"],
	[`${F}chaal/analysis/queries.ts`, "importLichessGame", "chaalAnalysisMutations", "importGame"],
	[`${F}chaal/local/queries.ts`, "saveLocalGameOnAccount", "chaalLocalMutations", "save"],
	[`${F}chaal/local/queries.ts`, "deleteLocalGameOnAccount", "chaalLocalMutations", "delete"],
	[`${F}chaal/local/queries.ts`, "importLocalGamesToAccount", "chaalLocalMutations", "import"],
	[`${F}chaal/puzzles/queries.ts`, "recordAttemptOnAccount", "chaalPuzzlesMutations", "recordAttempt"],
	[`${F}chaal/puzzles/queries.ts`, "importAttemptsToAccount", "chaalPuzzlesMutations", "importAttempts"],
	[`${F}chaal/queries.ts`, "disconnectChaalMutationOptions", "chaalMutations", "disconnect"],
	[`${F}parda/admin/queries.ts`, "openLabPlayerMutationOptions", "pardaAdminMutations", "openLabPlayer"],
	[`${F}taskline/queries.ts`, "starProjectMutation", "tasklineMutations", "starProject"],
	[`${F}taskline/queries.ts`, "createProjectMutation", "tasklineMutations", "createProject"],
	[`${F}taskline/queries.ts`, "startSandboxMutation", "tasklineMutations", "startSandbox"],
];

// --- Declarations that change file ----------------------------------------------------------

/** `[file, names, target]`: declarations that leave for another file (TypeScript's "Move to file"). */
export const RELOCATIONS: ReadonlyArray<readonly [string, ReadonlyArray<string>, string]> = [
	// Query keys live in keys.ts.
	...(
		[
			["admin", "adminKeys"],
			["apps/forms", "formsKeys"],
			["apps/habits", "habitsKeys"],
			["apps/links", "linksKeys"],
			["apps/notes", "notesKeys"],
			["dev/examples", "exampleKeys"],
			["kharcha/admin", "kharchaAdminKeys"],
			["kharcha", "kharchaKeys"],
			["media", "mediaKeys"],
			["portfolio", "portfolioKeys"],
			["stack", "stackKeys"],
			["taskline", "tasklineKeys"],
		] as const
	).map(([folder, name]) => [`${F}${folder}/queries.ts`, [name], `${F}${folder}/keys.ts`] as const),
	// Loaders and what only they use live in load.ts.
	[`${F}chaal/events/queries.ts`, ["loadTournamentsPage", "loadTournamentPage"], `${F}chaal/events/load.ts`],
	[
		`${F}chaal/players/queries.ts`,
		["canReadFollowing", "loadPlayersPage", "loadPlayerPage"],
		`${F}chaal/players/load.ts`,
	],
	[`${F}chaal/puzzles/queries.ts`, ["ensureQuietly", "loadPuzzlesPage", "loadPuzzlePage"], `${F}chaal/puzzles/load.ts`],
	[
		`${F}chaal/studies/queries.ts`,
		["canUseStudies", "studiesAccount", "chapterShown", "loadStudiesPage", "loadStudyPage"],
		`${F}chaal/studies/load.ts`,
	],
	[`${F}chaal/teams/queries.ts`, ["canUseTeams", "loadTeamsPage", "loadTeamPage"], `${F}chaal/teams/load.ts`],
	[
		`${F}chaal/watch/queries.ts`,
		["roundShown", "loadWatchPage", "loadChannelPage", "loadBroadcastsPage", "loadBroadcastPage"],
		`${F}chaal/watch/load.ts`,
	],
	// What a collection file exported besides its rows, and a helper two files of the portfolio's admin share.
	[`${F}taskline/board/collections.ts`, ["DRAFT_RANK", "draftTask"], `${F}taskline/board/lib/draft.ts`],
	[`${F}portfolio/admin/queries.ts`, ["keyed"], `${F}portfolio/admin/lib/mutation-key.ts`],
	// Values with no logic live in constants.ts.
	[`${F}chaal/players/queries.ts`, ["DEFAULT_LEADERBOARD"], `${F}chaal/players/constants.ts`],
	[`${F}chaal/puzzles/queries.ts`, ["STREAK_FIRST"], `${F}chaal/puzzles/constants.ts`],
	[`${F}dev/examples/queries.ts`, ["OPTIMISTIC_SEARCH"], `${F}dev/examples/constants.ts`],
	// Everything else a queries.ts exported goes to lib/.
	[`${F}chaal/players/queries.ts`, ["gamesInputOf", "latestGamesInput"], `${F}chaal/players/lib/games-input.ts`],
	[`${F}chaal/players/queries.ts`, ["mainPerf"], `${F}chaal/players/lib/perf.ts`],
	[`${F}chaal/puzzles/queries.ts`, ["angleOf", "trainingInput"], `${F}chaal/puzzles/lib/training-input.ts`],
	[`${F}auth/queries.ts`, ["refreshAuth"], `${F}auth/lib/refresh.ts`],
	[`${F}kharcha/queries.ts`, ["refreshKharcha"], `${F}kharcha/lib/refresh.ts`],
	[`${F}kharcha/queries.ts`, ["exportKharcha"], `${F}kharcha/lib/export.ts`],
	[`${F}parda/library/queries.ts`, ["refreshLibrary"], `${F}parda/library/lib/refresh.ts`],
	[`${F}parda/admin/queries.ts`, ["searchTitleOptions"], `${F}parda/admin/lib/title-search.ts`],
	[`${F}taskline/queries.ts`, ["refreshTaskline"], `${F}taskline/lib/refresh.ts`],
	[`${F}taskline/queries.ts`, ["automationPreviewSource"], `${F}taskline/lib/automation-preview.ts`],
	[`${F}taskline/admin/queries.ts`, ["accountSearch"], `${F}taskline/admin/lib/account-search.ts`],
	[`${F}taskline/admin/queries.ts`, ["adminAutomationPreviewSource"], `${F}taskline/admin/lib/automation-preview.ts`],
	[`${F}taskline/admin/queries.ts`, ["isProjectKeyFree"], `${F}taskline/admin/lib/project-key.ts`],
	[
		`${F}portfolio/admin/queries.ts`,
		["section", "experienceSection", "skillSection", "processSection", "testimonialSection", "SectionQueries"],
		`${F}portfolio/admin/lib/sections.ts`,
	],
	// An exported hook lives in a use-<thing> file.
	[`${F}auth/components/bot-check.tsx`, ["useTurnstile"], `${F}auth/hooks/use-turnstile.ts`],
	[`${F}chaal/board/game-controls.tsx`, ["useBoardKeys"], `${F}chaal/board/hooks/use-board-keys.ts`],
	[`${F}chaal/community/header.tsx`, ["useAreaOn", "useLichessFor"], `${F}chaal/community/hooks/use-community-area.ts`],
	[`${F}chaal/live/store.ts`, ["useLive"], `${F}chaal/live/hooks/use-live.ts`],
	// useWaiting and useLiveNotices (chaal/shell), useFieldA11y and useAppForm (the forms kit) were split by hand:
	// TypeScript 6.0.3 fails on the first two ("Expected symbol to be a module"), the third is an index file.
	[`${F}parda/library/save-buttons.tsx`, ["useSaved"], `${F}parda/library/hooks/use-saved.ts`],
	[`${F}parda/library/title-progress.tsx`, ["useTitleProgress"], `${F}parda/library/hooks/use-title-progress.ts`],
	[`${F}parda/search/recent.ts`, ["useRememberViewed"], `${F}parda/search/hooks/use-remember-viewed.ts`],
	[
		`${F}taskline/shell/taskline-sidebar.tsx`,
		["useCurrentWorkspace"],
		`${F}taskline/shell/hooks/use-current-workspace.ts`,
	],
	["src/lib/section-brand.ts", ["useSectionBrand"], "src/hooks/use-section-brand.ts"],
	["src/lib/session-scope.ts", ["useSessionSkipped"], "src/hooks/use-session-skipped.ts"],
	[
		"src/components/data-table/row-actions.tsx",
		["usePermittedActions"],
		"src/components/data-table/use-permitted-actions.ts",
	],
	[
		"src/components/dialogs/confirm.tsx",
		["Confirm", "ConfirmContext", "useConfirm"],
		"src/components/dialogs/use-confirm.ts",
	],
	[
		"src/components/errors/section-home.tsx",
		// The context stays with its provider: alone, the provider's file is unused once every product is stripped.
		["useSectionHome"],
		"src/components/errors/use-section-home.ts",
	],
	[
		"src/components/forms/fields/async-combobox-field.tsx",
		["useAsyncOptions"],
		"src/components/forms/fields/use-async-options.ts",
	],
	[
		"src/components/forms/form-meta.tsx",
		["FieldEntry", "FormMeta", "FormMetaContext", "useFormMeta"],
		"src/components/forms/use-form-meta.ts",
	],
	["src/components/layout/skip-link.tsx", ["useInsideMain"], "src/components/layout/use-inside-main.ts"],
];

// --- Files -------------------------------------------------------------------------------------

/**
 * Files whose new place no rule decides: `[from, to]`. Whole files that export hooks become
 * `use-<thing>` files; a server module becomes a folder; tests are named after their subject.
 */
export const FILE_MOVES: ReadonlyArray<readonly [string, string]> = [
	[`${F}rbac/can.tsx`, `${F}rbac/hooks/use-can.ts`],
	[`${F}chaal/live/fair-play.ts`, `${F}chaal/live/hooks/use-fair-play.ts`],
	[`${F}chaal/shell/zen.ts`, `${F}chaal/shell/hooks/use-zen.ts`],
	[`${F}kharcha/shell/actions.tsx`, `${F}kharcha/shell/hooks/use-kharcha-actions.ts`],
	[`${F}parda/player/picture-in-picture.ts`, `${F}parda/player/hooks/use-picture-in-picture.ts`],
	[`${F}parda/player/redirect-guard.ts`, `${F}parda/player/hooks/use-redirect-guard.ts`],
	[`${F}taskline/freshness.ts`, `${F}taskline/hooks/use-project-freshness.ts`],
	[`${F}taskline/saved-views.ts`, `${F}taskline/hooks/use-saved-views.ts`],
	["src/lib/stores/hooks.ts", "src/lib/stores/use-stores.ts"],
	// A sentence builder with no JSX.
	[`${F}kharcha/home/recent-line.tsx`, `${F}kharcha/home/lib/recent-line.ts`],
	// Folders that are not features: their files are part of the feature's lib/.
	...["ast", "check", "edit", "parse", "print", "suggest"].map(
		(name) => [`${F}kharcha/spend/query/${name}.ts`, `${F}kharcha/spend/lib/query/${name}.ts`] as const,
	),
	[`${F}parda/player/adapters/index.ts`, `${F}parda/player/lib/adapters/index.ts`],
	["src/lib/env/client.schema.ts", "src/lib/env/client-schema.ts"],
	["src/server/parda/library/saved-repository.ts", "src/server/parda/library/saved/repository.ts"],
	...["messages", "posts", "profile", "projects", "sections"].flatMap((name) =>
		(["repository", "service"] as const).map(
			(kind) => [`src/server/portfolio/${name}-${kind}.ts`, `src/server/portfolio/${name}/${kind}.ts`] as const,
		),
	),
	["tests/email/templates.test.ts", "tests/unit/email-templates.test.ts"],
	["tests/i18n/locale-routing.test.ts", "tests/unit/i18n-locale-routing.test.ts"],
	["tests/i18n/message-parity.test.ts", "tests/unit/i18n-message-parity.test.ts"],
	["tests/i18n/message-usage.test.ts", "tests/unit/i18n-message-usage.test.ts"],
	["tests/server/example-tasks.test.ts", "tests/server/examples-tasks.test.ts"],
	["tests/server/guarded-functions.test.ts", "tests/server/functions-guards.test.ts"],
	["tests/server/guards.test.ts", "tests/server/middleware.test.ts"],
	["tests/server/recipes.test.ts", "tests/server/rate-limit-and-cursor.test.ts"],
	["tests/unit/commit-msg.test.ts", "tests/unit/check-commit-msg.test.ts"],
	["tests/unit/design-tokens.test.ts", "tests/unit/styles-tokens.test.ts"],
	["tests/unit/e2e-pages.test.ts", "tests/unit/pages-review.test.ts"],
	["tests/unit/gate-workers.test.ts", "tests/unit/workers.test.ts"],
	// Named after a file of Taskline (automations/form.ts) by chance: a stripped tree has no "form".
	["tests/unit/form-method.test.ts", "tests/unit/forms-method.test.ts"],
	["tests/unit/habit-streaks.test.ts", "tests/unit/habits-streaks.test.ts"],
	["tests/unit/himal-tokens.test.ts", "tests/unit/portfolio-tokens.test.ts"],
	["tests/unit/hotkeys.test.ts", "tests/unit/use-hotkeys.test.ts"],
];

/**
 * A component file's new name, ending in the role of what it renders (COMPONENT_ROLES). Keys are
 * paths under src/features without `.tsx`; the value is the new file name. The file's stories
 * follow it, and a file outside `components/` also moves into it.
 */
export const ROLE_NAMES: Record<string, string> = {
	"admin/components/appearance-settings": "appearance-settings-section",
	"admin/components/dashboard": "dashboard-page",
	"apps/forms/components/builder-canvas": "builder-canvas-panel",
	"apps/forms/components/field-settings": "field-settings-panel",
	"apps/forms/components/form-builder": "form-builder-page",
	"apps/forms/components/form-renderer": "rendered-form",
	"apps/forms/components/form-results": "form-results-page",
	"apps/forms/components/forms-home": "forms-home-page",
	"apps/habits/components/habit-heatmap": "habit-heatmap-chart",
	"apps/habits/components/habits-home": "habits-home-page",
	"apps/links/admin/components/links-moderation": "links-moderation-page",
	"apps/links/components/links-home": "links-home-page",
	"apps/notes/components/notes-home": "notes-home-page",
	"apps/notes/components/shared-note": "shared-note-page",
	"auth/components/bot-check": "bot-check-field",
	"auth/components/check-email": "check-email-card",
	"chaal/about/chaal-about": "chaal-about-page",
	"chaal/analysis/analysis-dialogs": "analysis-dialog",
	"chaal/analysis/my-analyses": "my-analyses-list",
	"chaal/analysis/node-tools": "node-tools-bar",
	"chaal/auth/chaal-sign-in": "chaal-sign-in-page",
	"chaal/auth/chaal-sign-up": "chaal-sign-up-page",
	"chaal/board/clock": "clock-badge",
	"chaal/board/eval-graph": "eval-chart",
	"chaal/board/game-controls": "game-controls-bar",
	"chaal/board/material": "material-row",
	"chaal/board/opening-name": "opening-name-badge",
	"chaal/board/plate": "board-frame",
	"chaal/board/player-strip": "player-bar",
	"chaal/board/shapes": "shapes-overlay",
	"chaal/game/live-chat": "live-chat-panel",
	"chaal/home/chaal-home": "chaal-home-page",
	"chaal/home/home-sections": "home-section",
	"chaal/local/choice": "choice-picker",
	"chaal/local/game-history": "game-history-list",
	"chaal/local/play-hub": "play-hub-page",
	"chaal/play/online-play": "online-play-panel",
	"chaal/play/quick-pair": "quick-pair-panel",
	"chaal/players/online-dot": "online-badge",
	"chaal/players/player-games": "player-games-panel",
	"chaal/puzzles/puzzle-choices": "puzzle-choices-panel",
	"chaal/puzzles/puzzle-progress": "puzzle-progress-panel",
	"chaal/puzzles/puzzle-solver": "puzzle-solver-board",
	"chaal/settings/chaal-settings": "chaal-settings-page",
	"chaal/shell/live-notices": "live-notices-menu",
	"chaal/shell/palette-players": "players-palette",
	"dev/examples/kit-components": "kit-components-gallery",
	"dev/examples/kit-fields": "kit-fields-gallery",
	"dev/forms-showcase": "forms-showcase-page",
	"kharcha/auth/kharcha-account": "kharcha-account-page",
	"kharcha/auth/kharcha-sign-in": "kharcha-sign-in-page",
	"kharcha/auth/kharcha-sign-up": "kharcha-sign-up-page",
	"kharcha/budgets/budget-meter": "budget-bar",
	"kharcha/budgets/budgets-tab": "budgets-panel",
	"kharcha/expenses/receipt-viewer": "receipt-dialog",
	"kharcha/groups/group-balances": "group-balances-list",
	"kharcha/groups/group-settings": "group-settings-panel",
	"kharcha/groups/group-totals": "group-totals-panel",
	"kharcha/groups/pickers": "group-icon-picker",
	"kharcha/home/kharcha-home": "kharcha-home-page",
	"kharcha/home/onboarding": "onboarding-card",
	"kharcha/home/todos": "todo-list",
	"kharcha/home/updates": "updates-list",
	"kharcha/insights/heatmap": "heatmap-calendar",
	"kharcha/insights/month-currency": "month-currency-bar",
	"kharcha/insights/overview": "overview-panel",
	"kharcha/insights/statement": "statement-panel",
	"kharcha/insights/trends": "trends-panel",
	"kharcha/kit/cards": "kharcha-card",
	"kharcha/kit/empty": "kharcha-empty-panel",
	"kharcha/kit/group-plate": "group-plate-icon",
	"kharcha/kit/ledger": "ledger-panel",
	"kharcha/kit/money": "money-badge",
	"kharcha/kit/wordmark": "kharcha-mark",
	"kharcha/landing/kharcha-landing": "kharcha-landing-page",
	"kharcha/settings/list-dialogs": "list-dialog",
	"kharcha/settings/pickers": "color-icon-picker",
	"kharcha/shell/create-dialogs": "create-dialog",
	"kharcha/shell/kharcha-art": "kharcha-art-image",
	"kharcha/spend/saved-dialogs": "saved-search-dialog",
	"kharcha/threads/comment-line": "comment-row",
	"kharcha/threads/friend-dialogs": "friend-dialog",
	"kharcha/threads/thread-lines": "thread-line-list",
	"media/components/media-library": "media-library-gallery",
	"parda/about/parda-about": "parda-about-page",
	"parda/admin/curation/title-fields": "title-list-field",
	"parda/auth/parda-sign-in": "parda-sign-in-page",
	"parda/auth/parda-sign-up": "parda-sign-up-page",
	"parda/home/catalog-unconfigured": "catalog-unconfigured-panel",
	"parda/home/title-rails": "title-rail",
	"parda/kit/badges": "title-badge",
	"parda/kit/billboard": "billboard-hero",
	"parda/kit/cards": "title-card",
	"parda/library/for-you-rails": "for-you-rail",
	"parda/library/save-buttons": "save-button",
	"parda/library/title-progress": "title-progress-button",
	"parda/party/watch-together": "watch-together-button",
	"parda/player/player-chrome": "player-chrome-overlay",
	"parda/player/watch-panels": "watch-panel",
	"parda/schedule/bell": "bell-menu",
	"parda/title/episodes": "episodes-section",
	"parda/title/title-sections": "title-section",
	"portfolio/admin/components/case-study-blocks": "case-study-blocks-editor",
	"portfolio/admin/components/field-groups": "grouped-field",
	"portfolio/admin/components/messages-inbox": "messages-inbox-page",
	"portfolio/admin/components/project-pages": "project-page",
	"portfolio/admin/components/section-pages": "section-page",
	"portfolio/admin/components/shared": "preview-link",
	"portfolio/components/art/hero-range": "hero-range-image",
	"portfolio/components/art/project-mountain": "project-mountain-image",
	"portfolio/components/art/relief": "relief-image",
	"portfolio/components/art/sky": "sky-image",
	"portfolio/components/case-study/architecture-diagram": "architecture-chart",
	"portfolio/components/case-study/case-study-body": "case-study-body-section",
	"portfolio/components/case-study/next-project": "next-project-link",
	"portfolio/components/case-study/screens": "screens-gallery",
	"portfolio/components/chrome/availability": "availability-badge",
	"portfolio/components/chrome/draft-notice": "draft-banner",
	"portfolio/components/chrome/home-time": "home-time-badge",
	"portfolio/components/chrome/portfolio-not-found": "portfolio-not-found-page",
	"portfolio/components/content/code-block": "code-block-panel",
	"portfolio/components/content/pull-quote": "pull-quote-card",
	"portfolio/components/journal/article-body": "article-body-section",
	"portfolio/components/journal/post-line": "post-row",
	"portfolio/components/primitives/archival-picture": "archival-image",
	"portfolio/components/primitives/figure-lines": "figure-lines-icon",
	"portfolio/components/primitives/fitted-email": "fitted-email-link",
	"portfolio/components/primitives/fitted-name": "fitted-name-mark",
	"portfolio/components/primitives/links": "text-link",
	"portfolio/components/primitives/section-heading": "section-header",
	"portfolio/components/story-helpers": "story-frame",
	"rbac/components/permission-matrix": "permission-matrix-grid",
	"taskline/admin/members/member-dialogs": "member-dialog",
	"taskline/admin/projects/project-details": "project-detail",
	"taskline/admin/time/time-dialogs": "time-dialog",
	"taskline/auth/taskline-account": "taskline-account-page",
	"taskline/auth/taskline-sign-in": "taskline-sign-in-page",
	"taskline/auth/taskline-sign-up": "taskline-sign-up-page",
	"taskline/automations/automation-runs": "automation-runs-list",
	"taskline/custom-fields/task-field-editors": "task-field-editor",
	"taskline/home/taskline-home": "taskline-home-page",
	"taskline/inbox/notify-settings": "notify-settings-page",
	"taskline/landing/taskline-landing": "taskline-landing-page",
	"taskline/projects/project-directory": "project-directory-list",
	"taskline/projects/project-overview": "project-overview-panel",
	"taskline/projects/project-updates": "project-updates-list",
	"taskline/projects/task-filters": "task-filter-bar",
	"taskline/reports/report-parts": "report-card",
	"taskline/settings/automations-settings": "automations-settings-panel",
	"taskline/settings/fields-settings": "fields-settings-panel",
	"taskline/settings/general-settings": "general-settings-panel",
	"taskline/settings/labels-settings": "labels-settings-panel",
	"taskline/settings/members-settings": "members-settings-panel",
	"taskline/settings/trash-settings": "trash-settings-panel",
	"taskline/settings/workflow-settings": "workflow-settings-panel",
	"taskline/shell/taskline-art": "taskline-art-image",
	"taskline/sprints/active-sprints": "active-sprint-list",
	"taskline/sprints/backlog": "backlog-list",
	"taskline/sprints/sprint-bits": "sprint-progress-bar",
	"taskline/sprints/sprint-dialogs": "sprint-dialog",
	"taskline/sprints/sprint-report": "sprint-report-page",
	"taskline/task/activity": "activity-row",
	"taskline/task/conversation": "conversation-thread",
	"taskline/task/task-bits": "task-badge",
	"taskline/time/project-time": "project-time-page",
	"taskline/time/task-time": "task-time-panel",
	"taskline/time/timer": "timer-button",
	"taskline/time/timesheet": "timesheet-grid",
	"taskline/timeline/dependencies": "task-dependencies-panel",
};

/** Messages spell the product's name: `ch_` and `pd_` stay the tables' prefixes only. */
export const MESSAGE_PREFIXES: ReadonlyArray<readonly [string, string]> = [
	["ch_", "chaal_"],
	["pd_", "parda_"],
];

/**
 * Files the codemod never rewrites: the records keep their words (0163), and the standard's own
 * test fixtures name paths that are deviations on purpose.
 */
export const RECORDS: ReadonlyArray<string> = [
	"docs/PLAN.md",
	"docs/decisions.md",
	"docs/history/",
	"docs/design/",
	"tests/unit/standard/",
	"tests/fixtures/",
	"scripts/codemods/",
	"scripts/audit/",
	"drizzle/",
	"pnpm-lock.yaml",
];
