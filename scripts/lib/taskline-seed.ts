/**
 * Taskline's demo team (`pnpm db:seed-taskline`, and `pnpm dev:local` on a fresh
 * database): five accounts on the team (one a viewer), every admin as a member, three
 * projects (one private) and sixty tasks, so the app has something to show. Plain SQL
 * through an injected query (as ./demo-data.ts), so it runs on node-postgres and is
 * tested on PGlite (tests/server/taskline-seed.test.ts). Safe to run again: accounts
 * and members are kept, and projects are only written while the team has none.
 *
 * Run by Node directly (type stripping): it imports only relative `.ts` files without imports.
 */
import { randomUUID } from "node:crypto";
import { generateKeysBetween } from "../../src/lib/fractional-index.ts";
import type { DemoQuery } from "./demo-data.ts";

export const TASKLINE_TEAM: ReadonlyArray<{ email: string; name: string; title: string; role: "member" | "viewer" }> = [
	{ email: "asha@taskline.example.com", name: "Asha Gurung", title: "Designer", role: "member" },
	{ email: "bikash@taskline.example.com", name: "Bikash Thapa", title: "Engineer", role: "member" },
	{ email: "sita@taskline.example.com", name: "Sita Rai", title: "Product manager", role: "member" },
	{ email: "nabin@taskline.example.com", name: "Nabin Shrestha", title: "Engineer", role: "member" },
	{ email: "priya@taskline.example.com", name: "Priya Tamang", title: "Stakeholder", role: "viewer" },
];

const STATUSES = [
	["Backlog", "backlog", "gray"],
	["To do", "unstarted", "blue"],
	["In progress", "started", "amber"],
	["Done", "completed", "green"],
	["Canceled", "canceled", "red"],
] as const;

const PROJECTS = [
	{
		key: "WEB",
		name: "Website relaunch",
		color: "teal",
		visibility: "team",
		lead: 2,
		members: [0, 1, 3, 4],
		labels: [
			["Design", "violet"],
			["Content", "teal"],
			["Bug", "red"],
		],
		tasks: [
			"Write the homepage copy",
			"Design the new navigation",
			"Fix the broken contact form",
			"Pick a launch date",
			"Set up analytics",
			"Move the old blog posts",
			"Replace the logo files",
			"Check the contrast in dark mode",
			"Add the pricing page",
			"Redirect the old URLs",
			"Compress the hero images",
			"Write the launch announcement",
			"Test the forms on phones",
			"Add the cookie notice",
			"Review the footer links",
			"Translate the homepage into Nepali",
			"Set up the status page",
			"Plan the launch-day checklist",
			"Archive the old site",
			"Thank the beta testers",
		],
	},
	{
		key: "APP",
		name: "Mobile app",
		color: "indigo",
		visibility: "team",
		lead: 1,
		members: [0, 3],
		labels: [
			["iOS", "gray"],
			["Android", "green"],
			["Bug", "red"],
		],
		tasks: [
			"Sign in with a one-time code",
			"Offline mode for the task list",
			"Push notifications for assignments",
			"Crash on rotating the board",
			"Dark mode icons",
			"Upload a photo to a task",
			"Swipe to complete a task",
			"Release notes for 1.2",
			"Settle the app store screenshots",
			"Speed up the first launch",
			"Haptics when a card moves",
			"Accessibility labels on buttons",
			"Search tasks by reference",
			"Fix the date picker in Nepali",
			"Battery use while syncing",
			"Show who is assigned",
			"Pull to refresh",
			"Empty states for new users",
			"Beta group feedback round",
			"Remove the old login screen",
		],
	},
	{
		key: "OPS",
		name: "Operations",
		color: "amber",
		visibility: "private",
		lead: 3,
		members: [1],
		labels: [
			["Infra", "blue"],
			["Security", "red"],
		],
		tasks: [
			"Rotate the database password",
			"Turn on backups for the media",
			"Upgrade Node on the servers",
			"Review who can deploy",
			"Set up uptime alerts",
			"Document the restore steps",
			"Renew the certificates",
			"Clean up unused buckets",
			"Load test the API",
			"Patch the base images",
			"Move secrets to the vault",
			"Audit the admin accounts",
			"Plan the on-call rota",
			"Check the cron jobs",
			"Trim the log retention",
			"Budget for next quarter",
			"Write the incident template",
			"Test a failover",
			"Tag the cloud resources",
			"Remove old API keys",
		],
	},
] as const;

