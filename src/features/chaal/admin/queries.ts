import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { blockChaal, listChaalBlocks, unblockChaal } from "@/functions/chaal-admin/blocks";
import { listChaalConnections, revokeChaalConnections } from "@/functions/chaal-admin/connections";
import { getChaalHealth, pingChaalLichess } from "@/functions/chaal-admin/health";
import { checkChaalPublicLane, getChaalLab } from "@/functions/chaal-admin/lab";
import {
	getChaalAdminSettings,
	purgeChaalCache,
	setChaalMaintenance,
	updateChaalSettings,
} from "@/functions/chaal-admin/settings";
import { chaalKeys } from "../keys";
import type { ChaalBlockInput, ChaalSettingsInput } from "./schema";
import type { ChaalBlockListInput, ChaalConnectionListInput, ChaalHealthRange } from "./search";

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
	ping: () =>
		mutationOptions({
			mutationKey: [...chaalKeys.admin(), "ping"],
			mutationFn: () => pingChaalLichess(),
		}),
};
