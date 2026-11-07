import { createFileRoute } from "@tanstack/react-router";
import { surpriseSearchSchema } from "@/features/parda/search";

/**
 * /app/parda/surprise?from=movies: "Surprise me" (PLAN Task 63). A redirect to a random
 * title from the page's good lists, so it works as a plain link; nothing to show, so
 * no component. Without a catalogue or a title it goes back to the page it came from.
 */
export const Route = createFileRoute("/_parda/app/parda/surprise")({
	validateSearch: surpriseSearchSchema,
	loaderDeps: ({ search }) => ({ from: search.from }),
	loader: async ({ deps }) => {
		const { surpriseRedirect } = await import("@/features/parda/title/load");
		return surpriseRedirect(deps.from);
	},
});
