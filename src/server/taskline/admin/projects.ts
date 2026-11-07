import "@tanstack/react-start/server-only";
import { and, asc, count, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type {
	AdminCreateProjectInput,
	AdminProjectDetail,
	AdminProjectItem,
	AdminProjectMember,
	AdminProjectPage,
	AdminUpdateProjectInput,
	ProjectExport,
} from "@/features/taskline/admin/schema";
import type { AdminProjectListInput } from "@/features/taskline/admin/search";
import { fieldValueText } from "@/features/taskline/fields";
import type { ProjectHealth, ProjectRole, ProjectStatus, TaskFieldValues } from "@/features/taskline/types";
import { toCsv } from "@/lib/csv";
import { todayInZone } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import { changes } from "@/server/audit/record";
import { listPage, notFound, withAudit } from "@/server/db/crud";
import { allOf, textSearch } from "@/server/db/list";
import { lockQuota } from "@/server/db/quota";
import {
	type TlProjectRow,
	tlLabel,
	tlMember,
	tlProject,
	tlProjectMember,
	tlProjectUpdate,
	tlRetiredKey,
	tlTask,
	tlTaskLabel,
	user,
} from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { Services } from "@/server/services";
import { projectAccess, resolveWorkspace } from "../access";
import { recordActivity } from "../activity";
import * as automationRepo from "../automations/repository";
import { removeTaskFiles } from "../collab/repository";
import * as fieldRepo from "../fields/repository";
import * as projectRepo from "../projects/repository";
import * as projects from "../projects/service";
import { bumpRev } from "../rev";
import { fieldError, quotaError, quotaScope, quotasOf } from "../rules";
import { chooseTemplate } from "../templates/service";
import * as timeline from "../timeline/repository";
import * as workflowRepo from "../workflow/repository";
import * as members from "../workspace/repository";
import { appServices, projectTarget, team, teamProject } from "./team";

/**
 * /admin/taskline/projects (PLAN 11.5): every team project, whoever can see it. Writes
 * go through the app's project services as a lead-equivalent admin (`taskline:manage`,
 * 0204), so the rules, the activity and `rev` are the app's own; each is also audited
 * (withAudit, the admin's log) in the same transaction.
 */

const isId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function items(db: Db, ws: string, rows: TlProjectRow[]): Promise<AdminProjectItem[]> {
	const ids = rows.map((row) => row.id);
	const leadIds = rows.flatMap((row) => (row.leadId ? [row.leadId] : []));
	const [open, memberCounts, leads] = await Promise.all([
		projectRepo.openTaskCounts(db, ids),
		ids.length === 0
			? Promise.resolve([])
			: db
					.select({ projectId: tlProjectMember.projectId, total: count() })
					.from(tlProjectMember)
					.innerJoin(tlMember, eq(tlMember.id, tlProjectMember.memberId))
					.where(and(inArray(tlProjectMember.projectId, ids), isNull(tlMember.deactivatedAt)))
					.groupBy(tlProjectMember.projectId),
		leadIds.length === 0
			? Promise.resolve([])
			: db.select({ id: tlMember.id, name: tlMember.displayName }).from(tlMember).where(inArray(tlMember.id, leadIds)),
	]);
	const memberTotals = new Map(memberCounts.map((row) => [row.projectId, row.total]));
	const leadNames = new Map(leads.map((row) => [row.id, row.name]));
	return rows.map((row) => ({
		id: row.id,
		key: row.key,
		name: row.name,
		color: row.color,
		visibility: row.visibility,
		status: row.status,
		health: row.health,
		lead: row.leadId ? { id: row.leadId, name: leadNames.get(row.leadId) ?? "" } : null,
		members: memberTotals.get(row.id) ?? 0,
		open: open.get(row.id) ?? 0,
		archived: row.archivedAt !== null,
		updatedAt: row.updatedAt.toISOString(),
		ws,
	}));
}

export async function list({ db }: Pick<Services, "db">, input: AdminProjectListInput): Promise<AdminProjectPage> {
	const { workspace } = await team(db);
	const status =
		input.status === "all"
			? undefined
			: input.status === "archived"
				? isNotNull(tlProject.archivedAt)
				: and(eq(tlProject.status, input.status), isNull(tlProject.archivedAt));
	const lead =
		input.lead === "none" ? isNull(tlProject.leadId) : isId(input.lead) ? eq(tlProject.leadId, input.lead) : undefined;
	return listPage(db, tlProject, {
		input,
		where: allOf(
			eq(tlProject.workspaceId, workspace.id),
			status,
			input.visibility === "all" ? undefined : eq(tlProject.visibility, input.visibility),
			lead,
			textSearch(input.q, [tlProject.name, tlProject.key]),
		),
		sort: {
			columns: { name: sql`lower(${tlProject.name})`, key: tlProject.key, updated: tlProject.updatedAt },
			fallback: "name",
		},
		map: (rows) => items(db, workspace.slug, rows),
	});
}

async function detail(db: Db, ws: string, row: TlProjectRow): Promise<AdminProjectDetail> {
	const [[item], memberRows, statuses, statusCounts, labels, labelCounts, [totals]] = await Promise.all([
		items(db, ws, [row]),
		db
			.select({
				memberId: tlProjectMember.memberId,
				role: tlProjectMember.role,
				name: tlMember.displayName,
				email: user.email,
			})
			.from(tlProjectMember)
			.innerJoin(tlMember, eq(tlMember.id, tlProjectMember.memberId))
			.leftJoin(user, eq(user.id, tlMember.userId))
			.where(and(eq(tlProjectMember.projectId, row.id), isNull(tlMember.deactivatedAt)))
			.orderBy(asc(tlMember.displayName), asc(tlMember.id)),
		workflowRepo.listStatuses(db, row.id),
		db
			.select({ statusId: tlTask.statusId, total: count() })
			.from(tlTask)
			.where(and(eq(tlTask.projectId, row.id), isNull(tlTask.deletedAt)))
			.groupBy(tlTask.statusId),
		db
			.select()
			.from(tlLabel)
			.where(eq(tlLabel.projectId, row.id))
			.orderBy(asc(sql`lower(${tlLabel.name})`)),
		db
			.select({ labelId: tlTaskLabel.labelId, total: count() })
			.from(tlTaskLabel)
			.innerJoin(tlTask, eq(tlTask.id, tlTaskLabel.taskId))
			.where(and(eq(tlTask.projectId, row.id), isNull(tlTask.deletedAt)))
			.groupBy(tlTaskLabel.labelId),
		db
			.select({
				tasks: sql<number>`count(*) filter (where ${tlTask.deletedAt} is null)`.mapWith(Number),
				done: sql<number>`count(*) filter (where ${tlTask.deletedAt} is null and ${tlTask.completedAt} is not null)`.mapWith(
					Number,
				),
				trashed: sql<number>`count(*) filter (where ${tlTask.deletedAt} is not null)`.mapWith(Number),
			})
			.from(tlTask)
			.where(eq(tlTask.projectId, row.id)),
	]);
	if (!item) throw notFound("Project");
	const perStatus = new Map(statusCounts.map((each) => [each.statusId, each.total]));
	const perLabel = new Map(labelCounts.map((each) => [each.labelId, each.total]));
	return {
		...item,
		description: row.descriptionHtml,
		startOn: row.startOn,
		targetOn: row.targetOn,
		version: row.version,
		projectMembers: memberRows.map(
			(each): AdminProjectMember => ({ memberId: each.memberId, name: each.name, email: each.email, role: each.role }),
		),
		statuses: statuses.map((status) => ({ ...workflowRepo.statusDto(status), tasks: perStatus.get(status.id) ?? 0 })),
		labels: labels.map((label) => ({ ...workflowRepo.labelDto(label), tasks: perLabel.get(label.id) ?? 0 })),
		counts: { tasks: totals?.tasks ?? 0, done: totals?.done ?? 0, trashed: totals?.trashed ?? 0 },
	};
}

export async function get({ db }: Pick<Services, "db">, id: string): Promise<AdminProjectDetail> {
	const { workspace } = await team(db);
	return detail(db, workspace.slug, await teamProject(db, workspace.id, id));
}

/** A project with the workspace's starting statuses, led by `leadId` (an active member) or by no one yet. */
export async function create({ db, actor }: Services, input: AdminCreateProjectInput): Promise<AdminProjectDetail> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const access = await resolveWorkspace(tx, appServices(tx, actor).user, workspace.slug);
		await lockQuota(tx, quotaScope(workspace.id));
		const max = quotasOf(access).projects;
		if ((await projectRepo.countProjects(tx, workspace.id)) >= max) throw quotaError("projects", max);
		if (input.leadId) {
			const lead = await members.memberById(tx, workspace.id, input.leadId);
			if (!lead || lead.deactivatedAt) throw fieldError("BAD_REQUEST", "leadId", m.taskline_admin_error_member());
		}
		// A template's days count from the start (Task 57).
		const template = input.template ? await chooseTemplate(tx, access, input.template) : null;
		const created = await projects.insertProjectWithWorkflow(
			tx,
			access,
			{
				key: input.key,
				name: input.name,
				visibility: input.visibility,
				color: input.color,
				startOn: input.startOn ?? (template ? todayInZone(access.settings.timeZone) : null),
			},
			undefined,
			{ leadId: input.leadId, template },
		);
		audit({
			action: "taskline.project.create",
			target: projectTarget(created.project),
			after: {
				key: created.project.key,
				name: created.project.name,
				visibility: created.project.visibility,
				...(template ? { template: template.name } : {}),
			},
		});
		return detail(tx, workspace.slug, created.project);
	});
}

