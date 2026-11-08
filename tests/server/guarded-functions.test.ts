import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Permission } from "@/features/rbac/permissions";

/**
 * Every server function file is declared here, so a new one can't ship unguarded
 * by accident: a file in src/functions/ that is in neither list fails the test.
 *
 * GUARDED_FUNCTIONS: each function and the permission it requires, in file order.
 * Add a new feature's functions file here (README, "Test CRUD: the template for
 * new features", step 4).
 */
const GUARDED_FUNCTIONS: Record<string, ReadonlyArray<[name: string, permission: Permission]>> = {
	"test-crud.ts": [
		["listTestCrud", "test-crud:read"],
		["listTestCrudTags", "test-crud:read"],
		["getTestCrud", "test-crud:read"],
		["isTestCrudSlugFree", "test-crud:read"],
		["createTestCrud", "test-crud:create"],
		["updateTestCrud", "test-crud:update"],
		["setTestCrudStatus", "test-crud:publish"],
		["deleteTestCrud", "test-crud:delete"],
	],
	"rbac.ts": [
		["listRoles", "roles:read"],
		["listRoleOptions", "users:read"],
		["createRole", "roles:manage"],
		["updateRole", "roles:manage"],
		["deleteRole", "roles:manage"],
		["updateRolePermissions", "roles:manage"],
		["listUsers", "users:read"],
		["setUserRoles", "users:update"],
		["setUserBanned", "users:ban"],
		["revokeUserSessions", "users:ban"],
		["isUserEmailFree", "users:invite"],
		["inviteUser", "users:invite"],
		// Admins only on top: the service refuses everyone else (decisions.md 0134).
		["impersonateUser", "users:update"],
	],
	"audit.ts": [["listAuditEvents", "audit:read"]],
	"attachments.ts": [
		["getUploadSettings", "attachments:upload"],
		["signImageUpload", "attachments:upload"],
		["confirmImageUpload", "attachments:upload"],
		["discardImageUpload", "attachments:upload"],
	],
	"examples-permissions.ts": [
		["exampleReadItems", "test-crud:read"],
		["exampleManageRoles", "roles:manage"],
	],
	// portfolio:start
	"portfolio.ts": [
		["getPortfolioProfile", "portfolio:read"],
		["updatePortfolioProfile", "portfolio:write"],
		["listProjects", "portfolio:read"],
		["listProjectOrder", "portfolio:read"],
		["getProject", "portfolio:read"],
		["isProjectSlugFree", "portfolio:read"],
		["createProject", "portfolio:write"],
		["updateProject", "portfolio:write"],
		["setProjectStatus", "portfolio:publish"],
		["deleteProjects", "portfolio:write"],
		["reorderProjects", "portfolio:write"],
		["listPosts", "portfolio:read"],
		["getPost", "portfolio:read"],
		["isPostSlugFree", "portfolio:read"],
		["createPost", "portfolio:write"],
		["updatePost", "portfolio:write"],
		["setPostStatus", "portfolio:publish"],
		["deletePosts", "portfolio:write"],
	],
	"portfolio-sections.ts": [
		["listExperience", "portfolio:read"],
		["createExperience", "portfolio:write"],
		["updateExperience", "portfolio:write"],
		["deleteExperience", "portfolio:write"],
		["reorderExperience", "portfolio:write"],
		["listSkills", "portfolio:read"],
		["createSkill", "portfolio:write"],
		["updateSkill", "portfolio:write"],
		["deleteSkills", "portfolio:write"],
		["reorderSkills", "portfolio:write"],
		["listProcessSteps", "portfolio:read"],
		["createProcessStep", "portfolio:write"],
		["updateProcessStep", "portfolio:write"],
		["deleteProcessSteps", "portfolio:write"],
		["reorderProcessSteps", "portfolio:write"],
		["listTestimonials", "portfolio:read"],
		["createTestimonial", "portfolio:write"],
		["updateTestimonial", "portfolio:write"],
		["deleteTestimonials", "portfolio:write"],
		["reorderTestimonials", "portfolio:write"],
	],
	"portfolio-messages.ts": [
		["listContactMessages", "messages:read"],
		["setContactMessageState", "messages:manage"],
		["deleteContactMessages", "messages:manage"],
	],
	"media.ts": [
		["listMedia", "media:read"],
		["updateMediaAlt", "media:write"],
		["deleteMedia", "media:write"],
	],
	// portfolio:end
	// apps:start
	"apps/admin.ts": [["getAppsUsage", "apps:read"]],
	"apps/links-admin.ts": [
		["listLinksForModeration", "links:moderate"],
		["setLinksBlocked", "links:moderate"],
		["deleteModeratedLinks", "links:moderate"],
	],
	// apps:end
	// taskline:start
	"taskline-admin/overview.ts": [["getTasklineOverview", "taskline:read"]],
	"taskline-admin/projects.ts": [
		["listTasklineAdminProjects", "taskline:read"],
		["getTasklineAdminProject", "taskline:read"],
		["isTasklineProjectKeyFree", "taskline:manage"],
		["createTasklineAdminProject", "taskline:manage"],
		["updateTasklineAdminProject", "taskline:manage"],
		["setTasklineAdminProjectState", "taskline:manage"],
		["setTasklineAdminProjectArchived", "taskline:manage"],
		["transferTasklineProjectLead", "taskline:manage"],
		["deleteTasklineAdminProject", "taskline:manage"],
		["exportTasklineAdminProject", "taskline:read"],
		["setTasklineAdminProjectMember", "taskline:manage"],
		["removeTasklineAdminProjectMember", "taskline:manage"],
	],
	"taskline-admin/members.ts": [
		["listTasklineMembers", "taskline:read"],
		["listTasklineMemberOptions", "taskline:read"],
		["searchTasklineAccounts", "taskline:manage"],
		["addTasklineMembers", "taskline:manage"],
		["updateTasklineMember", "taskline:manage"],
		["deactivateTasklineMember", "taskline:manage"],
		["reactivateTasklineMember", "taskline:manage"],
		["listTasklineInvitations", "taskline:read"],
		["inviteTasklineMember", "taskline:manage"],
		["resendTasklineInvitation", "taskline:manage"],
		["revokeTasklineInvitation", "taskline:manage"],
	],
	"taskline-admin/settings.ts": [
		["getTasklineWorkspace", "taskline:configure"],
		["updateTasklineWorkspace", "taskline:configure"],
		["getTasklineWorkflows", "taskline:configure"],
		["updateTasklineWorkflows", "taskline:configure"],
		["createTasklineWorkspaceLabel", "taskline:configure"],
		["updateTasklineWorkspaceLabel", "taskline:configure"],
		["deleteTasklineWorkspaceLabel", "taskline:configure"],
	],
	"taskline-admin/templates.ts": [
		["listTasklineAdminTemplates", "taskline:configure"],
		["createTasklineAdminTemplate", "taskline:configure"],
		["updateTasklineAdminTemplate", "taskline:configure"],
		["deleteTasklineAdminTemplate", "taskline:configure"],
		["saveTasklineProjectAsTemplate", "taskline:configure"],
		["listTasklineAdminTemplateChoices", "taskline:manage"],
	],
	"taskline-admin/reports.ts": [["getTasklineAdminReports", "taskline:read"]],
	"taskline-admin/automations.ts": [
		["listTasklineWorkspaceAutomations", "taskline:configure"],
		["createTasklineWorkspaceAutomation", "taskline:configure"],
		["updateTasklineWorkspaceAutomation", "taskline:configure"],
		["toggleTasklineWorkspaceAutomation", "taskline:configure"],
		["deleteTasklineWorkspaceAutomation", "taskline:configure"],
		["previewTasklineWorkspaceAutomation", "taskline:configure"],
	],
	"taskline-admin/fields.ts": [
		["listTasklineWorkspaceFields", "taskline:configure"],
		["createTasklineWorkspaceField", "taskline:configure"],
		["updateTasklineWorkspaceField", "taskline:configure"],
		["deleteTasklineWorkspaceField", "taskline:configure"],
	],
	"taskline-admin/activity.ts": [
		["listTasklineActivity", "taskline:read"],
		["getTasklineActivityOptions", "taskline:read"],
	],
	"taskline-admin/time.ts": [
		["listTasklineTimeEntries", "taskline:time"],
		["getTasklineTimeOptions", "taskline:time"],
		["updateTasklineAdminTimeEntry", "taskline:time"],
		["deleteTasklineAdminTimeEntry", "taskline:time"],
		["setTasklineTimesheetLock", "taskline:time"],
		["getTasklineUtilization", "taskline:time"],
		["exportTasklineTimeEntries", "taskline:time"],
	],
	// taskline:end
	// parda:start
	"parda-admin/curation.ts": [
		["searchPardaTitles", "parda:curate"],
		["listPardaBillboards", "parda:read"],
		["getPardaBillboard", "parda:read"],
		["createPardaBillboard", "parda:curate"],
		["updatePardaBillboard", "parda:curate"],
		["reorderPardaBillboards", "parda:curate"],
		["deletePardaBillboards", "parda:curate"],
		["listPardaCollections", "parda:read"],
		["getPardaAdminCollection", "parda:read"],
		["createPardaCollection", "parda:curate"],
		["updatePardaCollection", "parda:curate"],
		["deletePardaCollections", "parda:curate"],
		["getPardaLayout", "parda:read"],
		["savePardaLayout", "parda:curate"],
	],
	"parda-admin/overview.ts": [["getPardaOverview", "parda:read"]],
	"parda-admin/player-lab.ts": [
		["listPardaLabSources", "parda:configure"],
		["openPardaLabPlayer", "parda:configure"],
	],
	"parda-admin/reports.ts": [
		["listPardaReports", "parda:read"],
		["setPardaReportStatus", "parda:moderate"],
	],
	"parda-admin/settings.ts": [
		["getPardaSettings", "parda:read"],
		["updatePardaSettings", "parda:configure"],
		["setPardaPlayback", "parda:configure"],
		["setPardaSourceOrder", "parda:configure"],
		["purgePardaCache", "parda:configure"],
	],
	"parda-admin/sources.ts": [
		["listPardaSources", "parda:read"],
		["getPardaSource", "parda:read"],
		["createPardaSource", "parda:configure"],
		["updatePardaSource", "parda:configure"],
		["setPardaSourceState", "parda:configure"],
		["reorderPardaSources", "parda:configure"],
		["deletePardaSources", "parda:configure"],
	],
	"parda-admin/titles.ts": [
		["listPardaTakedowns", "parda:read"],
		["blockPardaTitle", "parda:moderate"],
		["unblockPardaTitles", "parda:moderate"],
	],
	// parda:end
	// chaal:start
	"chaal-admin/lab.ts": [
		["getChaalLab", "chaal:configure"],
		["checkChaalPublicLane", "chaal:configure"],
	],
	// chaal:end
	// @new-feature:guarded-functions
};

