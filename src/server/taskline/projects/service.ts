import "@tanstack/react-start/server-only";
import type { CreateProjectInput, SetProjectStateInput, UpdateProjectInput } from "@/features/taskline/schema";
import { projectSettings } from "@/features/taskline/settings";
import {
	type ProjectDetail,
	type ProjectLocation,
	type ProjectMemberView,
	type ProjectRole,
	type ProjectSummary,
	SANDBOX_SEGMENT,
} from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { todayInZone } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import { notFound, uniqueViolation } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import { type TlProjectRow, tlProject } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import {
	assertCan,
	assertCanArchive,
	type ProjectAccess,
	projectAccess,
	projectLevel,
	resolveProject,
	resolveWorkspace,
	type TasklineServices,
	type WorkspaceAccess,
} from "../access";
import { recordActivity } from "../activity";
import { actorOf, produce } from "../notify/produce";
import { bumpRev, saveVersioned } from "../rev";
import { fieldError, notMemberError, quotaError, quotaScope, quotasOf, richText } from "../rules";
import { applyTemplate, type ChosenTemplate, chooseTemplate, templateStatuses } from "../templates/service";
import * as members from "../workspace/repository";
import * as repo from "./repository";

/**
 * Projects (docs/guides/taskline.md): who sees which (the resolver), creating one
 * with its default workflow, the project form (versioned), state, archive, stars and
 * project members. Every write records activity and bumps the project's `rev`.
 */

/** The default statuses' names, in `locale` (the caller's when omitted). */
export const defaultStatusNames = (locale?: Locale) => {
	const t = locale ? { locale } : {};
	return [
		m.taskline_status_backlog({}, t),
		m.taskline_status_todo({}, t),
		m.taskline_status_in_progress({}, t),
		m.taskline_status_done({}, t),
		m.taskline_status_canceled({}, t),
	];
};

const keyTaken = () => ({ tl_project_key_unique: { field: "key", message: m.taskline_error_key_taken } }) as const;

async function detailOf(db: Db, access: ProjectAccess): Promise<ProjectDetail> {
	const [stars, counts] = await Promise.all([
		repo.starsOf(db, access.member?.id ?? null, [access.project.id]),
		repo.openTaskCounts(db, [access.project.id]),
	]);
	return repo.projectDetail(access.project, {
		starred: stars.has(access.project.id),
		openTasks: counts.get(access.project.id) ?? 0,
		role: access.projectRole,
		can: access.can,
	});
}

/** The workspace's projects the caller may see (archived ones only when asked), by name. */
export async function listProjects(
	{ db, user }: TasklineServices,
	{ ws, archived = false }: { ws: string; archived?: boolean },
): Promise<ProjectSummary[]> {
	const access = await resolveWorkspace(db, user, ws);
	const rows = await repo.listProjectRows(db, access.workspace.id, { archived });
	const ids = rows.map((row) => row.id);
	const roles = access.member ? await repo.rolesOf(db, access.member.id, ids) : new Map<string, ProjectRole>();
	const visible = rows.filter((row) => projectLevel(access, row, roles.get(row.id) ?? null) !== "none");
	const visibleIds = visible.map((row) => row.id);
	const [stars, counts] = await Promise.all([
		repo.starsOf(db, access.member?.id ?? null, visibleIds),
		repo.openTaskCounts(db, visibleIds),
	]);
	return visible.map((row) =>
		repo.projectSummary(row, { starred: stars.has(row.id), openTasks: counts.get(row.id) ?? 0 }),
	);
}

export async function getProject({ db, user }: TasklineServices, ws: string, key: string): Promise<ProjectDetail> {
	return detailOf(db, await resolveProject(db, user, ws, key));
}

/** The statuses a new project of the workspace starts with: the admin's defaults, else the built-in five in `locale`. */
export const startingStatuses = (access: WorkspaceAccess, locale?: Locale) => {
	if (access.settings.defaultStatuses) return access.settings.defaultStatuses;
	const names = defaultStatusNames(locale);
	return repo.DEFAULT_STATUSES.map((status, index) => ({ ...status, name: names[index] ?? status.category }));
};

/**
 * A project and its rows, inside the caller's transaction: the workspace's starting
 * statuses (built-in ones in `locale`), its lead (the creator unless `leadId` says
 * otherwise: an admin picks one) and the "created" entry. A deleted project's key is
 * refused (never reused). With a template (Task 57), its statuses and the rest of it
 * instead. For the services and for seeds (which pass the guest's language).
 */
