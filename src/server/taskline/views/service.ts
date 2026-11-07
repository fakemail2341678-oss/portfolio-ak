import "@tanstack/react-start/server-only";
import { SAVED_VIEWS_MAX, type SaveViewInput } from "@/features/taskline/schema";
import type { SavedViewDto, SavedViewKind, SavedViews } from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { notFound } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import { assertCan, type ProjectAccess, resolveProject, type TasklineServices } from "../access";
import { notMemberError } from "../rules";
import * as repo from "./repository";

/**
 * Saved views (Task 51, docs/guides/taskline.md, "Finding things"): a search string
 * for one of a project's views, kept per member. Anyone with a member row who may
 * see the project saves their own; an editor may share one with the project. The
 * author deletes theirs, and the project's lead a shared one too. Saving a name
 * again replaces that view. Views aren't project data: no activity, no `rev`.
 */

const dto = (access: ProjectAccess, row: repo.SavedViewWithAuthor): SavedViewDto => {
	const mine = access.member !== null && row.memberId === access.member.id;
	return {
		id: row.id,
		name: row.name,
		view: row.view,
		search: row.search,
		shared: row.shared,
		author: row.author,
		mine,
		canDelete: mine || (row.shared && access.can.manage),
	};
};

export async function listViews(
	{ db, user }: TasklineServices,
	input: { ws: string; key: string; view: SavedViewKind },
): Promise<SavedViews> {
	const access = await resolveProject(db, user, input.ws, input.key);
	const me = access.member?.id ?? null;
	const rows = await repo.listViews(db, access.project.id, input.view, me);
	return {
		views: rows.map((row) => dto(access, row)),
		canSave: me !== null,
		canShare: me !== null && access.can.edit,
	};
}

export async function saveView({ db, user }: TasklineServices, input: SaveViewInput): Promise<SavedViewDto> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, input.ws, input.key);
		const member = access.member;
		if (!member) throw notMemberError();
		if (input.shared) assertCan(access, "edit");
		await lockQuota(tx, `taskline-views:${member.id}:${access.project.id}`);
		const same = await repo.viewByName(tx, access.project.id, member.id, input.view, input.name);
		const values = { name: input.name, search: input.search, shared: input.shared };
		if (same) {
			const row = await repo.updateView(tx, same.id, values);
			return dto(access, { ...row, author: member.displayName });
		}
		if ((await repo.countViews(tx, access.project.id, member.id)) >= SAVED_VIEWS_MAX) {
			throw ruleError(
				"CONFLICT",
				"Taskline quota reached: saved views",
				m.taskline_views_quota({ max: formatNumber(SAVED_VIEWS_MAX) }),
			);
		}
		const row = await repo.insertView(tx, {
			...values,
			workspaceId: access.workspace.id,
			projectId: access.project.id,
			memberId: member.id,
			view: input.view,
		});
		return dto(access, { ...row, author: member.displayName });
	});
}

/** Someone else's personal view is not found; a shared one they may not delete is FORBIDDEN. */
export async function deleteView(
	{ db, user }: TasklineServices,
	input: { ws: string; key: string; id: string },
): Promise<void> {
	await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, input.ws, input.key);
		const row = await repo.getView(tx, access.project.id, input.id);
		const mine = row !== null && access.member !== null && row.memberId === access.member.id;
		if (!row || (!mine && !row.shared)) throw notFound("View");
		if (!mine) assertCan(access, "manage");
		await repo.deleteView(tx, row.id);
	});
}