/**
 * Task 54: WEB's milestones (a beta next week, the launch in three weeks) with the first
 * and second ten tasks, and a few dependencies between them (the navigation blocks the
 * contrast check, the copy the launch date, the contact form the phone tests, the
 * redirects the old site's archive).
 */
async function seedTimeline(query: DemoQuery, projectId: string, tasks: ReadonlyArray<SeededTask>) {
	const positions = generateKeysBetween(null, null, 2);
	const milestones: string[] = [];
	for (const [index, [name, due]] of [
		["Beta", 7],
		["Launch", 21],
	].entries()) {
		const milestone = await query(
			`insert into "tl_milestone" ("project_id", "name", "due_on", "position") values ($1, $2, $3, $4) returning "id"`,
			[projectId, name, day(Number(due)), positions[index]],
		);
		milestones.push(firstId(milestone.rows, `milestone ${name}`));
	}
	for (const [index, task] of tasks.entries()) {
		await query(`update "tl_task" set "milestone_id" = $2 where "id" = $1`, [task.id, milestones[index < 10 ? 0 : 1]]);
	}
	for (const [blocker, blocked] of [
		[1, 7],
		[0, 3],
		[2, 12],
		[9, 18],
	]) {
		await query(`insert into "tl_task_dependency" ("blocker_id", "blocked_id") values ($1, $2)`, [
			tasks[blocker ?? 0]?.id,
			tasks[blocked ?? 0]?.id,
		]);
	}
}

/** Task 55: the team's Severity choices. */
const SEVERITY = [
	{ id: "olow001", name: "Low", color: "gray" },
	{ id: "omed001", name: "Medium", color: "amber" },
	{ id: "ohigh01", name: "High", color: "red" },
] as const;

/** Task 55: WEB's own fields, a reviewer and a sign-off, with values on the first tasks and the done ones. */
async function seedFields(
	query: DemoQuery,
	{
		workspaceId,
		projectId,
		reviewers,
		tasks,
	}: {
		workspaceId: string;
		projectId: string;
		reviewers: ReadonlyArray<string | null>;
		tasks: ReadonlyArray<SeededTask>;
	},
) {
	const reviewer = await query(
		`insert into "tl_field" ("workspace_id", "project_id", "name", "type", "position") values ($1, $2, 'Reviewer', 'member', 'a0') returning "id"`,
		[workspaceId, projectId],
	);
	const signed = await query(
		`insert into "tl_field" ("workspace_id", "project_id", "name", "type", "required", "position") values ($1, $2, 'Signed off', 'checkbox', false, 'a1') returning "id"`,
		[workspaceId, projectId],
	);
	const reviewerId = firstId(reviewer.rows, "field Reviewer");
	const signedId = firstId(signed.rows, "field Signed off");
	for (const [index, task] of tasks.entries()) {
		const person = reviewers[index % reviewers.length];
		const values = {
			...(index < 8 && person ? { [reviewerId]: person } : {}),
			...(task.done ? { [signedId]: true } : {}),
		};
		if (Object.keys(values).length === 0) continue;
		await query(`update "tl_task" set "fields" = "fields" || $2::jsonb where "id" = $1`, [
			task.id,
			JSON.stringify(values),
		]);
	}
}

/**
 * Task 56: WEB's own rule (a parent closes when its subtasks are done) with two runs in
 * its log, one that changed things and one that failed.
 */
async function seedAutomations(
	query: DemoQuery,
	workspaceId: string,
	projectId: string,
	tasks: ReadonlyArray<SeededTask>,
) {
	const rule = await query(
		`insert into "tl_automation" ("workspace_id", "project_id", "name", "trigger", "conditions", "actions") values ($1, $2, 'Close a parent when its subtasks are done', $3, '[]', $4) returning "id"`,
		[
			workspaceId,
			projectId,
			JSON.stringify({ type: "subtasks_done" }),
			JSON.stringify([{ type: "set_status", category: "completed" }]),
		],
	);
	const ruleId = firstId(rule.rows, "automation");
	const done = tasks.find((task) => task.done);
	const open = tasks.find((task) => !task.done && !task.canceled);
	if (done) {
		await query(
			`insert into "tl_automation_run" ("automation_id", "task_id", "outcome", "detail", "at") values ($1, $2, 'ok', '{"applied":1}', now() - interval '2 days')`,
			[ruleId, done.id],
		);
	}
	if (open) {
		await query(
			`insert into "tl_automation_run" ("automation_id", "task_id", "outcome", "detail", "at") values ($1, $2, 'failed', $3, now() - interval '1 day')`,
			[ruleId, open.id, JSON.stringify({ message: "WEB-2 needs Signed off before it's completed." })],
		);
	}
}

