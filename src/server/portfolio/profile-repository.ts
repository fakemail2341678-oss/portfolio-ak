import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import { PROFILE_ID, type ProfileDetail, type ProfileInput, profileDetail } from "@/features/portfolio/schema";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { notFound, updateVersioned } from "@/server/db/crud";
import { type PortfolioProfileRow, portfolioProfile } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { lockMedia, mediaAssets } from "@/server/media/repository";

/**
 * The owner's profile: one row (id "profile"), written by `pnpm db:seed-portfolio`
 * and edited at /admin/portfolio/profile. Portrait, résumé and social image are
 * media-library items.
 */

const WHAT = "Profile";

export async function findProfileRow(db: Db | Tx): Promise<PortfolioProfileRow | null> {
	const [row] = await db.select().from(portfolioProfile).where(eq(portfolioProfile.id, PROFILE_ID));
	return row ?? null;
}

async function detail(db: Db | Tx, store: ImageStore | null, row: PortfolioProfileRow): Promise<ProfileDetail> {
	const assets = await mediaAssets(db, store, [row.portraitId, row.resumeId, row.ogImageId]);
	const asset = (id: string | null) => (id ? (assets.get(id) ?? null) : null);
	return profileDetail.parse({
		...row,
		portrait: asset(row.portraitId),
		resume: asset(row.resumeId),
		ogImage: asset(row.ogImageId),
	});
}

/** The profile, or NOT_FOUND before the portfolio is seeded. */
export async function getProfile(db: Db, store: ImageStore | null): Promise<ProfileDetail> {
	const row = await findProfileRow(db);
	if (!row) throw notFound(WHAT);
	return detail(db, store, row);
}

/** Saves the profile if it still has `version` (else a stale CONFLICT). Returns it before and after. */
export async function updateProfile(
	tx: Tx,
	input: ProfileInput,
	options: { store: ImageStore | null; version: string },
): Promise<{ before: ProfileDetail; item: ProfileDetail }> {
	await lockMedia(tx, [
		{ id: input.portraitId, field: "portrait" },
		{ id: input.resumeId, field: "resume" },
		{ id: input.ogImageId, field: "ogImage" },
	]);
	const current = await findProfileRow(tx);
	if (!current) throw notFound(WHAT);
	const before = await detail(tx, options.store, current);
	const row = await updateVersioned(tx, portfolioProfile, {
		id: PROFILE_ID,
		version: options.version,
		set: input,
		what: WHAT,
	});
	return { before, item: await detail(tx, options.store, row) };
}
