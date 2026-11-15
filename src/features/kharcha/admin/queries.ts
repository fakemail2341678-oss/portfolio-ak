import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { getKharchaOverview } from "@/functions/kharcha-admin/overview";
import { listKharchaSenders, setKharchaSenderSuspended } from "@/functions/kharcha-admin/senders";
import { getKharchaAdminSettings, updateKharchaSettings } from "@/functions/kharcha-admin/settings";
import { kharchaAdminKeys } from "./keys";
import type { SuspendKharchaSenderInput, UpdateKharchaSettingsInput } from "./schema";

/** /admin/kharcha's reads and writes (Task 96); routes load this on demand (0194). */

export const kharchaOverviewQueryOptions = () =>
	queryOptions({ queryKey: kharchaAdminKeys.overview(), queryFn: () => getKharchaOverview() });

export const kharchaAdminSettingsQueryOptions = () =>
	queryOptions({ queryKey: kharchaAdminKeys.settings(), queryFn: () => getKharchaAdminSettings() });

export const kharchaSendersQueryOptions = () =>
	queryOptions({ queryKey: kharchaAdminKeys.senders(), queryFn: () => listKharchaSenders() });

export const kharchaAdminMutations = {
	updateSettings: () =>
		mutationOptions({
			mutationKey: [...kharchaAdminKeys.all, "update-settings"],
			mutationFn: (input: UpdateKharchaSettingsInput & { id: string }) => {
				const { id: _id, ...data } = input;
				return updateKharchaSettings({ data });
			},
		}),
	suspend: () =>
		mutationOptions({
			mutationKey: [...kharchaAdminKeys.all, "suspend"],
			mutationFn: (input: SuspendKharchaSenderInput) => setKharchaSenderSuspended({ data: input }),
		}),
};
