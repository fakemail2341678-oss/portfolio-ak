import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth-shell/auth-shell";
import { SectionPending } from "@/components/errors/pending-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { fontPreloads } from "@/lib/fonts";
import { redirectSearchSchema } from "@/lib/http/redirect";
import { NOINDEX } from "@/lib/seo";
import { getLocale, localizeHref } from "@/paraglide/runtime";

/**
 * Sign-in pages (log in, register, sign-in code, forgot password, upgrade). Signed-in
 * users are sent on to their ?redirect= target (a validated same-site path), or
 * to their account. A guest (decision 0185) counts as signed out here: signing up
 * or in is how they keep their data. Pages a signed-in user may still need (verify
 * email, reset password) live under _public instead.
 */
export const Route = createFileRoute("/_auth")({
	validateSearch: redirectSearchSchema,
	beforeLoad: ({ context, search }) => {
		if (context.session && !context.session.isAnonymous) {
			throw redirect({ href: localizeHref(search.redirect ?? "/account") });
		}
	},
	// Sign-in pages have no search value: every child inherits noindex.
	head: () => ({ meta: [NOINDEX], links: fontPreloads(getLocale()) }),
	component: () => (
		<AuthShell>
			<main {...MAIN_CONTENT} className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
				<SectionPending insideMain>
					<Outlet />
				</SectionPending>
			</main>
		</AuthShell>
	),
});