/** A calendar day `offset` days from today (UTC; demo data needs no time zone). */
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

type SeededTask = { id: string; done: boolean; canceled: boolean };

/**
 * Task 52: APP plans in sprints. Its tasks get points; the first eight were a completed
 * sprint (the open ones among them carried into the active one), the next eight are the
 * active sprint, two more the planned one, the rest the backlog. The days of the
 * completed and the active sprint burn down evenly to what's done.
 */
/** Task 57's demo template: what `templateDefinition` reads (tests/server/taskline-seed.test.ts checks it). */
const WEBSITE_STATUS = {
	todo: "00000000-0000-4000-8000-000000000001",
	doing: "00000000-0000-4000-8000-000000000002",
	review: "00000000-0000-4000-8000-000000000003",
	done: "00000000-0000-4000-8000-000000000004",
	canceled: "00000000-0000-4000-8000-000000000005",
};
const WEBSITE_LAUNCH = "00000000-0000-4000-8000-000000000006";
const WEBSITE_TEMPLATE = {
	statuses: [
		{ id: WEBSITE_STATUS.todo, name: "To do", category: "unstarted", color: "blue" },
		{ id: WEBSITE_STATUS.doing, name: "In progress", category: "started", color: "amber", wipLimit: 4 },
		{ id: WEBSITE_STATUS.review, name: "In review", category: "started", color: "violet" },
		{ id: WEBSITE_STATUS.done, name: "Done", category: "completed", color: "green" },
		{ id: WEBSITE_STATUS.canceled, name: "Canceled", category: "canceled", color: "red" },
	],
	fields: [{ id: "00000000-0000-4000-8000-000000000007", name: "Page URL", type: "url" }],
	automations: [
		{
			name: "Tell the lead when something is ready for review",
			enabled: true,
			trigger: { type: "status_changed", statusId: WEBSITE_STATUS.review },
			conditions: [],
			actions: [{ type: "notify", to: "lead", message: "Ready for review" }],
		},
	],
	settings: { sprints: false, time: true },
	milestones: [{ id: WEBSITE_LAUNCH, name: "Launch", dueOffset: 42 }],
	tasks: [
		{ title: "Agree on the sitemap", status: WEBSITE_STATUS.todo, dueOffset: 5, priority: 3 },
		{ title: "Design the home page", status: WEBSITE_STATUS.todo, dueOffset: 14 },
		{ title: "Launch the site", status: WEBSITE_STATUS.todo, dueOffset: 42, milestone: WEBSITE_LAUNCH },
	],
};

/** Task 57: two updates on WEB by its lead; the last one sets its health. */
async function seedUpdates(query: DemoQuery, projectId: string, leadId: string | null) {
	await query(
		`insert into "tl_project_update" ("project_id", "author_id", "health", "body_html", "body_text", "created_at") values ($1, $2, 'on_track', '<p>The beta is out and the first feedback is good.</p>', 'The beta is out and the first feedback is good.', now() - interval '9 days'), ($1, $2, 'at_risk', '<p>Two bugs are holding the launch back. A week should clear them.</p>', 'Two bugs are holding the launch back. A week should clear them.', now() - interval '2 days')`,
		[projectId, leadId],
	);
	await query(`update "tl_project" set "health" = 'at_risk' where "id" = $1`, [projectId]);
}