// apps:start
/**
 * The showcase apps' files (decision 0187): every function runs `requireAppUser` then
 * `withAppServices` first. No permission is involved (guests use the apps too); each
 * service scopes every read and write to the caller's own rows (`ownedBy`, tested in
 * tests/server/apps-notes.test.ts and the others).
 */
const APP_FUNCTIONS: Record<string, ReadonlyArray<string>> = {
	"apps/notes.ts": [
		"listNotes",
		"searchNotes",
		"getNote",
		"createNote",
		"updateNote",
		"setNoteFlags",
		"shareNote",
		"unshareNote",
		"deleteNote",
		"getNoteUploadSettings",
		"signNoteImageUpload",
		"confirmNoteImageUpload",
		"discardNoteImageUpload",
	],
	"apps/links.ts": ["listLinks", "getLinkStats", "createLink", "updateLink", "deleteLink"],
	"apps/expenses.ts": [
		"getExpensesMonth",
		"createExpense",
		"updateExpense",
		"deleteExpense",
		"listExpenseCategories",
		"createExpenseCategory",
		"updateExpenseCategory",
		"deleteExpenseCategory",
		"setExpenseBudget",
		"importExpenses",
		"exportExpenses",
	],
	"apps/forms.ts": [
		"listForms",
		"getForm",
		"createForm",
		"saveForm",
		"setFormStatus",
		"deleteForm",
		"getFormResults",
		"exportFormResponses",
	],
	"apps/habits.ts": ["getHabitsOverview", "getHabit", "createHabit", "updateHabit", "deleteHabit", "setHabitCheckin"],
};
// apps:end

