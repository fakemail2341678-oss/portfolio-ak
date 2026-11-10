import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { blockChaal, listChaalBlocks, unblockChaal } from "@/functions/chaal-admin/blocks";
import { listChaalConnections, revokeChaalConnections } from "@/functions/chaal-admin/connections";
import {
	createChaalFeatured,
	deleteChaalFeatured,
	getChaalCuration,
	reorderChaalFeatured,
	saveChaalAnnouncement,
	saveChaalHomeSections,
	updateChaalFeatured,
} from "@/functions/chaal-admin/curation";
import { getChaalHealth, pingChaalLichess } from "@/functions/chaal-admin/health";
import { checkChaalPublicLane, getChaalLab } from "@/functions/chaal-admin/lab";
import { getChaalOverview } from "@/functions/chaal-admin/overview";
import {
	getChaalAdminSettings,
	purgeChaalCache,
	setChaalMaintenance,
	updateChaalSettings,
} from "@/functions/chaal-admin/settings";
import type { Localized } from "@/lib/i18n/localized";
import type { ChaalFeaturedSection, ChaalHomeSectionKey } from "../home/curation";
import { chaalKeys } from "../keys";
import type { ChaalBlockInput, ChaalFeaturedInput, ChaalSettingsInput } from "./schema";
import type { ChaalBlockListInput, ChaalConnectionListInput, ChaalHealthRange, ChaalOverviewRange } from "./search";

/** The admin's Chaal reads and writes (Task 71: the lab; Task 79: settings, connections, blocks, health). */

export const chaalLabQueryOptions = () => queryOptions({ queryKey: chaalKeys.lab(), queryFn: () => getChaalLab() });

export const checkPublicLaneMutationOptions = () =>
	mutationOptions({ mutationKey: [...chaalKeys.lab(), "lane"], mutationFn: () => checkChaalPublicLane() });

export const chaalAdminSettingsQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.adminSettings(), queryFn: () => getChaalAdminSettings() });

export const chaalConnectionsQueryOptions = (input: ChaalConnectionListInput) =>
	queryOptions({
		queryKey: chaalKeys.adminConnectionList(input),
		queryFn: () => listChaalConnections({ data: input }),
	});

export const chaalBlocksQueryOptions = (input: ChaalBlockListInput) =>
	queryOptions({ queryKey: chaalKeys.adminBlockList(input), queryFn: () => listChaalBlocks({ data: input }) });

export const chaalHealthQueryOptions = (range: ChaalHealthRange) =>
	queryOptions({ queryKey: chaalKeys.adminHealth(range), queryFn: () => getChaalHealth({ data: { range } }) });

export const chaalOverviewQueryOptions = (range: ChaalOverviewRange) =>
	queryOptions({ queryKey: chaalKeys.adminOverview(range), queryFn: () => getChaalOverview({ data: { range } }) });

export const chaalCurationQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.adminCuration(), queryFn: () => getChaalCuration() });

/** Writes, for useCrudMutation and useCrudForm. */
export const chaalAdminMutations = {
	updateSettings: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.adminSettings(), "update"],
			// One row: the form's `id` names nothing the server needs.
			mutationFn: ({ id: _id, ...data }: ChaalSettingsInput & { id: string }) => updateChaalSettings({ data }),
		}),
	setMaintenance: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.adminSettings(), "maintenance"],
			mutationFn: (on: boolean) => setChaalMaintenance({ data: { on } }),
		}),
	purgeCache: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.adminSettings(), "purge"],
			mutationFn: () => purgeChaalCache(),
		}),
	revokeConnections: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.adminConnections(), "revoke"],
			mutationFn: (ids: string[]) => revokeChaalConnections({ data: { ids } }),
		}),
	block: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.adminBlocks(), "create"],
			mutationFn: (data: ChaalBlockInput) => blockChaal({ data }),
		}),
	unblock: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.adminBlocks(), "delete"],
			mutationFn: (ids: string[]) => unblockChaal({ data: { ids } }),
		}),
	createFeatured: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.adminCuration(), "create"],
			mutationFn: (data: ChaalFeaturedInput) => createChaalFeatured({ data }),
		}),
	updateFeatured: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.adminCuration(), "update"],
			mutationFn: (data: ChaalFeaturedInput & { id: string; updatedAt: string }) => updateChaalFeatured({ data }),
		}),
	reorderFeatured: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.adminCuration(), "reorder"],
			mutationFn: (data: { section: ChaalFeaturedSection; ids: string[] }) => reorderChaalFeatured({ data }),
		}),
	deleteFeatured: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.adminCuration(), "delete"],
			mutationFn: (ids: string[]) => deleteChaalFeatured({ data: { ids } }),
		}),
	saveSections: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.adminCuration(), "sections"],
			mutationFn: (sections: Array<{ key: ChaalHomeSectionKey; visible: boolean }>) =>
				saveChaalHomeSections({ data: { sections } }),
		}),
	saveAnnouncement: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.adminCuration(), "announcement"],
			mutationFn: (announcement: Localized) => saveChaalAnnouncement({ data: { announcement } }),
		}),
	ping: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.admin(), "ping"],
			mutationFn: () => pingChaalLichess(),
		}),
};
