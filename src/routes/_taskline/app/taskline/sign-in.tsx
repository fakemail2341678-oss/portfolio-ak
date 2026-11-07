import { createFileRoute, redirect } from "@tanstack/react-router";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { TasklineSignIn } from "@/features/taskline/auth/taskline-sign-in";
import { tasklineHead } from "@/features/taskline/brand";
import { TASKLINE_PATHS } from "@/features/taskline/links";
import { redirectSearchSchema } from "@/lib/http/redirect";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

/**
 * /app/taskline/sign-in: the shared sign-in form in Taskline's frame, back into
 * Taskline afterwards. A guest may sign in: their sandbox comes along (0186).
 */
export const Route = createFileRoute("/_taskline/app/taskline/sign-in")({
	validateSearch: redirectSearchSchema,
	beforeLoad: ({ context, search }) => {
		if (context.session && !context.session.isAnonymous) {
			throw redirect({ href: localizeHref(search.redirect ?? TASKLINE_PATHS.home) });
		}
	},
	loader: ({ context }) => ensureQuery(context.queryClient, authFeaturesQueryOptions()),
	head: () => tasklineHead(m.taskline_sign_in()),
	component: TasklineSignIn,
});
