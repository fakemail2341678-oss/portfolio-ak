import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SavedViewsStore } from "@/components/data-table/saved-views";
import { errorMessage } from "@/components/errors/error-page";
import { m } from "@/paraglide/messages";
import { savedViewsQueryOptions, tasklineMutations } from "./queries";
import type { SavedViewKind } from "./types";

/**
 * A project view's saved views (Task 51), kept per member on the server and shared
 * with the project by editors, as the store the "Views" menu reads
 * (components/data-table/saved-views.tsx). Read when the page has hydrated: the
 * list is inside a closed menu, so nothing on first paint waits for it.
 */
export function useSavedViews(userId: string, ws: string, key: string, view: SavedViewKind): SavedViewsStore {
	const queryClient = useQueryClient();
	const { data } = useQuery(savedViewsQueryOptions(userId, ws, key, view));
	const save = useMutation(tasklineMutations.saveView(queryClient, userId));
	const remove = useMutation(tasklineMutations.deleteView(queryClient, userId));
	const report = (error: unknown) => {
		toast.error(errorMessage(error));
		throw error;
	};
	return {
		views: (data?.views ?? []).map((each) => ({
			id: each.id,
			name: each.name,
			search: each.search,
			shared: each.shared,
			detail: each.mine ? m.taskline_view_shared_by_you() : m.taskline_view_shared_by({ name: each.author }),
			canDelete: each.canDelete,
		})),
		save: data?.canSave
			? (input) =>
					save
						.mutateAsync({ ws, key, view, ...input })
						.then(() => toast.success(m.taskline_view_saved({ name: input.name })), report)
			: undefined,
		canShare: data?.canShare ?? false,
		remove: (id) =>
			remove.mutateAsync({ ws, key, id, view }).catch((error: unknown) => toast.error(errorMessage(error))),
		omit: ["page", "task"],
	};
}
