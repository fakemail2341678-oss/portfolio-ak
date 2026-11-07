import { getRouteApi, Link } from "@tanstack/react-router";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { GoogleButton } from "@/features/auth/components/google-button";
import { LoginForm } from "@/features/auth/components/login-form";
import { useAuthNavigation } from "@/features/auth/use-auth-actions";
import { m } from "@/paraglide/messages";
import { CHAAL_PATHS, chaalLinks } from "../links";

const route = getRouteApi("/_chaal/app/chaal/sign-in");

const link = "underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Chaal's sign-in, copied from Parda's (layers don't import each other, 0215): the
 * shared form (two-factor included) in Chaal's frame, back to the ?redirect= target
 * or Chaal's home. Signing in from a guest session keeps what the guest had: its Lichess connection and preferences (0186).
 */
export function ChaalSignIn() {
	const search = route.useSearch();
	const features = route.useLoaderData();
	const { afterSignIn } = useAuthNavigation();
	const target = search.redirect ?? CHAAL_PATHS.home;
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none">
			<div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
				<div className="flex flex-col gap-1.5">
					<h1 className="ch-display text-ch-title">{m.ch_sign_in_title()}</h1>
					<p className="text-ch-muted">{m.ch_sign_in_intro()}</p>
				</div>
				<LoginForm onSignedIn={() => afterSignIn(target)} />
				<div className="flex flex-col gap-2 text-sm">
					<Link to="/forgot-password" className={link}>
						{m.auth_forgot_link()}
					</Link>
					<Link to="/sign-in-code" search={{ redirect: target }} className={link}>
						{m.auth_otp_link()}
					</Link>
				</div>
				{features.google ? (
					<>
						<p className="text-center text-ch-muted text-sm">{m.auth_or()}</p>
						<GoogleButton redirectTo={target} />
					</>
				) : null}
				<p className="text-sm">
					{m.auth_no_account()}{" "}
					<Link {...chaalLinks.signUp(search.redirect)} className={`font-medium ${link}`}>
						{m.ch_sign_up()}
					</Link>
				</p>
			</div>
		</main>
	);
}
