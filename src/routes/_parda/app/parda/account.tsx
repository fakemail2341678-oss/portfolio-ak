import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { PardaAccountPage } from "@/features/parda/account/parda-account-page";
import { pardaHead } from "@/features/parda/brand";
import { pardaLinks } from "@/features/parda/links";
import { m } from "@/paraglide/messages";

/**
 * /app/parda/account (decision 0249): the account page's sections in Parda's look.
 * A visitor signs in first; a guest has no account, so they go to sign-up. Noindex.
 */
export const Route = createFileRoute("/_parda/app/parda/account")({
	// ?emailChanged=1 is the callback after confirming a new email address.
	validateSearch: z.object({ emailChanged: z.literal(1).optional().catch(undefined) }),
	beforeLoad: ({ context, location }) => {
		if (!context.session) throw redirect(pardaLinks.signIn(location.href));
		if (context.session.isAnonymous) throw redirect(pardaLinks.signUp(location.href));
	},
	loader: async ({ context }) => {
		const [{ accountSecurityQueryOptions, accountSessionsQueryOptions }, { ensureQuery }] = await Promise.all([
			import("@/features/auth/queries"),
			import("@/lib/query"),
		]);
		await Promise.all([
			ensureQuery(context.queryClient, accountSessionsQueryOptions()),
			ensureQuery(context.queryClient, accountSecurityQueryOptions()),
		]);
	},
	head: () => pardaHead(m.account_title()),
	component: PardaAccountPage,
});
