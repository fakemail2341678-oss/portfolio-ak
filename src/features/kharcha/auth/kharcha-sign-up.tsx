import { getRouteApi, Link } from "@tanstack/react-router";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { m } from "@/paraglide/messages";
import { KHARCHA_PATHS, kharchaLinks } from "../links";
import { KharchaAuthFrame } from "../shell/public-frame";

const route = getRouteApi("/_kharcha/app/kharcha/sign-up");

/**
 * Kharcha's sign-up: the shared registration in Kharcha's frame. The emailed link
 * verifies the address and continues into Kharcha (the ?redirect= target, or Home).
 * A guest who signs up keeps their sample data (decision 0186).
 */
export function KharchaSignUp() {
	const search = route.useSearch();
	const { turnstileSiteKey } = route.useLoaderData();
	const target = search.redirect ?? KHARCHA_PATHS.home;
	return (
		<KharchaAuthFrame>
			<main {...MAIN_CONTENT} className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
				<RegisterForm
					turnstileSiteKey={turnstileSiteKey}
					verifyPath={`/verify-email?redirect=${encodeURIComponent(target)}`}
					signInLink={
						<Link {...kharchaLinks.signIn(search.redirect)} className="font-medium underline underline-offset-4">
							{m.kharcha_sign_in()}
						</Link>
					}
				/>
			</main>
		</KharchaAuthFrame>
	);
}