async function seedSprints(query: DemoQuery, projectId: string, tasks: ReadonlyArray<SeededTask>) {
	const POINTS = [1, 2, 3, 5, 8];
	await query(`update "tl_project" set "settings" = $2 where "id" = $1`, [
		projectId,
		JSON.stringify({ sprints: true }),
	]);
	for (const [index, task] of tasks.entries()) {
		await query(`update "tl_task" set "points" = $2 where "id" = $1`, [task.id, POINTS[index % POINTS.length]]);
	}
	const points = (index: number) => POINTS[index % POINTS.length] ?? 0;
	const plans = [
		{ name: "Sprint 1", state: "completed", start: -22, end: -9, from: 0, to: 8 },
		{ name: "Sprint 2", state: "active", start: -6, end: 7, from: 8, to: 16 },
		{ name: "Sprint 3", state: "planned", start: 8, end: 21, from: 16, to: 18 },
	] as const;
	for (const plan of plans) {
		const members = tasks.map((task, index) => ({ ...task, index })).slice(plan.from, plan.to);
		// The completed sprint keeps its done tasks; its open ones moved on to the active sprint.
		const kept = plan.state === "completed" ? members.filter((task) => task.done) : members;
		const scope = members.filter((task) => !task.canceled);
		const scopePoints = scope.reduce((sum, task) => sum + points(task.index), 0);
		const done = scope.filter((task) => task.done);
		const donePoints = done.reduce((sum, task) => sum + points(task.index), 0);
		const started = plan.state !== "planned";
		const sprint = await query(
			`insert into "tl_sprint" ("project_id", "name", "goal", "state", "start_on", "end_on", "started_at", "completed_at", "committed_points", "committed_tasks", "completed_points", "completed_tasks")
			 values ($1, $2, '', $3, $4, $5, $6, $7, $8, $9, $10, $11) returning "id"`,
			[
				projectId,
				plan.name,
				plan.state,
				day(plan.start),
				day(plan.end),
				started ? new Date(Date.now() + plan.start * 86_400_000).toISOString() : null,
				plan.state === "completed" ? new Date(Date.now() + plan.end * 86_400_000).toISOString() : null,
				started ? scopePoints : null,
				started ? scope.length : null,
				plan.state === "completed" ? donePoints : null,
				plan.state === "completed" ? done.length : null,
			],
		);
		const sprintId = firstId(sprint.rows, `sprint ${plan.name}`);
		for (const task of kept) await query(`update "tl_task" set "sprint_id" = $2 where "id" = $1`, [task.id, sprintId]);
		if (!started) continue;
		const last = Math.min(plan.end, -1);
		const length = Math.max(1, last - plan.start + 1);
		for (let offset = plan.start - 1; offset <= last; offset++) {
			const share = Math.max(0, offset - plan.start + 1) / length;
			await query(
				`insert into "tl_sprint_snapshot" ("sprint_id", "day", "scope_points", "done_points", "scope_tasks", "done_tasks") values ($1, $2, $3, $4, $5, $6)`,
				[
					sprintId,
					day(offset),
					scopePoints,
					Math.round(donePoints * share),
					scope.length,
					Math.round(done.length * share),
				],
			);
		}
	}
}

const firstId = (rows: Array<Record<string, unknown>>, what: string): string => {
	const id = rows[0]?.id;
	if (typeof id !== "string") throw new Error(`taskline seed: no ${what}`);
	return id;
};

