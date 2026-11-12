import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { kharchaHead } from "@/features/kharcha/brand";
import { threadSearch } from "@/features/kharcha/search";
import { FriendThreadPage } from "@/features/kharcha/threads/friend-thread";
import { isAppError } from "@/lib/errors";
import { parseParams } from "@/lib/list/params";
import { ensureQuery } from "@/lib/query";
import { setErrorStatus } from "@/lib/start/http-status";
import { m } from "@/paraglide/messages";

/**
 * /app/kharcha/f/$personId: the thread with a friend (Task 90): what is between the two
 * outside groups, and their balance in each group they share. Someone who isn't the
 * caller's friend is a 404. `?expense=` opens an expense in the panel over it.
 */
export const Route = createFileRoute("/_kharcha/app/kharcha/_shell/f/$personId")({
	params: { parse: (raw) => parseParams(z.object({ personId: z.uuid() }), raw) },
	validateSearch: threadSearch,
	loaderDeps: () => ({}),
	loader: async ({ context, params }) => {
		const { kharchaFriendThreadQueryOptions } = await import("@/features/kharcha/queries");
		try {
			const thread = await ensureQuery(
				context.queryClient,
				kharchaFriendThreadQueryOptions(context.session.user.id, params.personId),
			);
			return { title: thread.friend.person.name };
		} catch (error) {
			if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
			await setErrorStatus(error);
			throw error;
		}
	},
	head: ({ loaderData }) => kharchaHead(loaderData?.title || m.kharcha_friend_page()),
	component: FriendThreadPage,
});
