import { getRouteApi, Link } from "@tanstack/react-router";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { m } from "@/paraglide/messages";
import { PARDA_PATHS, pardaLinks } from "../links";

const route = getRouteApi("/_parda/app/parda/sign-up");

/**
 * Parda's sign-up, copied from Taskline's (0215): the shared registration in Parda's
 * frame. The emailed link verifies the address and continues into Parda (the
 * ?redirect= target, or home). A guest who signs up keeps what they saved (0186).
 */
export function PardaSignUp() {
	const search = route.useSearch();
	const { turnstileSiteKey } = route.useLoaderData();
	const target = search.redirect ?? PARDA_PATHS.home;
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none">
			<div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
				<RegisterForm
					turnstileSiteKey={turnstileSiteKey}
					verifyPath={`/verify-email?redirect=${encodeURIComponent(target)}`}
					signInLink={
						<Link
							{...pardaLinks.signIn(search.redirect)}
							className="font-medium underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
						>
							{m.pd_sign_in()}
						</Link>
					}
				/>
			</div>
		</main>
	);
}
