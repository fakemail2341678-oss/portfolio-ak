import { createFileRoute, notFound, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { kharchaHead } from "@/features/kharcha/brand";
import { THREAD_SEARCH_DEFAULTS, threadSearch } from "@/features/kharcha/search";
import { GroupThreadPage } from "@/features/kharcha/threads/group-thread";
import { isAppError } from "@/lib/errors";
import { parseParams } from "@/lib/list/params";
import { ensureQuery } from "@/lib/query";
import { setErrorStatus } from "@/lib/start/http-status";
import { m } from "@/paraglide/messages";

/**
 * /app/kharcha/g/$groupId: a group's thread (Task 90), `?tab=settings` its details and
 * members. A group the caller was never in is a 404, as one that doesn't exist (0277).
 * `?expense=` opens an expense in the panel over it (masked as /e/$expenseId); neither
 * search value reloads the thread.
 */
export const Route = createFileRoute("/_kharcha/app/kharcha/_shell/g/$groupId")({
	params: { parse: (raw) => parseParams(z.object({ groupId: z.uuid() }), raw) },
	validateSearch: threadSearch,
	search: { middlewares: [stripSearchParams(THREAD_SEARCH_DEFAULTS)] },
	loaderDeps: () => ({}),
	loader: async ({ context, params }) => {
		const { kharchaGroupThreadQueryOptions } = await import("@/features/kharcha/queries");
		try {
			const thread = await ensureQuery(
				context.queryClient,
				kharchaGroupThreadQueryOptions(context.session.user.id, params.groupId),
			);
			return { title: thread.group.name };
		} catch (error) {
			if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
			await setErrorStatus(error);
			throw error;
		}
	},
	head: ({ loaderData }) => kharchaHead(loaderData?.title || m.kharcha_group_page()),
	component: GroupThreadPage,
});
