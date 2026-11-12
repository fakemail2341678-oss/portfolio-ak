import { getRouteApi, Link } from "@tanstack/react-router";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { GoogleButton } from "@/features/auth/components/google-button";
import { LoginForm } from "@/features/auth/components/login-form";
import { useAuthNavigation } from "@/features/auth/use-auth-actions";
import { m } from "@/paraglide/messages";
import { KHARCHA_PATHS, kharchaLinks } from "../links";
import { KharchaAuthFrame } from "../shell/public-frame";

const route = getRouteApi("/_kharcha/app/kharcha/sign-in");

/**
 * Kharcha's sign-in: the shared form (two-factor included) in Kharcha's frame,
 * landing back in Kharcha (the ?redirect= target, or Home). Signing in from a guest
 * session keeps the sample data (decision 0186).
 */
export function KharchaSignIn() {
	const search = route.useSearch();
	const features = route.useLoaderData();
	const { afterSignIn } = useAuthNavigation();
	const target = search.redirect ?? KHARCHA_PATHS.home;
	return (
		<KharchaAuthFrame>
			<main {...MAIN_CONTENT} className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
				<div className="flex flex-col gap-1.5">
					<h1 className="kh-display text-kh-title">{m.kharcha_sign_in_title()}</h1>
					<p className="text-muted-foreground">{m.kharcha_sign_in_intro()}</p>
				</div>
				<LoginForm onSignedIn={() => afterSignIn(target)} />
				<div className="flex flex-col gap-2 text-sm">
					<Link to="/forgot-password" className="underline underline-offset-4">
						{m.auth_forgot_link()}
					</Link>
					<Link to="/sign-in-code" search={{ redirect: target }} className="underline underline-offset-4">
						{m.auth_otp_link()}
					</Link>
				</div>
				{features.google ? (
					<>
						<p className="text-center text-muted-foreground text-sm">{m.auth_or()}</p>
						<GoogleButton redirectTo={target} />
					</>
				) : null}
				<p className="text-sm">
					{m.auth_no_account()}{" "}
					<Link {...kharchaLinks.signUp(search.redirect)} className="font-medium underline underline-offset-4">
						{m.kharcha_sign_up()}
					</Link>
				</p>
			</main>
		</KharchaAuthFrame>
	);
}
