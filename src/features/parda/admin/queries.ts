import { mutationOptions, queryOptions } from "@tanstack/react-query";
import {
	createPardaBillboard,
	createPardaCollection,
	deletePardaBillboards,
	deletePardaCollections,
	getPardaAdminCollection,
	getPardaBillboard,
	getPardaLayout,
	listPardaBillboards,
	listPardaCollections,
	reorderPardaBillboards,
	savePardaLayout,
	searchPardaTitles,
	updatePardaBillboard,
	updatePardaCollection,
} from "@/functions/parda-admin/curation";
import { getPardaOverview } from "@/functions/parda-admin/overview";
import { listPardaLabSources, openPardaLabPlayer } from "@/functions/parda-admin/player-lab";
import { listPardaReports, setPardaReportStatus } from "@/functions/parda-admin/reports";
import {
	getPardaSettings,
	purgePardaCache,
	setPardaPlayback,
	setPardaSourceOrder,
	updatePardaSettings,
} from "@/functions/parda-admin/settings";
import {
	createPardaSource,
	deletePardaSources,
	getPardaSource,
	listPardaSources,
	reorderPardaSources,
	setPardaSourceState,
	updatePardaSource,
} from "@/functions/parda-admin/sources";
import { blockPardaTitle, listPardaTakedowns, unblockPardaTitles } from "@/functions/parda-admin/titles";
import type { PardaPage } from "../search";
import { pardaAdminKeys } from "./keys";
import type {
	BillboardInput,
	CollectionInput,
	LabPlayerInput,
	LayoutInput,
	ReportStatusInput,
	SettingsInput,
	SourceInput,
	SourceStateInput,
	TakedownInput,
} from "./schema";
import type { PardaOverviewRange, PardaReportListInput, PardaTakedownListInput } from "./search";

/** Reads: loaders `ensureQuery` these (imported with `await import()`, 0194), components read them. */

export const pardaLabSourcesQueryOptions = () =>
	queryOptions({ queryKey: pardaAdminKeys.labSources(), queryFn: () => listPardaLabSources() });

export const pardaSourcesQueryOptions = () =>
	queryOptions({ queryKey: pardaAdminKeys.sources(), queryFn: () => listPardaSources() });

export const pardaSourceQueryOptions = (id: string) =>
	queryOptions({
		queryKey: pardaAdminKeys.source(id),
		queryFn: () => getPardaSource({ data: { id } }),
		// The edit form's defaults must not change under the admin while editing.
		staleTime: Number.POSITIVE_INFINITY,
	});

export const pardaTakedownsQueryOptions = (input: PardaTakedownListInput) =>
	queryOptions({ queryKey: pardaAdminKeys.takedownList(input), queryFn: () => listPardaTakedowns({ data: input }) });

export const pardaReportsQueryOptions = (input: PardaReportListInput) =>
	queryOptions({ queryKey: pardaAdminKeys.reportList(input), queryFn: () => listPardaReports({ data: input }) });

export const pardaSettingsQueryOptions = () =>
	queryOptions({ queryKey: pardaAdminKeys.settings(), queryFn: () => getPardaSettings() });

export const pardaOverviewQueryOptions = (range: PardaOverviewRange) =>
	queryOptions({ queryKey: pardaAdminKeys.overview(range), queryFn: () => getPardaOverview({ data: { range } }) });

export const pardaBillboardsQueryOptions = () =>
	queryOptions({ queryKey: pardaAdminKeys.billboards(), queryFn: () => listPardaBillboards() });

export const pardaBillboardQueryOptions = (id: string) =>
	queryOptions({
		queryKey: pardaAdminKeys.billboard(id),
		queryFn: () => getPardaBillboard({ data: { id } }),
		// The edit form's defaults must not change under the admin while editing.
		staleTime: Number.POSITIVE_INFINITY,
	});

export const pardaCollectionsQueryOptions = () =>
	queryOptions({ queryKey: pardaAdminKeys.collections(), queryFn: () => listPardaCollections() });

