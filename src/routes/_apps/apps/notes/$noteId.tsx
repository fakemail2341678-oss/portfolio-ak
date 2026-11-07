import { createFileRoute, redirect } from "@tanstack/react-router";
import { NoteEditorPage } from "@/features/apps/notes/components/note-editor";
import { noteParamsSchema } from "@/features/apps/notes/search";
import { loadDetailOr404 } from "@/lib/crud/route";
import { parseParams } from "@/lib/list/params";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /apps/notes/$noteId: one of the user's notes in the editor (private; someone else's is a 404). */
export const Route = createFileRoute("/_apps/apps/notes/$noteId")({
	// Only UUIDs match; anything else is the localized 404 without a round trip.
	params: { parse: (raw) => parseParams(noteParamsSchema, raw) },
	beforeLoad: ({ context }) => {
		if (!context.session) throw redirect({ to: "/apps/notes" });
		return { session: context.session };
	},
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { noteQueryOptions } = await import("@/features/apps/notes/queries");
		const note = await loadDetailOr404(context.queryClient, noteQueryOptions(context.session.user.id, params.noteId));
		return { title: note.title };
	},
	head: ({ loaderData }) => privateHead(loaderData?.title ?? m.notes_name()),
	component: NoteEditorPage,
});
