import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import { getNote, listNotes, searchNotes, shareNote, unshareNote, updateNote } from "@/functions/apps/notes";
import { getSharedNote } from "@/functions/apps/notes-public";
import { notesKeys } from "./keys";
import type { UpdateNoteInput } from "./schema";

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
