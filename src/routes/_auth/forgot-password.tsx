import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthField, FormMessage } from "@/features/auth/components/auth-field";
import { captchaFetchOptions, Honeypot, isBot, useTurnstile } from "@/features/auth/components/bot-check";
import { authErrorMessage, isCaptchaError } from "@/features/auth/errors";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { localizedPath } from "@/features/auth/use-auth-actions";
import { field, validateEmail } from "@/features/auth/validation";
import { authClient } from "@/lib/auth-client";
import { ensureQuery } from "@/lib/query";
import { pageTitle } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/forgot-password")({
	// The Turnstile site key, when a captcha is configured.
	loader: ({ context }) => ensureQuery(context.queryClient, authFeaturesQueryOptions()),
	head: () => ({ meta: [{ title: pageTitle(m.auth_forgot_title()) }] }),
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const { turnstileSiteKey } = Route.useLoaderData();
	const captcha = useTurnstile(turnstileSiteKey);
	const [error, setError] = useState<string>();
	const [formError, setFormError] = useState<string>();
	const [sentTo, setSentTo] = useState<string>();
	const [pending, setPending] = useState(false);

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const email = field(form, "email").trim();
		const invalid = validateEmail(email);
		setError(invalid);
		setFormError(undefined);
		if (invalid) return;
		if (isBot(form)) return setSentTo(email);
		if (!captcha.ready) return setFormError(m.auth_error_captcha());

		setPending(true);
		const { error: failure } = await authClient.requestPasswordReset({
			email,
			redirectTo: localizedPath("/reset-password"),
			...captchaFetchOptions(captcha.token),
		});
		setPending(false);
		captcha.reset();
		// Same confirmation whether or not the account exists (no enumeration); only rate limits
		// and a refused captcha are shown.
		if (failure?.status === 429 || isCaptchaError(failure)) {
			setFormError(authErrorMessage(failure));
			return;
		}
		setSentTo(email);
	};

	return (
		<>
			<h1 className="font-semibold text-2xl tracking-tight">{m.auth_forgot_title()}</h1>
			{sentTo ? (
				<FormMessage tone="success">{m.auth_forgot_sent({ email: sentTo })}</FormMessage>
			) : (
				<form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="forgot-form">
					<p className="text-muted-foreground">{m.auth_forgot_intro()}</p>
					{formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
					<AuthField name="email" type="email" autoComplete="email" label={m.auth_email_label()} error={error} />
					<Honeypot />
					{captcha.element}
					<Button type="submit" disabled={pending}>
						{pending ? m.auth_submitting() : m.auth_forgot_submit()}
					</Button>
				</form>
			)}
			<Link to="/login" className="text-sm underline underline-offset-4">
				{m.auth_back_to_login()}
			</Link>
		</>
	);
}
