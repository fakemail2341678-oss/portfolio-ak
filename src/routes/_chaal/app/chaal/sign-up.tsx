import { createFileRoute, redirect } from "@tanstack/react-router";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { ChaalSignUp } from "@/features/chaal/auth/chaal-sign-up";
import { chaalHead } from "@/features/chaal/brand";
import { CHAAL_PATHS } from "@/features/chaal/links";
import { redirectSearchSchema } from "@/lib/http/redirect";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

/** /app/chaal/sign-up: the shared registration form in Chaal's frame. A guest who signs up keeps their Lichess connection and preferences (0186). */
export const Route = createFileRoute("/_chaal/app/chaal/sign-up")({
	validateSearch: redirectSearchSchema,
	beforeLoad: ({ context, search }) => {
		if (context.session && !context.session.isAnonymous) {
			throw redirect({ href: localizeHref(search.redirect ?? CHAAL_PATHS.home) });
		}
	},
	// The Turnstile site key, when a captcha is configured.
	loader: ({ context }) => ensureQuery(context.queryClient, authFeaturesQueryOptions()),
	head: () => chaalHead(m.ch_sign_up()),
	component: ChaalSignUp,
});
