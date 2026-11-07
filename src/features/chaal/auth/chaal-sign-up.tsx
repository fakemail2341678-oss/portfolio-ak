import { getRouteApi, Link } from "@tanstack/react-router";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { m } from "@/paraglide/messages";
import { CHAAL_PATHS, chaalLinks } from "../links";

const route = getRouteApi("/_chaal/app/chaal/sign-up");

/**
 * Chaal's sign-up, copied from Parda's (0215): the shared registration in Chaal's
 * frame. The emailed link verifies the address and continues into Chaal (the
 * ?redirect= target, or home). A guest who signs up keeps their Lichess connection and preferences (0186).
 */
export function ChaalSignUp() {
	const search = route.useSearch();
	const { turnstileSiteKey } = route.useLoaderData();
	const target = search.redirect ?? CHAAL_PATHS.home;
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none">
			<div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
				<RegisterForm
					turnstileSiteKey={turnstileSiteKey}
					verifyPath={`/verify-email?redirect=${encodeURIComponent(target)}`}
					signInLink={
						<Link
							{...chaalLinks.signIn(search.redirect)}
							className="font-medium underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
						>
							{m.ch_sign_in()}
						</Link>
					}
				/>
			</div>
		</main>
	);
}
