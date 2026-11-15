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
