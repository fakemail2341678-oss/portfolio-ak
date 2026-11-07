import "@tanstack/react-start/server-only";
import type {
	PortfolioStatus,
	ProjectDetail,
	ProjectInput,
	ProjectListItem,
	ProjectOrderItem,
	ProjectPage,
} from "@/features/portfolio/schema";
import type { ProjectListInput } from "@/features/portfolio/search";
import { canGrant } from "@/features/rbac/types";
import { changes } from "@/server/audit/record";
import { withAudit } from "@/server/db/crud";
import type { Services } from "@/server/services";
import * as repo from "./projects-repository";

/**
 * What the projects' server functions do once the permission check and input
 * validation have passed: plain functions over the call's services, tested on
 * PGlite. Every change is audited in its own transaction (0173).
 */

/** Whether saves may change the status (publish or unpublish): portfolio:publish. */
const canPublish = (actor: Services["actor"]) => canGrant(actor, ["portfolio:publish"]);

type Reads = Pick<Services, "db" | "imageStore">;

const target = (item: { id: string; title: string }) => ({ type: "project" as const, id: item.id, label: item.title });

/** What an edit compares: everything; what its audit row shows: the short fields (the rest counts, uncopied). */
const SUMMARIZED = ["title", "slug", "year", "status", "featured", "disciplines", "stack"] as const;
const COMPARED = [...SUMMARIZED, "content", "media"] as const;
const summary = (item: ProjectDetail) => ({
	title: item.title,
	slug: item.slug,
	year: item.year,
	status: item.status,
	featured: item.featured,
	disciplines: item.disciplines,
	stack: item.stack,
	content: JSON.stringify([
		item.client,
		item.role,
		item.duration,
		item.summary,
		item.links,
		item.metrics,
		item.blocks,
		item.artSeed,
		item.motif,
		item.glyph,
		item.appSlug, // @apps
	]),
	media: [item.cover?.id ?? "", ...item.gallery.map((image) => image.id)],
});

export const list = ({ db, imageStore }: Reads, input: ProjectListInput): Promise<ProjectPage> =>
	repo.listProjects(db, input, imageStore);

export const listOrder = ({ db }: Pick<Services, "db">): Promise<ProjectOrderItem[]> => repo.listProjectOrder(db);

export const get = ({ db, imageStore }: Reads, id: string): Promise<ProjectDetail> =>
	repo.getProject(db, id, imageStore);

export const isSlugFree = ({ db }: Pick<Services, "db">, input: { slug: string; id?: string | undefined }) =>
	repo.isSlugFree(db, input.slug, input.id);

export function create({ db, actor, imageStore }: Services, input: ProjectInput): Promise<ProjectDetail> {
	return withAudit(db, actor, async (tx, audit) => {
		const created = await repo.createProject(tx, input, {
			userId: actor.id,
			store: imageStore,
			canPublish: canPublish(actor),
		});
		audit({
			action: "project.create",
			target: target(created),
			after: { title: created.title, status: created.status },
		});
		return created;
	});
}

/** Saves the project if nobody changed it since `updatedAt` (else a stale CONFLICT). */
export function update(
	{ db, actor, imageStore }: Services,
	{ id, updatedAt, ...input }: ProjectInput & { id: string; updatedAt: string },
): Promise<ProjectDetail> {
	return withAudit(db, actor, async (tx, audit) => {
		const saved = await repo.updateProject(tx, id, input, {
			userId: actor.id,
			store: imageStore,
			canPublish: canPublish(actor),
			version: updatedAt,
		});
		const changed = changes(summary(saved.before), summary(saved.item), COMPARED, SUMMARIZED);
		if (changed) audit({ action: "project.update", target: target(saved.item), ...changed });
		return saved.item;
	});
}

/** Publish / unpublish; setting the status it already has records nothing. */
export function setStatus(
	{ db, actor, imageStore }: Services,
	{ id, status }: { id: string; status: PortfolioStatus },
): Promise<ProjectListItem> {
	return withAudit(db, actor, async (tx, audit) => {
		const result = await repo.setProjectStatus(tx, id, status, imageStore);
		if (result.changed) {
			audit({
				action: status === "published" ? "project.publish" : "project.unpublish",
				target: target(result.item),
				before: { status: status === "published" ? "draft" : "published" },
				after: { status },
			});
		}
		return result.item;
	});
}

/** Deletes one or many, one audit row each; missing ids are ignored. Their media stays in the library. */
export async function remove({ db, actor }: Services, ids: ReadonlyArray<string>): Promise<{ deleted: number }> {
	const items = await withAudit(db, actor, async (tx, audit) => {
		const deleted = await repo.deleteProjects(tx, ids);
		audit(
			...deleted.map((item) => ({
				action: "project.delete" as const,
				target: target(item),
				before: { title: item.title, status: item.status },
			})),
		);
		return deleted;
	});
	return { deleted: items.length };
}

/** The display order of every project; one audit row when anything moved. */
export function reorder({ db, actor }: Services, ids: ReadonlyArray<string>): Promise<{ moved: number }> {
	return withAudit(db, actor, async (tx, audit) => {
		const moved = await repo.reorderProjects(tx, ids);
		if (moved > 0) {
			audit({ action: "project.reorder", target: { type: "project", id: "order", label: "" }, after: { moved } });
		}
		return { moved };
	});
}
