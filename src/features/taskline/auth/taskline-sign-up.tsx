import { getRouteApi, Link } from "@tanstack/react-router";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { m } from "@/paraglide/messages";
import { TASKLINE_PATHS, tasklineLinks } from "../links";
import { TasklineAuthFrame } from "../shell/public-frame";

const route = getRouteApi("/_taskline/app/taskline/sign-up");

/**
 * Taskline's sign-up: the shared registration in Taskline's frame. The emailed link
 * verifies the address and continues into Taskline (the ?redirect= target, or Home).
 * A guest who signs up keeps their sandbox (decision 0186).
 */
export function TasklineSignUp() {
	const search = route.useSearch();
	const { turnstileSiteKey } = route.useLoaderData();
	const target = search.redirect ?? TASKLINE_PATHS.home;
	return (
		<TasklineAuthFrame>
			<main {...MAIN_CONTENT} className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
				<RegisterForm
					turnstileSiteKey={turnstileSiteKey}
					verifyPath={`/verify-email?redirect=${encodeURIComponent(target)}`}
					signInLink={
						<Link {...tasklineLinks.signIn(search.redirect)} className="font-medium underline underline-offset-4">
							{m.taskline_sign_in()}
						</Link>
					}
				/>
			</main>
		</TasklineAuthFrame>
	);
}
