import "@tanstack/react-start/server-only";
import type { ProfileDetail, ProfileInput } from "@/features/portfolio/schema";
import { changes } from "@/server/audit/record";
import { withAudit } from "@/server/db/crud";
import type { Services } from "@/server/services";
import * as repo from "./profile-repository";

/** The profile's server functions' work after the permission check and validation (audited, 0173). */

const SUMMARIZED = ["name", "email", "availability"] as const;
const COMPARED = [...SUMMARIZED, "content", "media"] as const;
const summary = (item: ProfileDetail) => {
	const { id: _id, updatedAt: _updated, portrait, resume, ogImage, name, email, availabilityStatus, ...rest } = item;
	return {
		name: name.en,
		email,
		availability: availabilityStatus,
		content: JSON.stringify({ ...rest, nameNe: name.ne }),
		media: [portrait?.id ?? "", resume?.id ?? "", ogImage?.id ?? ""],
	};
};

export const get = ({ db, imageStore }: Pick<Services, "db" | "imageStore">): Promise<ProfileDetail> =>
	repo.getProfile(db, imageStore);

export function update(
	{ db, actor, imageStore }: Services,
	{ id: _id, updatedAt, ...input }: ProfileInput & { id: string; updatedAt: string },
): Promise<ProfileDetail> {
	return withAudit(db, actor, async (tx, audit) => {
		const saved = await repo.updateProfile(tx, input, { store: imageStore, version: updatedAt });
		const changed = changes(summary(saved.before), summary(saved.item), COMPARED, SUMMARIZED);
		if (changed) {
			audit({
				action: "profile.update",
				target: { type: "profile", id: "profile", label: saved.item.name.en },
				...changed,
			});
		}
		return saved.item;
	});
}
