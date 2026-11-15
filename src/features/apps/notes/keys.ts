/**
 * Notes' reads and the editor's writes (decision 0190). Keys carry the user's id, so
 * another account signing in on the same tab never sees cached notes. The list is a
 * TanStack DB collection over the list query (./collection.ts); search asks the
 * server for matching ids and the list shows those rows of the collection.
 */
export const notesKeys = {
	all: ["apps", "notes"] as const,
	user: (userId: string) => [...notesKeys.all, userId] as const,
	list: (userId: string) => [...notesKeys.user(userId), "list"] as const,
	search: (userId: string, q: string) => [...notesKeys.user(userId), "search", q] as const,
	note: (userId: string, id: string) => [...notesKeys.user(userId), "note", id] as const,
	shared: (token: string) => [...notesKeys.all, "shared", token] as const,
};