const DETAIL_FIELDS = ["name", "visibility", "color", "startOn", "targetOn"] as const;

/** The details tab: the app's versioned project form (a stale save is a CONFLICT). */
export async function update(
	{ db, actor }: Services,
	{ id, updatedAt, ...fields }: AdminUpdateProjectInput,
): Promise<AdminProjectDetail> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const before = await teamProject(tx, workspace.id, id);
		await projects.updateProject(appServices(tx, actor), {
			ws: workspace.slug,
			key: before.key,
			version: Number(updatedAt),
			...fields,
		});
		const after = await teamProject(tx, workspace.id, id);
		const changed = changes(before, after, DETAIL_FIELDS);
		if (changed) audit({ action: "taskline.project.update", target: projectTarget(after), ...changed });
		return detail(tx, workspace.slug, after);
	});
}

export async function setState(
	{ db, actor }: Services,
	{ id, ...state }: { id: string; status?: Exclude<ProjectStatus, "archived">; health?: ProjectHealth | null },
): Promise<AdminProjectDetail> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const before = await teamProject(tx, workspace.id, id);
		await projects.setProjectState(appServices(tx, actor), { ws: workspace.slug, key: before.key, ...state });
		const after = await teamProject(tx, workspace.id, id);
		const changed = changes(before, after, ["status", "health"] as const);
		if (changed) audit({ action: "taskline.project.state", target: projectTarget(after), ...changed });
		return detail(tx, workspace.slug, after);
	});
}

