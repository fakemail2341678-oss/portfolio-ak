import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import { getNote, listNotes, searchNotes, shareNote, unshareNote, updateNote } from "@/functions/apps/notes";
import { getSharedNote } from "@/functions/apps/notes-public";
import type { UpdateNoteInput } from "./schema";

/**
 * Notes' reads and the editor's writes (decision 0190). Keys carry the user's id, so
 * another account signing in on the same tab never sees cached notes. The list is a
 * TanStack DB collection over the list query (./collections.ts); search asks the
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

export const notesListQueryOptions = (userId: string) =>
	queryOptions({ queryKey: notesKeys.list(userId), queryFn: () => listNotes() });

export const notesSearchQueryOptions = (userId: string, q: string) =>
	queryOptions({ queryKey: notesKeys.search(userId, q), queryFn: () => searchNotes({ data: { q } }) });

export const noteQueryOptions = (userId: string, id: string) =>
	queryOptions({ queryKey: notesKeys.note(userId, id), queryFn: () => getNote({ data: { id } }) });

export const sharedNoteQueryOptions = (token: string) =>
	queryOptions({ queryKey: notesKeys.shared(token), queryFn: () => getSharedNote({ data: { token } }) });

/** After a save the list and searches are read again (titles, excerpts and matches changed). */
const refreshLists = (queryClient: QueryClient, userId: string) =>
	Promise.all([
		queryClient.invalidateQueries({ queryKey: notesKeys.list(userId) }),
		queryClient.invalidateQueries({ queryKey: [...notesKeys.user(userId), "search"] }),
	]);

export const noteMutations = {
	save: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: UpdateNoteInput) => updateNote({ data: input }),
			onSuccess: (note) => queryClient.setQueryData(notesKeys.note(userId, note.id), note),
			onSettled: () => refreshLists(queryClient, userId),
		}),
	share: (queryClient: QueryClient, userId: string, id: string) =>
		mutationOptions({
			mutationFn: () => shareNote({ data: { id } }),
			onSettled: () =>
				Promise.all([
					queryClient.invalidateQueries({ queryKey: notesKeys.note(userId, id) }),
					refreshLists(queryClient, userId),
				]),
		}),
	unshare: (queryClient: QueryClient, userId: string, id: string) =>
		mutationOptions({
			mutationFn: () => unshareNote({ data: { id } }),
			onSettled: () =>
				Promise.all([
					queryClient.invalidateQueries({ queryKey: notesKeys.note(userId, id) }),
					refreshLists(queryClient, userId),
				]),
		}),
};
