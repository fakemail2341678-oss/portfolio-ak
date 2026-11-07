import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { ImportTasksInput } from "@/features/taskline/schema";
import { type FieldValue, isClosedCategory, type TaskImportResult } from "@/features/taskline/types";
import { AppError } from "@/lib/errors";
import { generateKeysBetween } from "@/lib/fractional-index";
import { lockQuota } from "@/server/db/quota";
import { tlImport } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { assertCan, resolveProject, type TasklineServices } from "../access";
import { recordActivity } from "../activity";
import { checkValues, projectFields } from "../fields/rules";
import { bumpRev, reserveTaskNumbers } from "../rev";
import { quotaError, quotaScope, quotasOf, richText } from "../rules";
import * as workflow from "../workflow/repository";
import * as members from "../workspace/repository";
import * as repo from "./repository";

/**
 * The CSV import of tasks (Task 51, Expenses' pattern, decision 0192): up to 1,000
 * rows into one project, once per idempotency key. The key is claimed in the import's
 * transaction, so a retry (a double click, a lost answer) waits for the first and
 * gets its result back; the same key with other rows, or someone else's, is a
 * CONFLICT. Statuses, assignees (active members) and labels (the project's and the
 * workspace's) are matched by name without case; a name that matches nothing is left
 * blank (the project's first open status, nobody, no label) and reported. Each task
 * gets its `task.created` entry, the project's `rev` moves once, and nobody is
 * notified: an import isn't a hundred assignments.
 */

/** Imports per member per hour (recipes.md, "Rate limiting server functions"). */
const IMPORTS_PER_HOUR = 10;