export async function setArchived(
	{ db, actor }: Services,
	{ id, archived }: { id: string; archived: boolean },
): Promise<AdminProjectDetail> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const before = await teamProject(tx, workspace.id, id);
		await projects.setProjectArchived(appServices(tx, actor), { ws: workspace.slug, key: before.key, archived });
		const after = await teamProject(tx, workspace.id, id);
		if ((before.archivedAt !== null) !== archived) {
			audit({
				action: archived ? "taskline.project.archive" : "taskline.project.unarchive",
				target: projectTarget(after),
			});
		}
		return detail(tx, workspace.slug, after);
	});
}

/** A new lead (an active team member): they become the project's lead, the old one a member. */
export async function transferLead(
	{ db, actor }: Services,
	{ id, memberId }: { id: string; memberId: string },
): Promise<AdminProjectDetail> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const before = await teamProject(tx, workspace.id, id);
		const access = await projectAccess(
			tx,
			await resolveWorkspace(tx, appServices(tx, actor).user, workspace.slug),
			before,
		);
		const lead = await members.memberById(tx, workspace.id, memberId);
		if (!lead || lead.deactivatedAt) throw notFound("Member");
		if (before.leadId === lead.id) return detail(tx, workspace.slug, before);
		if (before.leadId) await projectRepo.upsertProjectMember(tx, before.id, before.leadId, "member");
		await projectRepo.upsertProjectMember(tx, before.id, lead.id, "lead");
		const after = await projectRepo.patchProject(tx, before.id, { leadId: lead.id });
		await recordActivity(tx, access, { kind: "project.member_added", data: { memberId: lead.id, role: "lead" } });
		await bumpRev(tx, before.id);
		audit({
			action: "taskline.project.lead",
			target: projectTarget(after),
			before: { leadId: before.leadId },
			after: { leadId: lead.id, lead: lead.displayName },
		});
		return detail(tx, workspace.slug, after);
	});
}

/**
 * Deletes a project, its tasks and their history, once the key is typed again. The key
 * is retired, never handed out again: refs like `WEB-12` live on in comments and emails.
 */
