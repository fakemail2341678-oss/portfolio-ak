import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/features/auth/components/auth-field";
import { authErrorMessage } from "@/features/auth/errors";
import { refreshAuth } from "@/features/auth/queries";
import { authClient } from "@/lib/auth-client";
import { pageTitle } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

/**
 * Where the account-deletion email leads (decisions.md 0129). Signed-in only (the
 * _authed layout sends others to log in and back); one more click sends the
 * emailed token to Better Auth, so opening the link alone (a mail scanner) deletes nothing.
 */
export const Route = createFileRoute("/_authed/account_/delete")({
	validateSearch: z.object({ token: z.string().min(1).max(200).optional().catch(undefined) }),
	head: () => ({ meta: [{ title: pageTitle(m.account_delete_page_title()) }] }),
	component: DeleteAccountPage,
});

function DeleteAccountPage() {
	const { token } = Route.useSearch();
	const { session } = Route.useRouteContext();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);

	const confirm = async () => {
		if (!token) return;
		setPending(true);
		setError(undefined);
		const { error: failure } = await authClient.deleteUser({ token });
		if (failure) {
			setPending(false);
			return setError(authErrorMessage(failure));
		}
		toast.success(m.account_deleted_toast());
		await refreshAuth(queryClient);
		await router.navigate({ href: localizeHref("/"), replace: true });
	};

	return (
		<main
			{...MAIN_CONTENT}
			className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12"
			data-testid="delete-account-page"
		>
			<h1 className="font-semibold text-2xl tracking-tight">{m.account_delete_page_title()}</h1>
			{token ? (
				<>
					<p>{m.account_delete_page_body({ email: session.user.email })}</p>
					{error ? <FormMessage tone="error">{error}</FormMessage> : null}
					<div className="flex flex-wrap gap-2">
						<Button type="button" variant="destructive" disabled={pending} onClick={confirm}>
							{m.account_delete_confirm()}
						</Button>
						<Button asChild variant="outline">
							<Link to="/account">{m.common_cancel()}</Link>
						</Button>
					</div>
				</>
			) : (
				<>
					<FormMessage tone="error">{m.account_delete_no_token()}</FormMessage>
					<Link to="/account" className="text-sm underline underline-offset-4">
						{m.account_title()}
					</Link>
				</>
			)}
		</main>
	);
}
