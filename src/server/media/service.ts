import "@tanstack/react-start/server-only";
import type { MediaAltInput, MediaItemDto, MediaPage } from "@/features/media/schema";
import { mediaItem } from "@/features/media/schema";
import type { MediaListInput } from "@/features/media/search";
import { ruleError } from "@/lib/errors";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { toImageAsset } from "@/server/attachments/images";
import { purge, requireStore } from "@/server/attachments/service";
import { changes } from "@/server/audit/record";
import { notFound, withAudit } from "@/server/db/crud";
import type { PublicServices, Services } from "@/server/services";
import * as repo from "./repository";

/**
 * The media library's rules (decision 0177): browse, describe (alt text in
 * both languages) and delete what nothing uses. Uploading goes through the
 * attachments flow with the "media" scope (src/server/attachments/service.ts),
 * which puts verified uploads straight into the library.
 */

const target = (row: { id: string; publicId: string }) => ({
	type: "media" as const,
	id: row.id,
	label: row.publicId.split("/").at(-1) ?? row.publicId,
});

/** One page of the library; empty without Cloudinary (nothing can have been uploaded). */
export const list = async ({ db, imageStore }: PublicServices, input: MediaListInput): Promise<MediaPage> =>
	imageStore ? repo.listMedia(db, input, imageStore) : { items: [], total: 0, page: 1, pageCount: 1 };

/** Changes one item's alt text; the same text then shows wherever it is used. */
export async function setAlt({ db, actor, imageStore }: Services, input: MediaAltInput): Promise<MediaItemDto> {
	const store = requireStore(imageStore);
	return withAudit(db, actor, async (tx, audit) => {
		const before = await repo.lockItem(tx, input.id);
		if (!before) throw notFound("Media");
		const row = await repo.setAlt(tx, input.id, input.alt);
		const changed = changes({ alt: before.alt.en, altNe: before.alt.ne }, { alt: row.alt.en, altNe: row.alt.ne }, [
			"alt",
			"altNe",
		]);
		if (changed) audit({ action: "media.update", target: target(row), ...changed });
		const usage = await repo.usageOf(tx, [row.id]);
		return mediaItem.parse({
			...row,
			image: toImageAsset(store, row),
			name: target(row).label,
			usage: usage.get(row.id) ?? [],
		});
	});
}

/**
 * Deletes items nothing uses; refuses (CONFLICT, naming the first user) when one
 * is still used, and changes nothing then. Their assets are deleted from
 * Cloudinary right away, or by the cleanup job if that fails.
 */
export async function remove(
	{ db, actor, imageStore }: Services,
	ids: ReadonlyArray<string>,
): Promise<{ deleted: number }> {
	const removed = await withAudit(db, actor, async (tx, audit) => {
		const rows = [];
		for (const id of ids) {
			const row = await repo.lockItem(tx, id);
			if (row) rows.push(row);
		}
		const usage = await repo.usageOf(
			tx,
			rows.map((row) => row.id),
		);
		const inUse = rows.find((row) => usage.has(row.id));
		if (inUse) {
			const first = usage.get(inUse.id)?.[0];
			throw ruleError(
				"CONFLICT",
				"Media in use",
				m.media_error_in_use({ name: target(inUse).label, user: first?.label ?? "" }),
			);
		}
		const marked = await repo.markRemoved(
			tx,
			rows.map((row) => row.id),
		);
		audit(
			...marked.map((row) => ({
				action: "media.delete" as const,
				target: target(row),
				before: { alt: localizedValue(row.alt, "en") },
			})),
		);
		return marked;
	});
	await purge(db, imageStore, removed);
	return { deleted: removed.length };
}