// taskline:start
/**
 * Taskline's app files (docs/guides/taskline.md, decision 0204): every function runs
 * `requireTasklineUser` then `withTasklineServices` first (guests have a sandbox), and
 * its service resolves the workspace and project before anything else (the access
 * matrix: tests/server/taskline-access.test.ts). Its admin files (taskline-admin/) are
 * guarded by permission, in GUARDED_FUNCTIONS.
 */
const TASKLINE_FUNCTIONS: Record<string, ReadonlyArray<string>> = {
	"taskline/home.ts": ["getTasklineNav", "listMyTasklineTasks"],
	"taskline/find.ts": [
		"searchTasklineTasks",
		"findTasklineTasks",
		"listTasklineSavedViews",
		"saveTasklineSavedView",
		"deleteTasklineSavedView",
		"importTasklineTasks",
	],
	"taskline/collab.ts": [
		"addTasklineComment",
		"updateTasklineComment",
		"deleteTasklineComment",
		"watchTasklineTask",
		"addTasklineTaskFiles",
		"removeTasklineTaskFile",
		"getTasklineUploadSettings",
		"signTasklineUpload",
		"confirmTasklineUpload",
		"discardTasklineUpload",
	],
	"taskline/inbox.ts": [
		"listTasklineInbox",
		"getTasklineUnread",
		"markTasklineRead",
		"getTasklineNotifySettings",
		"saveTasklineNotifySettings",
	],
	"taskline/sprints.ts": [
		"createTasklineSprint",
		"updateTasklineSprint",
		"deleteTasklineSprint",
		"startTasklineSprint",
		"completeTasklineSprint",
		"rankTasklineTask",
		"getTasklineSprintReport",
	],
	"taskline/time.ts": [
		"startTasklineTimer",
		"stopTasklineTimer",
		"logTasklineTime",
		"updateTasklineTimeEntry",
		"deleteTasklineTimeEntry",
		"setTasklineTimesheetCell",
		"copyTasklineTimesheetWeek",
		"getTasklineTimesheet",
		"getTasklineProjectTime",
	],
	"taskline/timeline.ts": [
		"createTasklineMilestone",
		"updateTasklineMilestone",
		"deleteTasklineMilestone",
		"addTasklineDependency",
		"removeTasklineDependency",
	],
	"taskline/fields.ts": ["createTasklineField", "updateTasklineField", "deleteTasklineField"],
	"taskline/templates.ts": ["listTasklineTemplates"],
	"taskline/reports.ts": ["getTasklineProjectReports"],
	"taskline/automations.ts": [
		"listTasklineAutomations",
		"createTasklineAutomation",
		"updateTasklineAutomation",
		"toggleTasklineAutomation",
		"deleteTasklineAutomation",
		"previewTasklineAutomation",
	],
	"taskline/workspaces.ts": ["getTasklineWorkspace", "startTasklineSandbox", "listTasklineMembers"],
	"taskline/projects.ts": [
		"listTasklineProjects",
		"createTasklineProject",
		"updateTasklineProject",
		"setTasklineProjectState",
		"setTasklineProjectArchived",
		"setTasklineProjectStar",
		"joinTasklineProject",
		"listTasklineProjectMembers",
		"setTasklineProjectMember",
		"removeTasklineProjectMember",
		"listTasklineProjectUpdates",
		"postTasklineProjectUpdate",
		"deleteTasklineProjectUpdate",
		"locateTasklineProject",
	],
	"taskline/workflow.ts": [
		"createTasklineStatus",
		"updateTasklineStatus",
		"deleteTasklineStatus",
		"createTasklineLabel",
		"updateTasklineLabel",
		"deleteTasklineLabel",
	],
	"taskline/tasks.ts": [
		"listTasklineTasks",
		"getTasklineTask",
		"createTasklineTask",
		"updateTasklineTask",
		"patchTasklineTask",
		"moveTasklineTask",
		"setTasklineChecklist",
		"trashTasklineTask",
		"restoreTasklineTask",
		"listTasklineTrash",
		"listTasklineTaskPage",
		"bulkUpdateTasklineTasks",
		"purgeTasklineTask",
		"listTasklineProjectActivity",
		"getTasklineProjectRev",
	],
};
// taskline:end