export async function remove({ db, actor }: Services, { id, confirmKey }: { id: string; confirmKey: string }) {
	await withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const project = await teamProject(tx, workspace.id, id);
		if (confirmKey.trim().toUpperCase() !== project.key) {
			throw fieldError("BAD_REQUEST", "confirmKey", m.taskline_admin_delete_mismatch({ key: project.key }));
		}
		const [tasks] = await tx.select({ total: count() }).from(tlTask).where(eq(tlTask.projectId, project.id));
		await tx.insert(tlRetiredKey).values({ workspaceId: workspace.id, key: project.key }).onConflictDoNothing();
		// Attachments have no foreign key: marked removed here, the daily cleanup deletes the uploads.
		const taskRows = await tx.select({ id: tlTask.id }).from(tlTask).where(eq(tlTask.projectId, project.id));
		await removeTaskFiles(
			tx,
			taskRows.map((row) => row.id),
		);
		await tx.delete(tlProject).where(eq(tlProject.id, project.id));
		audit({
			action: "taskline.project.delete",
			target: projectTarget(project),
			before: { key: project.key, name: project.name, tasks: tasks?.total ?? 0 },
		});
	});
}

/**
 * The project as a file: JSON (the project, its workflow, members, milestones, every task
 * and the dependencies between them) or CSV (the tasks).
 */
export async function exportProject(
	{ db, actor }: Services,
	{ id, format }: { id: string; format: "json" | "csv" },
): Promise<ProjectExport> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const project = await teamProject(tx, workspace.id, id);
		const view = await detail(tx, workspace.slug, project);
		const [taskRows, labelRows, memberRows, milestoneRows, dependencyRows, fieldRows, automationRows, updateRows] =
			await Promise.all([
				tx
					.select()
					.from(tlTask)
					.where(and(eq(tlTask.projectId, project.id), isNull(tlTask.deletedAt)))
					.orderBy(asc(tlTask.number)),
				tx
					.select({ taskId: tlTaskLabel.taskId, name: tlLabel.name })
					.from(tlTaskLabel)
					.innerJoin(tlLabel, eq(tlLabel.id, tlTaskLabel.labelId))
					.innerJoin(tlTask, eq(tlTask.id, tlTaskLabel.taskId))
					.where(eq(tlTask.projectId, project.id)),
				members.listMembers(tx, workspace.id, { deactivated: true }),
				timeline.listMilestones(tx, project.id),
				timeline.projectDependencies(tx, project.id),
				fieldRepo.listFields(tx, workspace.id, project.id),
				automationRepo.listScope(tx, { workspaceId: workspace.id, projectId: project.id }),
				tx
					.select()
					.from(tlProjectUpdate)
					.where(eq(tlProjectUpdate.projectId, project.id))
					.orderBy(asc(tlProjectUpdate.createdAt)),
			]);
		// Task 55: every field's value as words (archived fields too: their values are the project's).
		const fieldDefs = fieldRows.map(fieldRepo.fieldDto);
		const people = memberRows.map((member) => ({ id: member.id, name: member.displayName }));
		const valuesOf = (values: TaskFieldValues) =>
			Object.fromEntries(
				fieldDefs.flatMap((field) =>
					values[field.id] === undefined
						? []
						: [[field.name, fieldValueText(field, values[field.id], people, { csv: true })]],
				),
			) as Record<string, string>;
		const milestoneName = new Map(milestoneRows.map((milestone) => [milestone.id, milestone.name]));
		const refOf = new Map(taskRows.map((task) => [task.id, `${project.key}-${task.number}`]));
		const statusName = new Map(view.statuses.map((status) => [status.id, status.name]));
		const memberName = new Map(memberRows.map((member) => [member.id, member.displayName]));
		const labelsOf = (taskId: string) =>
			labelRows
				.filter((row) => row.taskId === taskId)
				.map((row) => row.name)
				.sort();
		const tasks = taskRows.map((task) => ({
			ref: `${project.key}-${task.number}`,
			title: task.title,
			type: task.type,
			status: statusName.get(task.statusId) ?? "",
			priority: task.priority,
			assignee: task.assigneeId ? (memberName.get(task.assigneeId) ?? "") : "",
			reporter: task.reporterId ? (memberName.get(task.reporterId) ?? "") : "",
			labels: labelsOf(task.id),
			parent: taskRows.find((each) => each.id === task.parentId)?.number ?? null,
			startOn: task.startOn,
			dueOn: task.dueOn,
			completedAt: task.completedAt?.toISOString() ?? null,
			createdAt: task.createdAt.toISOString(),
			description: task.descriptionText,
			checklist: task.checklist,
			milestone: task.milestoneId ? (milestoneName.get(task.milestoneId) ?? null) : null,
			fields: valuesOf(task.fields),
			recurrence: task.recurrence,
		}));
		audit({
			action: "taskline.project.export",
			target: projectTarget(project),
			after: { format, tasks: tasks.length },
		});
		const stamp = new Date().toISOString().slice(0, 10);
		if (format === "csv") {
			return {
				filename: `${project.key.toLowerCase()}-tasks-${stamp}.csv`,
				type: "text/csv",
				content: toCsv(tasks, [
					{ header: "ref", value: (task) => task.ref },
					{ header: "title", value: (task) => task.title },
					{ header: "type", value: (task) => task.type },
					{ header: "status", value: (task) => task.status },
					{ header: "priority", value: (task) => task.priority },
					{ header: "assignee", value: (task) => task.assignee },
					{ header: "labels", value: (task) => task.labels.join("; ") },
					{ header: "start", value: (task) => task.startOn },
					{ header: "due", value: (task) => task.dueOn },
					{ header: "completed", value: (task) => task.completedAt },
					{ header: "created", value: (task) => task.createdAt },
					...fieldDefs.map((field) => ({
						header: field.name,
						value: (task: (typeof tasks)[number]) => task.fields[field.name] ?? "",
					})),
				]),
			};
		}
		const { projectMembers, statuses, labels, counts, ...summary } = view;
		const json = {
			exportedAt: new Date().toISOString(),
			project: summary,
			members: projectMembers.map(({ name, role }) => ({ name, role })),
			statuses: statuses.map(({ name, category, color, wipLimit }) => ({ name, category, color, wipLimit })),
			labels: labels.map(({ name, color }) => ({ name, color })),
			counts,
			milestones: milestoneRows.map(({ name, description, dueOn, completedAt }) => ({
				name,
				description,
				dueOn,
				completedAt: completedAt?.toISOString() ?? null,
			})),
			fields: fieldDefs.map(({ name, type, required, archived, options, projectId }) => ({
				name,
				type,
				required,
				archived,
				workspace: projectId === null,
				options: options.map((option) => option.name),
			})),
			// Task 56: the project's own rules as stored (the ids they name are the project's).
			automations: automationRows.map(({ name, enabled, trigger, conditions, actions }) => ({
				name,
				enabled,
				trigger,
				conditions,
				actions,
			})),
			// Task 57: the lead's updates, oldest first.
			updates: updateRows.map(({ authorId, health, bodyText, createdAt }) => ({
				author: authorId ? (memberName.get(authorId) ?? null) : null,
				health,
				body: bodyText,
				at: createdAt.toISOString(),
			})),
			tasks: tasks.map((task) => ({ ...task, parent: task.parent ? `${project.key}-${task.parent}` : null })),
			// Within the project; one to another project's task isn't the project's to export.
			dependencies: dependencyRows.map((dependency) => ({
				blocker: refOf.get(dependency.blockerId) ?? null,
				blocked: refOf.get(dependency.blockedId) ?? null,
			})),
		};
		return {
			filename: `${project.key.toLowerCase()}-${stamp}.json`,
			type: "application/json",
			content: JSON.stringify(json, null, 2),
		};
	});
}

