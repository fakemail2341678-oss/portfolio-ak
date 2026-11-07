import { createFileRoute, redirect } from "@tanstack/react-router";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { ChaalSignIn } from "@/features/chaal/auth/chaal-sign-in";
import { chaalHead } from "@/features/chaal/brand";
import { CHAAL_PATHS } from "@/features/chaal/links";
import { redirectSearchSchema } from "@/lib/http/redirect";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

/**
 * /app/chaal/sign-in: the shared sign-in form in Chaal's frame, back into Chaal
 * afterwards. A guest may sign in: their Lichess connection and preferences come along (0186).
 */
export const Route = createFileRoute("/_chaal/app/chaal/sign-in")({
	validateSearch: redirectSearchSchema,
	beforeLoad: ({ context, search }) => {
		if (context.session && !context.session.isAnonymous) {
			throw redirect({ href: localizeHref(search.redirect ?? CHAAL_PATHS.home) });
		}
	},
	loader: ({ context }) => ensureQuery(context.queryClient, authFeaturesQueryOptions()),
	head: () => chaalHead(m.ch_sign_in()),
	component: ChaalSignIn,
});
