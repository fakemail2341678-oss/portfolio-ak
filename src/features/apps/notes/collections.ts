import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { collectionOptions } from "@tanstack/react-db";
import { createNote, deleteNote, listNotes, setNoteFlags } from "@/functions/apps/notes";
import { queryClientOf } from "@/lib/tanstack-db";
import { notesKeys } from "./queries";
import type { NoteList, NoteSummary } from "./types";

/**
 * The user's notes as a TanStack DB collection (decisions 0189, 0190), over the list
 * query the page's loader filled, so the first rows are the server-rendered ones. New
 * notes, pins, archiving and deletes show at once; the handler saves them, and if the
 * server refuses, DB puts the row back. The editor's saves are Query mutations
 * (./queries.ts) that invalidate the list, which this collection then follows.
 */

/** After a save, the list is read again before the optimistic change is dropped (no flicker). */
const saved = async (collection: { utils: { refetch: () => Promise<unknown> } }) => {
	await collection.utils.refetch();
	return { refetch: false };
};

const make = (userId: string) =>
	collectionOptions(`notes:${userId}`, (client) =>
		queryCollectionOptions({
			id: `notes:${userId}`,
			queryKey: notesKeys.list(userId),
			queryFn: () => listNotes(),
			select: (list: NoteList) => list.notes,
			queryClient: queryClientOf(client),
			getKey: (note: NoteSummary) => note.id,
			onInsert: async ({ transaction, collection }) => {
				for (const { modified } of transaction.mutations) {
					await createNote({ data: { id: modified.id, title: modified.title } });
				}
				return saved(collection);
			},
			onUpdate: async ({ transaction, collection }) => {
				for (const { key, changes } of transaction.mutations) {
					await setNoteFlags({ data: { id: String(key), pinned: changes.pinned, archived: changes.archived } });
				}
				return saved(collection);
			},
			onDelete: async ({ transaction, collection }) => {
				for (const { key } of transaction.mutations) await deleteNote({ data: { id: String(key) } });
				return saved(collection);
			},
		}),
	);

const made = new Map<string, ReturnType<typeof make>>();

/** The collection descriptor of one user's notes (the same object every time, as DB needs). */
export function notesCollection(userId: string): ReturnType<typeof make> {
	let found = made.get(userId);
	if (!found) {
		found = make(userId);
		made.set(userId, found);
	}
	return found;
}