// parda:start
/**
 * Parda's catalogue files (PLAN 12.5, decision 0234): open to everyone, signed in or
 * not, so no permission; every function starts with `withPardaCatalog`, whose service
 * (src/server/parda/catalog/service.ts) is the only way to TMDB and applies takedowns
 * and the cache epoch. Its admin files (parda-admin/) are guarded by permission, in
 * GUARDED_FUNCTIONS.
 */
const PARDA_PUBLIC_FUNCTIONS: Record<string, ReadonlyArray<string>> = {
	"parda/catalog.ts": [
		"getPardaHub",
		"getPardaRail",
		"getPardaTitle",
		"getPardaSeason",
		"getPardaCredits",
		"getPardaPerson",
		"getPardaCollection",
		"getPardaCurated",
		"getPardaSurprise",
		"getPardaBanner",
	],
	"parda/search.ts": ["getPardaSearch", "getPardaSuggest", "notePardaSearch", "getPardaDiscover"],
	"parda/watch.ts": ["getPardaWatch", "getPardaParty", "recordPardaPlay", "reportPardaProblem"],
	"parda/schedule.ts": ["getPardaAnimeWeek"],
};

/**
 * Parda's library, profiles and alerts (decisions 0236, 0240 and 0241): anyone with a session, guests included. Each runs
 * requirePardaViewer (the session and the active profile) then withPardaServices, and
 * acts on that profile only (tests/server/parda-access.test.ts).
 */
