import { createFileRoute, Link } from "@tanstack/react-router";
import { RegisterForm } from "@/features/auth/components/register-form";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { ensureQuery } from "@/lib/query";
import { pageTitle } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/register")({
	// The Turnstile site key, when a captcha is configured.
	loader: ({ context }) => ensureQuery(context.queryClient, authFeaturesQueryOptions()),
	head: () => ({ meta: [{ title: pageTitle(m.auth_register_title()) }] }),
	component: RegisterPage,
});

function RegisterPage() {
	const search = Route.useSearch();
	const { turnstileSiteKey } = Route.useLoaderData();
	return (
		<RegisterForm
			turnstileSiteKey={turnstileSiteKey}
			signInLink={
				<Link to="/login" search={search} className="font-medium underline underline-offset-4">
					{m.auth_login_title()}
				</Link>
			}
		/>
	);
}
