import { createFileRoute, redirect } from "@tanstack/react-router";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { TasklineSignUp } from "@/features/taskline/auth/taskline-sign-up";
import { tasklineHead } from "@/features/taskline/brand";
import { TASKLINE_PATHS } from "@/features/taskline/links";
import { redirectSearchSchema } from "@/lib/http/redirect";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

/** /app/taskline/sign-up: the shared registration form in Taskline's frame. A guest who signs up keeps their sandbox (0186). */
export const Route = createFileRoute("/_taskline/app/taskline/sign-up")({
	validateSearch: redirectSearchSchema,
	beforeLoad: ({ context, search }) => {
		if (context.session && !context.session.isAnonymous) {
			throw redirect({ href: localizeHref(search.redirect ?? TASKLINE_PATHS.home) });
		}
	},
	// The Turnstile site key, when a captcha is configured.
	loader: ({ context }) => ensureQuery(context.queryClient, authFeaturesQueryOptions()),
	head: () => tasklineHead(m.taskline_sign_up()),
	component: TasklineSignUp,
});
