import { createFileRoute, redirect } from "@tanstack/react-router";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { PardaSignUp } from "@/features/parda/auth/parda-sign-up";
import { pardaHead } from "@/features/parda/brand";
import { PARDA_PATHS } from "@/features/parda/links";
import { redirectSearchSchema } from "@/lib/http/redirect";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

/** /app/parda/sign-up: the shared registration form in Parda's frame. A guest who signs up keeps what they saved (0186). */
export const Route = createFileRoute("/_parda/app/parda/sign-up")({
	validateSearch: redirectSearchSchema,
	beforeLoad: ({ context, search }) => {
		if (context.session && !context.session.isAnonymous) {
			throw redirect({ href: localizeHref(search.redirect ?? PARDA_PATHS.home) });
		}
	},
	// The Turnstile site key, when a captcha is configured.
	loader: ({ context }) => ensureQuery(context.queryClient, authFeaturesQueryOptions()),
	head: () => pardaHead(m.pd_sign_up()),
	component: PardaSignUp,
});
