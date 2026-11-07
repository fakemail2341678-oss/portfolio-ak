import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import { createLink, deleteLink, getLinkStats, listLinks, updateLink } from "@/functions/apps/links";
import type { CreateLinkInput, UpdateLinkInput } from "./schema";
import type { LinkItem, LinkList } from "./types";

/**
 * Links' reads and writes (decision 0191): plain Query, with optimistic pause and
 * delete on the list. Keys carry the user's id, so another account signing in on the
 * same tab never sees cached links.
 */
export const linksKeys = {
	all: ["apps", "links"] as const,
	user: (userId: string) => [...linksKeys.all, userId] as const,
	list: (userId: string) => [...linksKeys.user(userId), "list"] as const,
	stats: (userId: string, id: string) => [...linksKeys.user(userId), "stats", id] as const,
};

export const linksListQueryOptions = (userId: string) =>
	queryOptions({ queryKey: linksKeys.list(userId), queryFn: () => listLinks() });

export const linkStatsQueryOptions = (userId: string, id: string) =>
	queryOptions({ queryKey: linksKeys.stats(userId, id), queryFn: () => getLinkStats({ data: { id } }) });

const refresh = (queryClient: QueryClient, userId: string) =>
	queryClient.invalidateQueries({ queryKey: linksKeys.user(userId) });

/** Changes the list in the cache before the server answers; the snapshot comes back if it refuses. */
const optimistic = async (
	queryClient: QueryClient,
	userId: string,
	update: (links: LinkItem[]) => LinkItem[],
): Promise<{ snapshot: LinkList | undefined }> => {
	const key = linksKeys.list(userId);
	await queryClient.cancelQueries({ queryKey: key });
	const snapshot = queryClient.getQueryData<LinkList>(key);
	if (snapshot) queryClient.setQueryData<LinkList>(key, { ...snapshot, links: update(snapshot.links) });
	return { snapshot };
};

const rollback = (
	queryClient: QueryClient,
	userId: string,
	context: { snapshot: LinkList | undefined } | undefined,
) => {
	if (context?.snapshot) queryClient.setQueryData(linksKeys.list(userId), context.snapshot);
};

export const linkMutations = {
	create: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: CreateLinkInput) => createLink({ data: input }),
			onSettled: () => refresh(queryClient, userId),
		}),
	update: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: UpdateLinkInput) => updateLink({ data: input }),
			onMutate: (input) =>
				optimistic(queryClient, userId, (links) =>
					links.map((link) =>
						link.id === input.id && input.active !== undefined
							? {
									...link,
									active: input.active,
									state:
										link.state === "live" || link.state === "paused" ? (input.active ? "live" : "paused") : link.state,
								}
							: link,
					),
				),
			onError: (_error, _input, context) => rollback(queryClient, userId, context),
			onSettled: () => refresh(queryClient, userId),
		}),
	delete: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (id: string) => deleteLink({ data: { id } }),
			onMutate: (id) => optimistic(queryClient, userId, (links) => links.filter((link) => link.id !== id)),
			onError: (_error, _id, context) => rollback(queryClient, userId, context),
			onSettled: () => refresh(queryClient, userId),
		}),
};
