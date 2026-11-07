import { createFileRoute, redirect } from "@tanstack/react-router";
import { accountSecurityQueryOptions, accountSessionsQueryOptions } from "@/features/auth/queries";
import { TasklineAccount } from "@/features/taskline/auth/taskline-account";
import { tasklineTitle } from "@/features/taskline/brand";
import { tasklineLinks } from "@/features/taskline/links";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /app/taskline/account: the account page's sections inside Taskline. A guest has no account: they go to sign-up. */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/account")({
	beforeLoad: ({ context, location }) => {
		if (context.session.isAnonymous) throw redirect(tasklineLinks.signUp(location.href));
	},
	loader: ({ context }) =>
		Promise.all([
			ensureQuery(context.queryClient, accountSessionsQueryOptions()),
			ensureQuery(context.queryClient, accountSecurityQueryOptions()),
		]),
	staticData: { breadcrumb: staticCrumb(m.nav_account) },
	head: () => ({ meta: [{ title: tasklineTitle(m.account_title()) }] }),
	component: TasklineAccount,
});
