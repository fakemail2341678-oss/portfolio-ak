import { createFileRoute, redirect } from "@tanstack/react-router";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { KharchaSignIn } from "@/features/kharcha/auth/kharcha-sign-in";
import { kharchaHead } from "@/features/kharcha/brand";
import { KHARCHA_PATHS } from "@/features/kharcha/links";
import { redirectSearchSchema } from "@/lib/http/redirect";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

/**
 * /app/kharcha/sign-in: the shared sign-in form in Kharcha's frame, back into
 * Kharcha afterwards. A guest may sign in: their sample data comes along (0186).
 */
export const Route = createFileRoute("/_kharcha/app/kharcha/sign-in")({
	validateSearch: redirectSearchSchema,
	beforeLoad: ({ context, search }) => {
		if (context.session && !context.session.isAnonymous) {
			throw redirect({ href: localizeHref(search.redirect ?? KHARCHA_PATHS.home) });
		}
	},
	loader: ({ context }) => ensureQuery(context.queryClient, authFeaturesQueryOptions()),
	head: () => kharchaHead(m.kharcha_sign_in()),
	component: KharchaSignIn,
});
