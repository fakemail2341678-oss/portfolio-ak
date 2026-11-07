import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AccountPage } from "@/features/auth/components/account-page";
import { accountSecurityQueryOptions, accountSessionsQueryOptions } from "@/features/auth/queries";
import { ensureQuery } from "@/lib/query";
import { pageTitle } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_authed/account")({
	// ?emailChanged=1 is the callback after confirming a new email address;
	// ?twoFactor=required comes from the admin area when it needs two-factor first (0126).
	validateSearch: z.object({
		emailChanged: z.literal(1).optional().catch(undefined),
		twoFactor: z.literal("required").optional().catch(undefined),
	}),
	loader: ({ context }) =>
		Promise.all([
			ensureQuery(context.queryClient, accountSessionsQueryOptions()),
			ensureQuery(context.queryClient, accountSecurityQueryOptions()),
		]),
	head: () => ({ meta: [{ title: pageTitle(m.account_title()) }] }),
	component: AccountRoute,
});

function AccountRoute() {
	const { session } = Route.useRouteContext();
	const { emailChanged, twoFactor } = Route.useSearch();
	return (
		<AccountPage user={session.user} emailChanged={emailChanged === 1} twoFactorRequested={twoFactor === "required"} />
	);
}
