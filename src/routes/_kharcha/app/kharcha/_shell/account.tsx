import { createFileRoute, redirect } from "@tanstack/react-router";
import { accountSecurityQueryOptions, accountSessionsQueryOptions } from "@/features/auth/queries";
import { KharchaAccount } from "@/features/kharcha/auth/kharcha-account";
import { kharchaHead } from "@/features/kharcha/brand";
import { kharchaLinks } from "@/features/kharcha/links";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /app/kharcha/account: the account page's sections inside Kharcha. A guest has no account: they go to sign-up. */
export const Route = createFileRoute("/_kharcha/app/kharcha/_shell/account")({
	beforeLoad: ({ context, location }) => {
		if (context.session.isAnonymous) throw redirect(kharchaLinks.signUp(location.href));
	},
	loader: ({ context }) =>
		Promise.all([
			ensureQuery(context.queryClient, accountSessionsQueryOptions()),
			ensureQuery(context.queryClient, accountSecurityQueryOptions()),
		]),
	head: () => kharchaHead(m.account_title()),
	component: KharchaAccount,
});
