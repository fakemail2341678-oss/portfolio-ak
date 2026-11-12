import { createFileRoute, notFound } from "@tanstack/react-router";
import { kharchaHead } from "@/features/kharcha/brand";
import { JoinPage } from "@/features/kharcha/join/join-page";
import { JOIN_TOKEN } from "@/features/kharcha/search";
import { isAppError } from "@/lib/errors";
import { ensureQuery } from "@/lib/query";
import { setErrorStatus } from "@/lib/start/http-status";
import { m } from "@/paraglide/messages";

/**
 * /app/kharcha/join/$token: an invite link (Task 90, decision 0284). Anyone holding it sees
 * who sent it and the group it came from (noindex, never listed); a signed-in account joins
 * after a confirm, a visitor signs in or up first and comes back here. A token no invite
 * has is Kharcha's 404.
 */
export const Route = createFileRoute("/_kharcha/app/kharcha/join/$token")({
	loader: async ({ context, params }) => {
		if (!JOIN_TOKEN.test(params.token)) throw notFound();
		const { kharchaJoinQueryOptions } = await import("@/features/kharcha/queries");
		try {
			const invite = await ensureQuery(context.queryClient, kharchaJoinQueryOptions(params.token));
			return { inviter: invite.inviter.name };
		} catch (error) {
			if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
			await setErrorStatus(error);
			throw error;
		}
	},
	head: ({ loaderData }) =>
		kharchaHead(loaderData ? m.kharcha_join_title({ name: loaderData.inviter }) : m.kharcha_join_page()),
	component: JoinPage,
});