const escapeHtml = (text: string) =>
	text.replace(
		/[&<>"']/g,
		(char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
	);

/** Plain text → a paragraph per line, through the same sanitizer as the editor's descriptions. */
export const plainDescription = (text: string) =>
	richText(
		text
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => `<p>${escapeHtml(line)}</p>`)
			.join(""),
	);

const getImport = async (db: Db | Tx, key: string) => {
	const [row] = await db.select().from(tlImport).where(eq(tlImport.key, key));
	return row ?? null;
};

const reused = () => new AppError("CONFLICT", "Idempotency key reused for a different import");

export async function importTasks(
	{ db, user }: TasklineServices,
	input: ImportTasksInput,
): Promise<TaskImportResult & { replayed: boolean }> {
	const fingerprint = createHash("sha256").update(JSON.stringify(input.rows)).digest("hex");
	const first = await resolveProject(db, user, input.ws, input.key);
	assertCan(first, "edit");
	// A retry of an import that went through gets its result back before the rate limit counts it.
	const done = await getImport(db, input.idempotencyKey);
	if (
		done?.result &&
		done.userId === user.id &&
		done.fingerprint === fingerprint &&
		done.projectId === first.project.id
	)
		return { ...done.result, replayed: true };
	await enforceRateLimit(db, `taskline-import:${user.id}`, { max: IMPORTS_PER_HOUR, windowSeconds: 3600 });
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, input.ws, input.key);
		assertCan(access, "edit");
		await lockQuota(tx, quotaScope(access.workspace.id));
		const claimed = await tx
			.insert(tlImport)
			.values({ key: input.idempotencyKey, projectId: access.project.id, userId: user.id, fingerprint })
			.onConflictDoNothing()
			.returning({ key: tlImport.key });
		if (claimed.length === 0) {
			const earlier = await getImport(tx, input.idempotencyKey);
			if (
				earlier?.userId !== user.id ||
				earlier.fingerprint !== fingerprint ||
				earlier.projectId !== access.project.id ||
				!earlier.result
			)
				throw reused();
			return { ...earlier.result, replayed: true };
		}
		const max = quotasOf(access).tasks;
		if ((await repo.countTasks(tx, access.workspace.id)) + input.rows.length > max) throw quotaError("tasks", max);

		// One after another: a transaction is one connection, which runs one query at a time.
		const statuses = await workflow.listStatuses(tx, access.project.id);
		const labels = await workflow.listLabels(tx, access.workspace.id, access.project.id);
		const people = await members.listMembers(tx, access.workspace.id);
		// Task 55: values come typed from the dialog; checked here against the fields, members among the active ones.
		const fields = input.rows.some((row) => row.fields) ? await projectFields(tx, access) : [];
		const activeIds = new Set(people.map((person) => person.id));
		const fallback = statuses.find((status) => status.category === "unstarted") ?? statuses[0];
		if (!fallback) throw new AppError("CONFLICT", "Project has no statuses");
		const byName = <T>(rows: ReadonlyArray<T>, name: (row: T) => string) => {
			const map = new Map<string, T>();
			// The first of two with one name wins (labels: the project's before the workspace's).
			for (const row of rows) if (!map.has(name(row).toLowerCase())) map.set(name(row).toLowerCase(), row);
			return map;
		};
		const statusByName = byName(statuses, (row) => row.name);
		const memberByName = byName(people, (row) => row.displayName);
		const labelByName = byName(
			[...labels].sort((a, b) => Number(a.projectId === null) - Number(b.projectId === null)),
			(row) => row.name,
		);
		const unmatched = { statuses: new Set<string>(), assignees: new Set<string>(), labels: new Set<string>() };
		const offered = access.settings.taskTypes;
		const defaultType = offered.includes("task") ? "task" : (offered[0] ?? "task");

		const values: Array<Record<string, FieldValue>> = [];
		for (const row of input.rows) {
			values.push(row.fields ? (await checkValues(tx, access, fields, row.fields, activeIds)).set : {});
		}
		const planned = input.rows.map((row) => {
			const status = row.status ? statusByName.get(row.status.toLowerCase()) : undefined;
			if (row.status && !status) unmatched.statuses.add(row.status);
			const assignee = row.assignee ? memberByName.get(row.assignee.toLowerCase()) : undefined;
			if (row.assignee && !assignee) unmatched.assignees.add(row.assignee);
			const labelIds = new Set<string>();
			for (const name of row.labels) {
				const label = labelByName.get(name.toLowerCase());
				if (label) labelIds.add(label.id);
				else unmatched.labels.add(name);
			}
			return { row, status: status ?? fallback, assigneeId: assignee?.id ?? null, labelIds: [...labelIds] };
		});

		// Each status's new tasks go after its last one, in the file's order.
		const keys = new Map<string, string[]>();
		for (const status of statuses) {
			const count = planned.filter((each) => each.status.id === status.id).length;
			if (count > 0) keys.set(status.id, generateKeysBetween(await repo.lastInStatus(tx, status.id), null, count));
		}
		const firstNumber = await reserveTaskNumbers(tx, access.project.id, planned.length);
		const reporterId = access.member?.id ?? null;
		const now = new Date();
		// Task 52: the imported tasks go to the end of the backlog, in the file's order.
		const ranks = await repo.endRanks(tx, access.project.id, planned.length);
		const tasks = planned.map(({ row, status, assigneeId }, index) => {
			const text = plainDescription(row.description);
			return {
				id: crypto.randomUUID(),
				workspaceId: access.workspace.id,
				projectId: access.project.id,
				number: firstNumber + index,
				title: row.title,
				descriptionHtml: text.html,
				descriptionText: text.text,
				type: row.type && offered.includes(row.type) ? row.type : defaultType,
				statusId: status.id,
				position: keys.get(status.id)?.shift() ?? "a0",
				rank: ranks[index] ?? "a0",
				priority: row.priority,
				assigneeId,
				reporterId,
				startOn: row.startOn,
				dueOn: row.dueOn,
				completedAt: isClosedCategory(status.category) ? now : null,
				fields: values[index] ?? {},
			};
		});
		await repo.insertTasks(tx, tasks);
		await repo.linkTasks(
			tx,
			tasks.flatMap((task, index) => (planned[index]?.labelIds ?? []).map((labelId) => ({ taskId: task.id, labelId }))),
			tasks.flatMap((task) =>
				[...new Set([task.reporterId, task.assigneeId])].flatMap((memberId) =>
					memberId ? [{ taskId: task.id, memberId }] : [],
				),
			),
		);
		await recordActivity(
			tx,
			access,
			...tasks.map((task) => ({
				kind: "task.created" as const,
				taskId: task.id,
				data: { title: task.title, imported: true },
			})),
		);
		await bumpRev(tx, access.project.id);
		const result: TaskImportResult = {
			inserted: tasks.length,
			unmatched: {
				statuses: [...unmatched.statuses].slice(0, 20),
				assignees: [...unmatched.assignees].slice(0, 20),
				labels: [...unmatched.labels].slice(0, 20),
			},
		};
		await tx.update(tlImport).set({ result }).where(eq(tlImport.key, input.idempotencyKey));
		return { ...result, replayed: false };
	});
}
