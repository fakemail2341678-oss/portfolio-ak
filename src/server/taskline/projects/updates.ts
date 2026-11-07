import "@tanstack/react-start/server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DeleteProjectUpdateInput, PostProjectUpdateInput } from "@/features/taskline/schema";
import type { ProjectHealth, ProjectUpdate } from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { notFound } from "@/server/db/crud";
import { tlMember, tlProjectUpdate } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { assertCan, resolveProject, type TasklineServices } from "../access";
import { recordActivity } from "../activity";
import { bumpRev } from "../rev";
import { fieldError, richText } from "../rules";
import * as repo from "./repository";

/**
 * Project updates (Task 57): how a project is doing and a post about it, by whoever may
 * run it. Posting sets the project's health; deleting one leaves the health as it is
 * (a lead changes it in the settings). The overview shows the newest; the admin's
 * overview and reports show the latest of each project.
 */

/** The newest updates the overview shows. */
const UPDATES_SHOWN = 20;

const updateRows = (db: Db) =>
	db
		.select({
			id: tlProjectUpdate.id,
			health: tlProjectUpdate.health,
			body: tlProjectUpdate.bodyHtml,
			author: tlMember.displayName,
			at: tlProjectUpdate.createdAt,
		})
		.from(tlProjectUpdate)
		.leftJoin(tlMember, eq(tlMember.id, tlProjectUpdate.authorId));

export async function listProjectUpdates(
	{ db, user }: TasklineServices,
	{ ws, key }: { ws: string; key: string },
): Promise<ProjectUpdate[]> {
	const access = await resolveProject(db, user, ws, key);
	const rows = await updateRows(db)
		.where(eq(tlProjectUpdate.projectId, access.project.id))
		.orderBy(desc(tlProjectUpdate.createdAt), desc(tlProjectUpdate.id))
		.limit(UPDATES_SHOWN);
	return rows.map((row) => ({ ...row, at: row.at.toISOString() }));
}

export async function postProjectUpdate(
	{ db, user }: TasklineServices,
	{ ws, key, health, body }: PostProjectUpdateInput,
): Promise<ProjectUpdate> {
	return db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		if (access.project.archivedAt) throw ruleError("FORBIDDEN", "Project archived", m.taskline_error_archived());
		const text = richText(body);
		if (!text.text.trim()) throw fieldError("BAD_REQUEST", "body", m.validation_required());
		const [row] = await tx
			.insert(tlProjectUpdate)
			.values({
				projectId: access.project.id,
				authorId: access.member?.id ?? null,
				health,
				bodyHtml: text.html,
				bodyText: text.text,
			})
			.returning();
		if (!row) throw new Error("Project update insert returned no row");
		await repo.patchProject(tx, access.project.id, { health });
		await recordActivity(tx, access, { kind: "project.update_posted", data: { updateId: row.id, health } });
		await bumpRev(tx, access.project.id);
		return {
			id: row.id,
			health: row.health,
			body: row.bodyHtml,
			author: access.member?.displayName ?? null,
			at: row.createdAt.toISOString(),
		};
	});
}

export async function deleteProjectUpdate(
	{ db, user }: TasklineServices,
	{ ws, key, id }: DeleteProjectUpdateInput,
): Promise<void> {
	await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "manage");
		const rows = await tx
			.delete(tlProjectUpdate)
			.where(and(eq(tlProjectUpdate.id, id), eq(tlProjectUpdate.projectId, access.project.id)))
			.returning({ id: tlProjectUpdate.id, health: tlProjectUpdate.health });
		const [row] = rows;
		if (!row) throw notFound("Project update");
		await recordActivity(tx, access, {
			kind: "project.update_deleted",
			data: { updateId: row.id, health: row.health },
		});
		await bumpRev(tx, access.project.id);
	});
}

export type LatestUpdate = { health: ProjectHealth; at: string; author: string | null };

/** Each project's newest update (the admin's overview and reports). */
export async function latestUpdates(db: Db, projectIds: ReadonlyArray<string>): Promise<Map<string, LatestUpdate>> {
	if (projectIds.length === 0) return new Map();
	const rows = await db
		.selectDistinctOn([tlProjectUpdate.projectId], {
			projectId: tlProjectUpdate.projectId,
			health: tlProjectUpdate.health,
			at: tlProjectUpdate.createdAt,
			author: sql<string | null>`${tlMember.displayName}`,
		})
		.from(tlProjectUpdate)
		.leftJoin(tlMember, eq(tlMember.id, tlProjectUpdate.authorId))
		.where(inArray(tlProjectUpdate.projectId, [...projectIds]))
		.orderBy(tlProjectUpdate.projectId, desc(tlProjectUpdate.createdAt));
	return new Map(
		rows.map((row) => [row.projectId, { health: row.health, at: row.at.toISOString(), author: row.author }]),
	);
}
