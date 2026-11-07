import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { projectRevQueryOptions, tasklineKeys } from "./queries";

/**
 * Keeps an open project page fresh without websockets (decision 0209): the project's
 * `rev` is polled every 10 s while the tab is visible, and on focus. When it is past
 * the rev the page's data was read at, everything of the project is read again (the
 * board's collection follows its query). The first read is the loader's; this runs
 * in the browser only, after it.
 */
export function useProjectFreshness(userId: string, ws: string, key: string, shownRev: number) {
	const queryClient = useQueryClient();
	const { data } = useQuery(projectRevQueryOptions(userId, ws, key));
	const latest = data?.rev;
	useEffect(() => {
		if (latest === undefined || latest <= shownRev) return;
		void queryClient.invalidateQueries({
			queryKey: tasklineKeys.project(userId, ws, key),
			// The rev itself was just read: refetching it again would only repeat the question.
			predicate: (query) => query.queryKey.at(-1) !== "rev",
		});
	}, [latest, shownRev, queryClient, userId, ws, key]);
}
