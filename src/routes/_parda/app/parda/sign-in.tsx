import { createFileRoute, redirect } from "@tanstack/react-router";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { PardaSignIn } from "@/features/parda/auth/parda-sign-in";
import { pardaHead } from "@/features/parda/brand";
import { PARDA_PATHS } from "@/features/parda/links";
import { redirectSearchSchema } from "@/lib/http/redirect";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

/**
 * /app/parda/sign-in: the shared sign-in form in Parda's frame, back into Parda
 * afterwards. A guest may sign in: what they saved comes along (0186).
 */
export const Route = createFileRoute("/_parda/app/parda/sign-in")({
	validateSearch: redirectSearchSchema,
	beforeLoad: ({ context, search }) => {
		if (context.session && !context.session.isAnonymous) {
			throw redirect({ href: localizeHref(search.redirect ?? PARDA_PATHS.home) });
		}
	},
	loader: ({ context }) => ensureQuery(context.queryClient, authFeaturesQueryOptions()),
	head: () => pardaHead(m.pd_sign_in()),
	component: PardaSignIn,
});