export async function seedTaskline(
	query: DemoQuery,
	{ passwordHash }: { passwordHash: string },
): Promise<{ accounts: number; projects: number; tasks: number }> {
	const team = await query(`select "id" from "tl_workspace" where "kind" = 'team'`);
	const workspaceId = firstId(team.rows, "team workspace (run the migrations first)");

	let accounts = 0;
	const userIds: string[] = [];
	for (const person of TASKLINE_TEAM) {
		const existing = await query(`select "id" from "user" where "email" = $1`, [person.email]);
		let id = existing.rows[0]?.id as string | undefined;
		if (!id) {
			id = randomUUID();
			await query(
				`insert into "user" ("id", "name", "email", "email_verified", "role") values ($1, $2, $3, true, 'user')`,
				[id, person.name, person.email],
			);
			await query(
				`insert into "account" ("id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
				 values ($1, $2, 'credential', $2, $3, now(), now())`,
				[randomUUID(), id, passwordHash],
			);
			accounts += 1;
		}
		userIds.push(id);
	}

	const memberIds: string[] = [];
	for (const [index, person] of TASKLINE_TEAM.entries()) {
		const { rows } = await query(
			`insert into "tl_member" ("workspace_id", "user_id", "display_name", "role", "title") values ($1, $2, $3, $4, $5)
			 on conflict ("workspace_id", "user_id") do update set "display_name" = excluded."display_name" returning "id"`,
			[workspaceId, userIds[index], person.name, person.role, person.title],
		);
		memberIds.push(firstId(rows, `member ${person.email}`));
	}
	// Admins are on the team too, so their home page has work on it.
	const { rows: admins } = await query(
		`insert into "tl_member" ("workspace_id", "user_id", "display_name")
		 select $1, "id", "name" from "user" where "role" = 'admin' and not coalesce("is_anonymous", false)
		 on conflict ("workspace_id", "user_id") do nothing returning "id"`,
		[workspaceId],
	);

	const existingProjects = await query(`select count(*)::int as "total" from "tl_project" where "workspace_id" = $1`, [
		workspaceId,
	]);
	if (Number(existingProjects.rows[0]?.total ?? 0) > 0) return { accounts, projects: 0, tasks: 0 };

	// Task 55: a workspace field every project's tasks have (its option ids are fixed: demo data).
	const severity = await query(
		`insert into "tl_field" ("workspace_id", "name", "type", "options", "position") values ($1, 'Severity', 'select', $2, 'a0') returning "id"`,
		[workspaceId, JSON.stringify(SEVERITY)],
	);
	const severityId = firstId(severity.rows, "field Severity");
	// Task 57: a saved template (its local ids are its own; a project made from it gets new ones).
	await query(
		`insert into "tl_template" ("workspace_id", "name", "description", "definition") values ($1, $2, $3, $4)`,
		[workspaceId, "Website launch", "Design, build and launch a site in six weeks.", JSON.stringify(WEBSITE_TEMPLATE)],
	);
	// Task 56: a workspace rule: an urgent bug tells the project's lead.
	await query(
		`insert into "tl_automation" ("workspace_id", "name", "trigger", "conditions", "actions") values ($1, 'Urgent bugs tell the lead', $2, $3, $4)`,
		[
			workspaceId,
			JSON.stringify({ type: "task_created" }),
			JSON.stringify([
				{ type: "task_type", in: ["bug"] },
				{ type: "priority", in: [4] },
			]),
			JSON.stringify([{ type: "notify", to: "lead", message: "An urgent bug came in." }]),
		],
	);

	let taskCount = 0;
	for (const project of PROJECTS) {
		const leadId = memberIds[project.lead] ?? null;
		const { rows } = await query(
			`insert into "tl_project" ("workspace_id", "key", "name", "color", "visibility", "lead_id", "description_html", "description_text", "start_on", "target_on")
			 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning "id"`,
			[
				workspaceId,
				project.key,
				project.name,
				project.color,
				project.visibility,
				leadId,
				`<p>${project.name}: demo data from pnpm db:seed-taskline.</p>`,
				`${project.name}: demo data from pnpm db:seed-taskline.`,
				day(-30),
				day(45),
			],
		);
		const projectId = firstId(rows, `project ${project.key}`);
		const people = [
			[leadId, "lead"],
			...project.members.map((index) => [memberIds[index] ?? null, "member"] as const),
			...admins.map((row) => [row.id as string, "member"] as const),
		] as const;
		for (const [memberId, role] of people) {
			await query(
				`insert into "tl_project_member" ("project_id", "member_id", "role") values ($1, $2, $3) on conflict do nothing`,
				[projectId, memberId, role],
			);
		}
		const statusPositions = generateKeysBetween(null, null, STATUSES.length);
		const statusIds: string[] = [];
		for (const [index, [name, category, color]] of STATUSES.entries()) {
			const status = await query(
				`insert into "tl_status" ("project_id", "name", "category", "color", "position") values ($1, $2, $3, $4, $5) returning "id"`,
				[projectId, name, category, color, statusPositions[index]],
			);
			statusIds.push(firstId(status.rows, `status ${name}`));
		}
		const labelIds: string[] = [];
		for (const [name, color] of project.labels) {
			const label = await query(
				`insert into "tl_label" ("workspace_id", "project_id", "name", "color") values ($1, $2, $3, $4) returning "id"`,
				[workspaceId, projectId, name, color],
			);
			labelIds.push(firstId(label.rows, `label ${name}`));
		}
		const assignees = people.map(([memberId]) => memberId);
		// Spread over the statuses: a few in the backlog, most to do or in progress, a quarter done.
		const statusOf = (index: number) => [1, 2, 1, 0, 3, 2, 3, 1, 0, 2, 1, 3, 4, 1, 2, 3, 0, 1, 2, 3][index % 20] ?? 1;
		const positions = STATUSES.map((_, status) =>
			generateKeysBetween(null, null, project.tasks.filter((__, index) => statusOf(index) === status).length),
		);
		// The backlog's order (Task 52): the tasks' own order.
		const ranks = generateKeysBetween(null, null, project.tasks.length);
		const made: SeededTask[] = [];
		for (const [index, title] of project.tasks.entries()) {
			const status = statusOf(index);
			const closed = status >= 3;
			const number = index + 1;
			const task = await query(
				`insert into "tl_task" ("workspace_id", "project_id", "number", "type", "title", "status_id", "priority", "assignee_id", "reporter_id", "position", "due_on", "completed_at", "rank", "estimate_minutes", "start_on")
				 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) returning "id"`,
				[
					workspaceId,
					projectId,
					number,
					index % 7 === 2 ? "bug" : index % 9 === 1 ? "story" : "task",
					title,
					statusIds[status],
					index % 5,
					index % 6 === 5 ? null : (assignees[index % assignees.length] ?? null),
					leadId,
					positions[status]?.shift() ?? "a0",
					index % 3 === 0 ? null : day((index % 11) - 3),
					closed ? new Date(Date.now() - (20 - index) * 86_400_000).toISOString() : null,
					ranks[index] ?? "a0",
					// Task 53: most tasks are estimated, in whole hours.
					index % 4 === 3 ? null : ((index % 5) + 1) * 60,
					// Task 54: a dated task starts one to four days before it's due.
					index % 3 === 0 ? null : day((index % 11) - 4 - (index % 4)),
				],
			);
			const taskId = firstId(task.rows, `task ${project.key}-${number}`);
			// Task 53: the assignee logged time on started and done tasks over the last days.
			const assignee = index % 6 === 5 ? null : (assignees[index % assignees.length] ?? null);
			if (assignee && status >= 2 && status <= 3 && index < 14) {
				for (const back of [1, 2 + (index % 3)]) {
					await query(
						`insert into "tl_time_entry" ("workspace_id", "project_id", "task_id", "member_id", "on_day", "minutes", "billable") values ($1, $2, $3, $4, $5, $6, $7)`,
						[workspaceId, projectId, taskId, assignee, day(-back), 30 * ((index % 6) + 2), project.key === "WEB"],
					);
				}
			}
			made.push({ id: taskId, done: status === 3, canceled: status === 4 });
			// Task 55: most tasks have a severity.
			const level = SEVERITY[index % 4];
			if (level) {
				await query(`update "tl_task" set "fields" = $2 where "id" = $1`, [
					taskId,
					JSON.stringify({ [severityId]: level.id }),
				]);
			}
			const labelId = labelIds[index % (labelIds.length + 1)];
			if (labelId) {
				await query(`insert into "tl_task_label" ("task_id", "label_id") values ($1, $2)`, [taskId, labelId]);
			}
			await query(
				`insert into "tl_activity" ("workspace_id", "project_id", "task_id", "actor_id", "kind", "data") values ($1, $2, $3, $4, 'task.created', $5)`,
				[workspaceId, projectId, taskId, leadId, JSON.stringify({ title })],
			);
			taskCount += 1;
		}
		await query(`update "tl_project" set "task_seq" = $2 where "id" = $1`, [projectId, project.tasks.length]);
		if (project.key === "APP") await seedSprints(query, projectId, made);
		if (project.key === "WEB") {
			await seedTimeline(query, projectId, made);
			await seedFields(query, { workspaceId, projectId, reviewers: assignees, tasks: made });
			await seedAutomations(query, workspaceId, projectId, made);
			await seedUpdates(query, projectId, leadId);
		}
		// Task 56: OPS's first open task repeats every week on Monday.
		const repeating = made.find((task) => !task.done && !task.canceled);
		if (project.key === "OPS" && repeating) {
			const anchor = day(1);
			await query(`update "tl_task" set "recurrence" = $2, "due_on" = $3 where "id" = $1`, [
				repeating.id,
				JSON.stringify({ freq: "weekly", interval: 1, weekdays: [1], anchor, n: 1 }),
				anchor,
			]);
		}
		await query(
			`insert into "tl_activity" ("workspace_id", "project_id", "actor_id", "kind", "data") values ($1, $2, $3, 'project.created', $4)`,
			[workspaceId, projectId, leadId, JSON.stringify({ key: project.key, name: project.name })],
		);
	}
	return { accounts, projects: PROJECTS.length, tasks: taskCount };
}
