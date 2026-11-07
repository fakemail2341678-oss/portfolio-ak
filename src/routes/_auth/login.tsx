import { createFileRoute, Link } from "@tanstack/react-router";
import { GoogleButton } from "@/features/auth/components/google-button";
import { LoginForm } from "@/features/auth/components/login-form";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { useAuthNavigation } from "@/features/auth/use-auth-actions";
import { ensureQuery } from "@/lib/query";
import { pageTitle } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/login")({
	loader: ({ context }) => ensureQuery(context.queryClient, authFeaturesQueryOptions()),
	head: () => ({ meta: [{ title: pageTitle(m.auth_login_title()) }] }),
	component: LoginPage,
});

function LoginPage() {
	const search = Route.useSearch();
	const features = Route.useLoaderData();
	const { afterSignIn } = useAuthNavigation();
	const target = search.redirect ?? "/account";

	return (
		<>
			<h1 className="font-semibold text-2xl tracking-tight">{m.auth_login_title()}</h1>
			<LoginForm onSignedIn={() => afterSignIn(target)} />
			<div className="flex flex-col gap-2 text-sm">
				<Link to="/forgot-password" className="underline underline-offset-4">
					{m.auth_forgot_link()}
				</Link>
				<Link to="/sign-in-code" search={search} className="underline underline-offset-4">
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
				<Link to="/register" search={search} className="font-medium underline underline-offset-4">
					{m.auth_register_title()}
				</Link>
			</p>
		</>
	);
}