const PARDA_FUNCTIONS: Record<string, ReadonlyArray<string>> = {
	"parda/library.ts": [
		"getPardaViewer",
		"getPardaContinue",
		"getPardaTitleProgress",
		"savePardaProgress",
		"markPardaWatched",
		"removePardaContinue",
		"rewatchPardaTitle",
		"importPardaProgress",
		"getPardaSaved",
		"setPardaListed",
		"setPardaPersonFavourite",
		"ratePardaTitle",
		"getPardaLibrary",
		"getPardaHistory",
		"removePardaHistory",
		"clearPardaHistory",
		"getPardaForYou",
	],
	"parda/profiles.ts": [
		"getPardaProfiles",
		"createPardaProfile",
		"updatePardaProfile",
		"deletePardaProfile",
		"setPardaProfilePin",
		"switchPardaProfile",
		"setPardaDigest",
	],
	"parda/alerts.ts": ["getPardaInbox", "markPardaInboxRead", "getPardaFollowing"],
	"parda/party.ts": [
		"createPardaParty",
		"joinPardaParty",
		"getPardaPartyToken",
		"pulsePardaParty",
		"leavePardaParty",
		"setPardaPartySource",
		"takeOverPardaParty",
		"endPardaParty",
	],
};
// parda:end

// chaal:start
/**
 * Chaal's public files (PLAN 13.5, decision 0254): open to everyone, signed in or not, so no
 * permission; every function starts with `withChaalPublic`, whose context holds the only
 * Lichess client (its lanes, cooldowns and cache). Its admin files (chaal-admin/) are guarded
 * by permission, in GUARDED_FUNCTIONS.
 */