export async function insertProjectWithWorkflow(
	tx: Tx,
	access: WorkspaceAccess,
	input: Omit<repo.NewProject, "workspaceId" | "leadId">,
	locale?: Locale,
	{ leadId = access.member?.id ?? null, template }: { leadId?: string | null; template?: ChosenTemplate | null } = {},
): Promise<ProjectAccess> {
	if (await repo.isKeyRetired(tx, access.workspace.id, input.key)) {
		throw fieldError("CONFLICT", "key", m.taskline_error_key_retired());
	}
	let project: TlProjectRow;
	try {
		project = await repo.insertProject(tx, {
			...input,
			workspaceId: access.workspace.id,
			leadId,
			...(template ? { settings: template.definition.settings } : {}),
		});
	} catch (error) {
		throw uniqueViolation(error, keyTaken());
	}
	await repo.insertStatuses(tx, project.id, template ? templateStatuses(template) : startingStatuses(access, locale));
	if (leadId) await repo.upsertProjectMember(tx, project.id, leadId, "lead");
	const created = await projectAccess(tx, access, project);
	await recordActivity(tx, created, {
		kind: "project.created",
		data: { key: project.key, name: project.name, ...(template ? { template: template.name } : {}) },
	});
	if (template) await applyTemplate(tx, created, template, project.startOn ?? todayInZone(access.settings.timeZone));
	return created;
}

export async function createProject(
	{ db, user }: TasklineServices,
	{ ws, template, ...input }: CreateProjectInput,
): Promise<ProjectDetail> {
	return db.transaction(async (tx) => {
		const access = await resolveWorkspace(tx, user, ws);
		if (!access.canCreateProject) {
			throw ruleError("FORBIDDEN", "Taskline: cannot create projects", m.taskline_error_create_project());
		}
		await lockQuota(tx, quotaScope(access.workspace.id));
		const max = quotasOf(access).projects;
		if ((await repo.countProjects(tx, access.workspace.id)) >= max) throw quotaError("projects", max);
		const description = richText(input.description);
		const chosen = template ? await chooseTemplate(tx, access, template) : null;
		const created = await insertProjectWithWorkflow(
			tx,
			access,
			{
				key: input.key,
				name: input.name,
				descriptionHtml: description.html,
				descriptionText: description.text,
				color: input.color,
				icon: input.icon,
				visibility: input.visibility ?? access.settings.defaultVisibility,
				// A template's days count from the start.
				startOn: input.startOn ?? (chosen ? todayInZone(access.settings.timeZone) : null),
				targetOn: input.targetOn ?? null,
			},
			undefined,
			{ template: chosen },
		);
		return detailOf(tx, created);
	});
}

/** The project form (leads): saved only from the version it started from. */
export async function updateProject(
	{ db, user }: TasklineServices,
	{ ws, key, version, settings, description, ...fields }: UpdateProjectInput,
): Promise<ProjectDetail> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const before = access.project;
		const text = description === undefined ? undefined : richText(description);
		const project = await saveVersioned(tx, tlProject, {
			id: before.id,
			version,
			what: "Project",
			set: {
				...fields,
				...(text ? { descriptionHtml: text.html, descriptionText: text.text } : {}),
				...(settings ? { settings: projectSettings.parse({ ...before.settings, ...settings }) } : {}),
			},
		});
		const changed = [
			...Object.keys(fields).filter(
				(field) => before[field as keyof typeof fields] !== project[field as keyof typeof fields],
			),
			...(text && text.html !== before.descriptionHtml ? ["description"] : []),
			...(settings ? ["settings"] : []),
		];
		const next = { ...access, project };
		if (changed.length > 0) await recordActivity(tx, next, { kind: "project.updated", data: { fields: changed } });
		await bumpRev(tx, project.id);
		return detailOf(tx, next);
	});
}

/** Status (active, paused, completed) and health, last write wins. */
export async function setProjectState(
	{ db, user }: TasklineServices,
	{ ws, key, ...state }: SetProjectStateInput,
): Promise<ProjectDetail> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const project = await repo.patchProject(tx, access.project.id, state);
		const next = { ...access, project };
		await recordActivity(tx, next, {
			kind: "project.state",
			data: {
				from: { status: access.project.status, health: access.project.health },
				to: { status: project.status, health: project.health },
			},
		});
		await bumpRev(tx, project.id);
		return detailOf(tx, next);
	});
}

