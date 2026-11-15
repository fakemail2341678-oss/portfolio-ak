/**
 * Forms' reads and writes (decision 0195). Keys carry the user's id, so another
 * account signing in on the same tab never sees cached forms. Writes are Query
 * mutations that refresh the user's keys; the public page's read has no user.
 */
export const formsKeys = {
	all: ["apps", "forms"] as const,
	user: (userId: string) => [...formsKeys.all, userId] as const,
	list: (userId: string) => [...formsKeys.user(userId), "list"] as const,
	form: (userId: string, id: string) => [...formsKeys.user(userId), "form", id] as const,
	results: (userId: string, id: string, page: number) => [...formsKeys.user(userId), "results", id, page] as const,
	public: (slug: string) => [...formsKeys.all, "public", slug] as const,
};