const CHAAL_PUBLIC_FUNCTIONS: Record<string, ReadonlyArray<string>> = {
	"chaal/status.ts": ["getChaalStatus"],
	"chaal/analysis.ts": ["getChaalCloudEval", "getChaalExplorer", "getChaalTablebase", "importChaalGame"],
};

/**
 * Chaal's personal files (decision 0256): anyone with a session, guests included. Each runs
 * requireChaalUser (the session, not blocked) then withChaalServices, and acts on the
 * caller's own connection only (tests/server/chaal-access.test.ts).
 */
const CHAAL_FUNCTIONS: Record<string, ReadonlyArray<string>> = {
	"chaal/connection.ts": ["getChaalConnection", "disconnectChaal"],
	"chaal/preferences.ts": ["getChaalPreferences", "saveChaalPreferences", "importChaalPreferences"],
	"chaal/analyses.ts": ["listChaalAnalyses", "getChaalAnalysis", "saveChaalAnalysis", "deleteChaalAnalysis"],
};
// chaal:end

/**
 * Files whose functions deliberately don't require a permission, with why, and
 * the functions they hold (adding one to these files also needs a look here).
 */
const UNGUARDED_FILES: Record<string, { why: string; functions: ReadonlyArray<string> }> = {
	"auth.ts": {
		why: "the session itself; per-user functions use requireUserMiddleware (account changes requireAccountOwnerMiddleware), the admin gate requireAdminAccessMiddleware",
		functions: [
			"getSession",
			"getAuthFeatures",
			"ensureAdminAccess",
			"listMySessions",
			"revokeMySession",
			"getAccountSecurity",
			"setMyPassword",
			"stopImpersonating",
		],
	},
	"admin.ts": {
		why: "the admin area's gate (requireAdminAccessMiddleware); the dashboard fills only the parts whose read permission the user holds",
		functions: ["getDashboard"],
	},
	"guests.ts": {
		why: "moves this browser's guest data to the signed-in account (requireUserMiddleware: accounts only; the guest comes from a signed httpOnly cookie, decision 0186)",
		functions: ["claimGuestData"],
	},
	// portfolio:start
	"portfolio-public.ts": {
		why: "the portfolio's public pages and contact form: published content only; drafts only in a preview the handler grants to a session holding portfolio:read; the form is rate limited, Turnstile-checked and honeypotted",
		functions: [
			"getPublicProfile",
			"getHome",
			"getWork",
			"getCaseStudy",
			"getAbout",
			"getJournal",
			"getArticle",
			// apps:start
			"getAppCaseStudies",
			// apps:end
			"submitContactMessage",
		],
	},
	// portfolio:end
	// apps:start
	"apps/notes-public.ts": {
		why: "the public page of a shared note: only a note its owner (an account) shared, by its random token (decision 0190)",
		functions: ["getSharedNote"],
	},
	"apps/forms-public.ts": {
		why: "a published form's public page and its submissions: only an account's published form, by its random slug; submissions are honeypotted, Turnstile-checked, rate limited per sender and checked against the form's own schema (decision 0195)",
		functions: ["getPublicForm", "submitFormResponse"],
	},
	// apps:end
	"test-crud-public.ts": {
		why: "dev-only /dev/test-crud reads (devOnlyMiddleware); the repository only returns published rows",
		functions: ["listPublicTestCrud", "getPublicTestCrud"],
	},
	"stack.ts": {
		why: "dev-only /dev/stack data (static, devOnlyMiddleware)",
		functions: ["listStack", "getStackStats"],
	},
	"health.ts": { why: "public health check", functions: ["getDbHealth"] },
	"feature-flags.ts": { why: "public feature flags for the current visitor", functions: ["getHomeFlags"] },
	"dev.ts": { why: "dev-only /dev/forms preview (devOnlyMiddleware)", functions: ["previewRichText"] },
	"examples.ts": {
		why: "dev-only /dev/examples, devOnlyMiddleware on each",
		functions: [
			"getExampleSnapshot",
			"getSlowExample",
			"listExampleTasks",
			"getExampleTask",
			"setExampleTasksDone",
			"deleteExampleTasks",
			"resetExampleTasks",
			"submitExampleSignup",
			"failExample",
			"listExampleMessages",
			"sendExampleMessage",
			"resetExampleMessages",
			"submitExampleContact",
			"runExampleJobFn",
		],
	},
	// @new-feature:unguarded-functions
};

