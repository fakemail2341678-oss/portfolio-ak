import { createServerFn } from "@tanstack/react-start";
import {
	type ChaalAdminCuration,
	type ChaalAdminFeatured,
	chaalAnnouncementInputSchema,
	chaalFeaturedInputSchema,
	chaalFeaturedOrderInputSchema,
	chaalFeaturedUpdateInputSchema,
	chaalHomeSectionsInputSchema,
} from "@/features/chaal/admin/schema";
import { zodInput } from "@/functions/_lib/validator";
import type { Localized } from "@/lib/i18n/localized";
import { bulkIdsSchema } from "@/lib/list/paging";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { chaalAdmin } from "@/server/chaal/admin/context";
import * as curation from "@/server/chaal/admin/curation";

/** /admin/chaal/curation (Task 84): read with `chaal:read`, changed with `chaal:curate`, every write audited. */

export const getChaalCuration = createServerFn({ method: "GET" })
	.middleware([requirePermission("chaal:read"), withServices])
	.handler(({ context }): Promise<ChaalAdminCuration> => curation.getCuration(context));

export const createChaalFeatured = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:curate"), withServices])
	.validator(zodInput(chaalFeaturedInputSchema))
	.handler(({ data, context }): Promise<ChaalAdminFeatured> => curation.createFeatured(chaalAdmin(context), data));

export const updateChaalFeatured = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:curate"), withServices])
	.validator(zodInput(chaalFeaturedUpdateInputSchema))
	.handler(({ data, context }): Promise<ChaalAdminFeatured> => curation.updateFeatured(chaalAdmin(context), data));

export const reorderChaalFeatured = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:curate"), withServices])
	.validator(zodInput(chaalFeaturedOrderInputSchema))
	.handler(({ data, context }): Promise<{ moved: number }> => curation.reorderFeatured(chaalAdmin(context), data));

export const deleteChaalFeatured = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:curate"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => curation.deleteFeatured(chaalAdmin(context), data.ids));

export const setChaalHomeSections = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:curate"), withServices])
	.validator(zodInput(chaalHomeSectionsInputSchema))
	.handler(
		({ data, context }): Promise<ChaalAdminCuration["sections"]> =>
			curation.saveHomeSections(chaalAdmin(context), data),
	);

export const setChaalAnnouncement = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:curate"), withServices])
	.validator(zodInput(chaalAnnouncementInputSchema))
	.handler(({ data, context }): Promise<Localized> => curation.saveAnnouncement(chaalAdmin(context), data));
