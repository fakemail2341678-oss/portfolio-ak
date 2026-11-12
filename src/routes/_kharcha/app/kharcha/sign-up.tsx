import { createFileRoute, redirect } from "@tanstack/react-router";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { KharchaSignUp } from "@/features/kharcha/auth/kharcha-sign-up";
import { kharchaHead } from "@/features/kharcha/brand";
import { KHARCHA_PATHS } from "@/features/kharcha/links";
import { redirectSearchSchema } from "@/lib/http/redirect";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

/** /app/kharcha/sign-up: the shared registration form in Kharcha's frame. A guest who signs up keeps their sample data (0186). */
export const Route = createFileRoute("/_kharcha/app/kharcha/sign-up")({
	validateSearch: redirectSearchSchema,
	beforeLoad: ({ context, search }) => {
		if (context.session && !context.session.isAnonymous) {
			throw redirect({ href: localizeHref(search.redirect ?? KHARCHA_PATHS.home) });
		}
	},
	// The Turnstile site key, when a captcha is configured.
	loader: ({ context }) => ensureQuery(context.queryClient, authFeaturesQueryOptions()),
	head: () => kharchaHead(m.kharcha_sign_up()),
	component: KharchaSignUp,
});
