import type { NotesSearch } from "./search";
import type { NoteSummary } from "./types";

/** The notes the page shows: the view's (or the search's, best match first), one tag, pinned first. */
export function visibleNotes(
	notes: ReadonlyArray<NoteSummary>,
	{ view, tag }: Pick<NotesSearch, "view" | "tag">,
	matches: ReadonlyArray<string> | null,
): NoteSummary[] {
	const inView = notes.filter((note) => note.archived === (view === "archive") && (!tag || note.tags.includes(tag)));
	if (matches) {
		const rank = new Map(matches.map((id, index) => [id, index]));
		return inView.filter((note) => rank.has(note.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
	}
	return inView.sort(
		(a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
	);
}