export const pardaAdminCollectionQueryOptions = (id: string) =>
	queryOptions({
		queryKey: pardaAdminKeys.collection(id),
		queryFn: () => getPardaAdminCollection({ data: { id } }),
		// The edit form's defaults must not change under the admin while editing.
		staleTime: Number.POSITIVE_INFINITY,
	});

export const pardaLayoutQueryOptions = (page: PardaPage) =>
	queryOptions({ queryKey: pardaAdminKeys.layout(page), queryFn: () => getPardaLayout({ data: { page } }) });

/** The title picker's search (forms that pick a title). */
export const searchTitleOptions = (q: string) => searchPardaTitles({ data: { q } });

export const openLabPlayerMutationOptions = () =>
	mutationOptions({ mutationFn: (data: LabPlayerInput) => openPardaLabPlayer({ data }) });

/** Writes, keyed. useCrudMutation and useCrudForm add the rest. */
export const pardaAdminMutations = {
	createSource: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.sources(), "create"],
			mutationFn: (data: SourceInput) => createPardaSource({ data }),
		}),
	updateSource: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.sources(), "update"],
			mutationFn: (data: SourceInput & { id: string; updatedAt: string }) => updatePardaSource({ data }),
		}),
	setSourceState: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.sources(), "state"],
			mutationFn: (data: SourceStateInput) => setPardaSourceState({ data }),
		}),
	reorderSources: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.sources(), "reorder"],
			mutationFn: (ids: string[]) => reorderPardaSources({ data: { ids } }),
		}),
	deleteSources: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.sources(), "delete"],
			mutationFn: (ids: string[]) => deletePardaSources({ data: { ids } }),
		}),
	blockTitle: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.takedowns(), "block"],
			mutationFn: (data: TakedownInput) => blockPardaTitle({ data }),
		}),
	unblockTitles: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.takedowns(), "unblock"],
			mutationFn: (ids: string[]) => unblockPardaTitles({ data: { ids } }),
		}),
	setReportStatus: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.reports(), "status"],
			mutationFn: (data: ReportStatusInput) => setPardaReportStatus({ data }),
		}),
	updateSettings: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.settings(), "update"],
			// One row: the form's `id` names nothing the server needs.
			mutationFn: ({ id: _id, ...data }: SettingsInput & { id: string }) => updatePardaSettings({ data }),
		}),
	setPlayback: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.settings(), "playback"],
			mutationFn: (enabled: boolean) => setPardaPlayback({ data: { enabled } }),
		}),
	setSourceOrder: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.settings(), "source-order"],
			mutationFn: (mode: "auto" | "manual") => setPardaSourceOrder({ data: { mode } }),
		}),
	createBillboard: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.billboards(), "create"],
			mutationFn: (data: BillboardInput) => createPardaBillboard({ data }),
		}),
	updateBillboard: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.billboards(), "update"],
			mutationFn: (data: BillboardInput & { id: string; updatedAt: string }) => updatePardaBillboard({ data }),
		}),
	reorderBillboards: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.billboards(), "reorder"],
			mutationFn: (data: { page: PardaPage; ids: string[] }) => reorderPardaBillboards({ data }),
		}),
	deleteBillboards: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.billboards(), "delete"],
			mutationFn: (ids: string[]) => deletePardaBillboards({ data: { ids } }),
		}),
	createCollection: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.collections(), "create"],
			mutationFn: (data: CollectionInput) => createPardaCollection({ data }),
		}),
	updateCollection: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.collections(), "update"],
			mutationFn: (data: CollectionInput & { id: string; updatedAt: string }) => updatePardaCollection({ data }),
		}),
	deleteCollections: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.collections(), "delete"],
			mutationFn: (ids: string[]) => deletePardaCollections({ data: { ids } }),
		}),
	saveLayout: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.all, "layout", "save"],
			mutationFn: (data: LayoutInput) => savePardaLayout({ data }),
		}),
	purgeCache: () =>
		mutationOptions({
			mutationKey: [...pardaAdminKeys.settings(), "purge"],
			mutationFn: () => purgePardaCache(),
		}),
};