/** Adds an active team member to the project, or changes their role (as a lead would). */
export async function setMember(
	{ db, actor }: Services,
	{ id, memberId, role }: { id: string; memberId: string; role: ProjectRole },
): Promise<AdminProjectDetail> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const project = await teamProject(tx, workspace.id, id);
		const member = await members.memberById(tx, workspace.id, memberId);
		if (!member) throw notFound("Member");
		await projects.setProjectMember(appServices(tx, actor), { ws: workspace.slug, key: project.key, memberId, role });
		audit({
			action: "taskline.project.member",
			target: projectTarget(project),
			after: { member: member.displayName, role },
		});
		return detail(tx, workspace.slug, await teamProject(tx, workspace.id, id));
	});
}

export async function removeMember(
	{ db, actor }: Services,
	{ id, memberId }: { id: string; memberId: string },
): Promise<AdminProjectDetail> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const project = await teamProject(tx, workspace.id, id);
		const member = await members.memberById(tx, workspace.id, memberId);
		if (!member) throw notFound("Member");
		await projects.removeProjectMember(appServices(tx, actor), { ws: workspace.slug, key: project.key, memberId });
		audit({
			action: "taskline.project.member-remove",
			target: projectTarget(project),
			before: { member: member.displayName },
		});
		return detail(tx, workspace.slug, await teamProject(tx, workspace.id, id));
	});
}

/** Whether a key is free for a new team project: not taken, not retired (the form checks while typing). */
export async function isKeyFree({ db }: Pick<Services, "db">, key: string): Promise<boolean> {
	const { workspace } = await team(db);
	const [taken, retired] = await Promise.all([
		projectRepo.projectKeys(db, workspace.id),
		projectRepo.isKeyRetired(db, workspace.id, key),
	]);
	if (retired) return false;
	return !taken.has(key);
}