const DIR = "src/functions";

/**
 * Every server-function file under src/functions, as a path relative to it (e.g. "rbac.ts",
 * "apps/notes.ts"). Subfolders count too, so a file can't escape this test by living in
 * one; `_lib/` holds helpers for these files, not server functions.
 */
const functionFiles = (dir = DIR, prefix = ""): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		if (entry.isDirectory())
			return entry.name === "_lib" ? [] : functionFiles(`${dir}/${entry.name}`, `${prefix}${entry.name}/`);
		return entry.name.endsWith(".ts") ? [`${prefix}${entry.name}`] : [];
	});

/** The exported server functions of a file, in order, with their source. */
const serverFunctions = (file: string) =>
	readFileSync(`${DIR}/${file}`, "utf8")
		.split("export const ")
		.slice(1)
		.filter((definition) => definition.includes("createServerFn("))
		.map((definition) => ({ name: definition.split(" ")[0] ?? "", definition }));

describe("guarded server functions", () => {
	it("every file in src/functions is declared as guarded or deliberately unguarded", () => {
		const files = functionFiles();
		const declared = [
			...Object.keys(GUARDED_FUNCTIONS),
			...Object.keys(UNGUARDED_FILES),
			...Object.keys(APP_FUNCTIONS), // @apps
			...Object.keys(TASKLINE_FUNCTIONS), // @taskline
			...Object.keys(PARDA_PUBLIC_FUNCTIONS), // @parda
			...Object.keys(PARDA_FUNCTIONS), // @parda
			...Object.keys(CHAAL_PUBLIC_FUNCTIONS), // @chaal
			...Object.keys(CHAAL_FUNCTIONS), // @chaal
		];
		expect(files.filter((file) => !declared.includes(file))).toEqual([]);
		expect(declared.filter((file) => !files.includes(file))).toEqual([]);
	});

	// The middleware itself is tested in auth-middleware.test.ts (anonymous -> UNAUTHORIZED,
	// missing permission -> FORBIDDEN). This guards that no function skips it or checks
	// the wrong permission. The live 403 replay is recorded in docs/decisions.md 0095.
	// `withServices` may follow it (decision 0173): it builds nothing for a refused call.
	for (const [file, expected] of Object.entries(GUARDED_FUNCTIONS)) {
		it(`every function in ${file} runs requirePermission with its permission first`, () => {
			const functions = serverFunctions(file);
			expect(functions.map((fn) => fn.name)).toEqual(expected.map(([name]) => name));
			for (const [index, { definition }] of functions.entries()) {
				const permission = expected[index]?.[1];
				expect(definition).toMatch(
					new RegExp(
						`= createServerFn\\(\\{ method: "(GET|POST)" \\}\\)\\s*\\.middleware\\(\\[requirePermission\\("${permission}"\\)(, withServices)?\\]\\)`,
					),
				);
			}
		});
	}

	// apps:start
	for (const [file, expected] of Object.entries(APP_FUNCTIONS)) {
		it(`every function in ${file} runs requireAppUser and withAppServices first`, () => {
			const functions = serverFunctions(file);
			expect(functions.map((fn) => fn.name)).toEqual(expected);
			for (const { definition } of functions) {
				expect(definition).toMatch(
					/= createServerFn\(\{ method: "(GET|POST)" \}\)\s*\.middleware\(\[requireAppUser, withAppServices\]\)/,
				);
			}
		});
	}
	// apps:end

	// taskline:start
	for (const [file, expected] of Object.entries(TASKLINE_FUNCTIONS)) {
		it(`every function in ${file} runs requireTasklineUser and withTasklineServices first`, () => {
			const functions = serverFunctions(file);
			expect(functions.map((fn) => fn.name)).toEqual(expected);
			for (const { definition } of functions) {
				expect(definition).toMatch(
					/= createServerFn\(\{ method: "(GET|POST)" \}\)\s*\.middleware\(\[requireTasklineUser, withTasklineServices\]\)/,
				);
			}
		});
	}
	// taskline:end

	// parda:start
	for (const [file, expected] of Object.entries(PARDA_PUBLIC_FUNCTIONS)) {
		it(`every function in ${file} runs withPardaCatalog first`, () => {
			const functions = serverFunctions(file);
			expect(functions.map((fn) => fn.name)).toEqual(expected);
			for (const { definition } of functions) {
				// Reads are GETs; the watch page's two writes (a playback's measurements, a report) are rate-limited POSTs.
				expect(definition).toMatch(
					/= createServerFn\(\{ method: "(GET|POST)" \}\)\s*\.middleware\(\[withPardaCatalog\]\)/,
				);
			}
		});
	}

	for (const [file, expected] of Object.entries(PARDA_FUNCTIONS)) {
		it(`every function in ${file} runs requirePardaViewer and withPardaServices first`, () => {
			const functions = serverFunctions(file);
			expect(functions.map((fn) => fn.name)).toEqual(expected);
			for (const { definition } of functions) {
				expect(definition).toMatch(
					/= createServerFn\(\{ method: "(GET|POST)" \}\)\s*\.middleware\(\[requirePardaViewer, withPardaServices\]\)/,
				);
			}
		});
	}
	// parda:end

	// chaal:start
	for (const [file, expected] of Object.entries(CHAAL_PUBLIC_FUNCTIONS)) {
		it(`every function in ${file} runs withChaalPublic first`, () => {
			const functions = serverFunctions(file);
			expect(functions.map((fn) => fn.name)).toEqual(expected);
			for (const { definition } of functions) {
				expect(definition).toMatch(
					/= createServerFn\(\{ method: "(GET|POST)" \}\)\s*\.middleware\(\[withChaalPublic\]\)/,
				);
			}
		});
	}

	for (const [file, expected] of Object.entries(CHAAL_FUNCTIONS)) {
		it(`every function in ${file} runs requireChaalUser and withChaalServices first`, () => {
			const functions = serverFunctions(file);
			expect(functions.map((fn) => fn.name)).toEqual(expected);
			for (const { definition } of functions) {
				expect(definition).toMatch(
					/= createServerFn\(\{ method: "(GET|POST)" \}\)\s*\.middleware\(\[requireChaalUser, withChaalServices\]\)/,
				);
			}
		});
	}
	// chaal:end

	for (const [file, { functions }] of Object.entries(UNGUARDED_FILES)) {
		it(`${file} holds only its declared functions`, () => {
			expect(serverFunctions(file).map((fn) => fn.name)).toEqual(functions);
		});
	}
});
