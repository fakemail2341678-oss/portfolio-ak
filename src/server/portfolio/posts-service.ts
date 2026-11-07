import "@tanstack/react-start/server-only";
import type { PortfolioStatus, PostDetail, PostInput, PostListItem, PostPage } from "@/features/portfolio/schema";
import type { PostListInput } from "@/features/portfolio/search";
import { canGrant } from "@/features/rbac/types";
import { type Localized, localizedValue } from "@/lib/i18n/localized";
import { changes } from "@/server/audit/record";
import { withAudit } from "@/server/db/crud";
import type { Services } from "@/server/services";
import * as repo from "./posts-repository";

/** What the journal's server functions do after the permission check and validation (audited, 0173). */

/** Whether saves may change the status (publish or unpublish): portfolio:publish. */
const canPublish = (actor: Services["actor"]) => canGrant(actor, ["portfolio:publish"]);

type Reads = Pick<Services, "db" | "imageStore">;

const target = (item: { id: string; title: Localized }) => ({
	type: "post" as const,
	id: item.id,
	label: localizedValue(item.title, "en"),
});

const SUMMARIZED = ["title", "slug", "status", "tags"] as const;
const COMPARED = [...SUMMARIZED, "titleNe", "excerpt", "body", "cover"] as const;
const summary = (item: PostDetail) => ({
	title: item.title.en,
	titleNe: item.title.ne,
	slug: item.slug,
	status: item.status,
	tags: item.tags,
	excerpt: JSON.stringify(item.excerpt),
	body: JSON.stringify(item.body),
	cover: item.cover?.id ?? null,
});

export const list = ({ db, imageStore }: Reads, input: PostListInput): Promise<PostPage> =>
	repo.listPosts(db, input, imageStore);

export const get = ({ db, imageStore }: Reads, id: string): Promise<PostDetail> => repo.getPost(db, id, imageStore);

export const isSlugFree = ({ db }: Pick<Services, "db">, input: { slug: string; id?: string | undefined }) =>
	repo.isSlugFree(db, input.slug, input.id);

export function create({ db, actor, imageStore }: Services, input: PostInput): Promise<PostDetail> {
	return withAudit(db, actor, async (tx, audit) => {
		const created = await repo.createPost(tx, input, {
			userId: actor.id,
			store: imageStore,
			canPublish: canPublish(actor),
		});
		audit({
			action: "post.create",
			target: target(created),
			after: { title: created.title.en, status: created.status },
		});
		return created;
	});
}

export function update(
	{ db, actor, imageStore }: Services,
	{ id, updatedAt, ...input }: PostInput & { id: string; updatedAt: string },
): Promise<PostDetail> {
	return withAudit(db, actor, async (tx, audit) => {
		const saved = await repo.updatePost(tx, id, input, {
			userId: actor.id,
			store: imageStore,
			canPublish: canPublish(actor),
			version: updatedAt,
		});
		const changed = changes(summary(saved.before), summary(saved.item), COMPARED, SUMMARIZED);
		if (changed) audit({ action: "post.update", target: target(saved.item), ...changed });
		return saved.item;
	});
}

export function setStatus(
	{ db, actor, imageStore }: Services,
	{ id, status }: { id: string; status: PortfolioStatus },
): Promise<PostListItem> {
	return withAudit(db, actor, async (tx, audit) => {
		const result = await repo.setPostStatus(tx, id, status, imageStore);
		if (result.changed) {
			audit({
				action: status === "published" ? "post.publish" : "post.unpublish",
				target: target(result.item),
				before: { status: status === "published" ? "draft" : "published" },
				after: { status },
			});
		}
		return result.item;
	});
}

export async function remove({ db, actor }: Services, ids: ReadonlyArray<string>): Promise<{ deleted: number }> {
	const items = await withAudit(db, actor, async (tx, audit) => {
		const deleted = await repo.deletePosts(tx, ids);
		audit(
			...deleted.map((item) => ({
				action: "post.delete" as const,
				target: target(item),
				before: { title: item.title.en, status: item.status },
			})),
		);
		return deleted;
	});
	return { deleted: items.length };
}