/** Archives (read-only for everyone, out of the directory) or restores a project. */
export async function setProjectArchived(
	{ db, user }: TasklineServices,
	{ ws, key, archived }: { ws: string; key: string; archived: boolean },
): Promise<ProjectDetail> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCanArchive(access);
		if ((access.project.archivedAt !== null) === archived) return detailOf(tx, access);
		const project = await repo.patchProject(
			tx,
			access.project.id,
			archived ? { archivedAt: new Date(), status: "archived" } : { archivedAt: null, status: "active" },
		);
		const next = await projectAccess(tx, access, project);
		await recordActivity(tx, next, { kind: archived ? "project.archived" : "project.restored" });
		await bumpRev(tx, project.id);
		return detailOf(tx, next);
	});
}

/** Stars (or unstars) a project for the caller: the sidebar lists starred ones first. */
export async function setProjectStar(
	{ db, user }: TasklineServices,
	{ ws, key, starred }: { ws: string; key: string; starred: boolean },
): Promise<void> {
	await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		if (!access.member) throw notMemberError();
		await repo.setStar(tx, access.member.id, access.project.id, starred);
	});
}

export async function listProjectMembers(
	{ db, user }: TasklineServices,
	ws: string,
	key: string,
): Promise<ProjectMemberView[]> {
	const access = await resolveProject(db, user, ws, key);
	return repo.projectMembers(db, access.project.id);
}

/** Adds a workspace member to the project or changes their role (leads). */
export async function setProjectMember(
	services: TasklineServices,
	{ ws, key, memberId, role }: { ws: string; key: string; memberId: string; role: ProjectRole },
): Promise<ProjectMemberView[]> {
	const { db, user } = services;
	const { result, notify } = await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const member = await members.memberById(tx, access.workspace.id, memberId);
		if (!member || member.deactivatedAt) throw notFound("Member");
		const wasMember = (await repo.rolesOf(tx, member.id, [access.project.id])).has(access.project.id);
		await repo.upsertProjectMember(tx, access.project.id, member.id, role);
		if (role === "lead" && !access.project.leadId) {
			await repo.patchProject(tx, access.project.id, { leadId: member.id });
		}
		await recordActivity(tx, access, { kind: "project.member_added", data: { memberId: member.id, role } });
		await bumpRev(tx, access.project.id);
		const notify = wasMember
			? []
			: await produce(tx, access, actorOf(access, user.id), [
					{ kind: "added", taskId: null, to: [member.id], data: { project: access.project.name } },
				]);
		return { result: await repo.projectMembers(tx, access.project.id), notify };
	});
	if (notify.length > 0) services.deliver?.(notify);
	return result;
}

export async function removeProjectMember(
	{ db, user }: TasklineServices,
	{ ws, key, memberId }: { ws: string; key: string; memberId: string },
): Promise<ProjectMemberView[]> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		if (!(await repo.deleteProjectMember(tx, access.project.id, memberId))) throw notFound("Member");
		if (access.project.leadId === memberId) await repo.patchProject(tx, access.project.id, { leadId: null });
		await recordActivity(tx, access, { kind: "project.member_removed", data: { memberId } });
		await bumpRev(tx, access.project.id);
		return repo.projectMembers(tx, access.project.id);
	});
}

/** A team member joins a team-visible project themselves, when the workspace allows it. */
export async function joinProject(
	{ db, user }: TasklineServices,
	{ ws, key }: { ws: string; key: string },
): Promise<ProjectDetail> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		if (!access.member) throw notMemberError();
		if (access.projectRole) return detailOf(tx, access);
		const allowed =
			access.workspace.kind === "team" &&
			access.settings.membersCanJoin &&
			access.member.role === "member" &&
			access.project.visibility === "team" &&
			!access.project.archivedAt;
		if (!allowed) throw ruleError("FORBIDDEN", "Taskline: cannot join", m.taskline_error_join());
		await repo.upsertProjectMember(tx, access.project.id, access.member.id, "member");
		const next = await projectAccess(tx, access, access.project);
		await recordActivity(tx, next, {
			kind: "project.member_added",
			data: { memberId: access.member.id, role: "member", joined: true },
		});
		await bumpRev(tx, access.project.id);
		return detailOf(tx, next);
	});
}

/**
 * Where a project is, from its id alone: the redirect of an old Kanban board's link
 * (decision 0210; a board became a project with the same id). NOT_FOUND unless the
 * caller may see it: someone else's sandbox never resolves.
 */
export async function locateProject({ db, user }: TasklineServices, id: string): Promise<ProjectLocation> {
	const found = await repo.projectWithWorkspace(db, id);
	if (!found) throw notFound("Project");
	const { project, workspace } = found;
	const ws = workspace.kind === "team" ? workspace.slug : workspace.ownerId === user.id ? SANDBOX_SEGMENT : null;
	if (!ws) throw notFound("Project");
	await resolveProject(db, user, ws, project.key);
	return { ws, key: project.key };
}
