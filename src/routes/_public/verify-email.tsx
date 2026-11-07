import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { z } from "zod";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { AuthField, FormMessage } from "@/features/auth/components/auth-field";
import { CheckEmail } from "@/features/auth/components/check-email";
import { claimGuestDataQuietly } from "@/features/auth/use-auth-actions";
import { field, validateEmail } from "@/features/auth/validation";
import { safeRedirectPath } from "@/lib/http/redirect";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

/**
 * Landing page for the emailed verification link. Better Auth verifies the token,
 * signs the user in (autoSignInAfterVerification) and redirects here; on failure
 * it appends ?error=INVALID_TOKEN (or similar). Public, because a successful
 * visit arrives signed in. A guest who signed up here keeps their data (decision
 * 0186): the anonymous plugin moves it when the link opens in the same browser, and
 * this page asks once more in case that browser had lost the guest's session.
 */
export const Route = createFileRoute("/_public/verify-email")({
	// ?redirect= is where "Continue" goes (a section's own start page: Taskline's sign-up sets it).
	validateSearch: z.object({
		error: z.string().max(64).optional().catch(undefined),
		redirect: safeRedirectPath.optional().catch(undefined),
	}),
	head: () => privateHead(m.auth_verify_title()),
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	const { error, redirect } = Route.useSearch();
	const { session } = Route.useRouteContext();
	const [resendTo, setResendTo] = useState<string>();
	const [emailError, setEmailError] = useState<string>();
	const verified = !error && session !== null && !session.isAnonymous;

	useEffect(() => {
		if (verified) void claimGuestDataQuietly();
	}, [verified]);

	const onResend = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const email = field(new FormData(event.currentTarget), "email").trim();
		const invalid = validateEmail(email);
		setEmailError(invalid);
		if (!invalid) setResendTo(email);
	};

	if (resendTo) {
		return (
			<main {...MAIN_CONTENT} className="mx-auto w-full max-w-sm px-4 py-16">
				<CheckEmail email={resendTo} />
			</main>
		);
	}

	return (
		<main
			{...MAIN_CONTENT}
			className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16"
			data-testid="verify-email-page"
		>
			<h1 className="font-semibold text-2xl tracking-tight">{m.auth_verify_title()}</h1>
			{!verified ? (
				<>
					<FormMessage tone="error">{m.auth_verify_failed()}</FormMessage>
					<form method="post" noValidate onSubmit={onResend} className="flex flex-col gap-4">
						<AuthField name="email" type="email" autoComplete="email" label={m.auth_email_label()} error={emailError} />
						<Button type="submit" variant="outline">
							{m.auth_resend_verification()}
						</Button>
					</form>
				</>
			) : (
				<>
					<FormMessage tone="success">{m.auth_verify_success()}</FormMessage>
					<Button asChild>
						{redirect ? (
							<a href={localizeHref(redirect)}>{m.auth_continue()}</a>
						) : (
							<Link to="/account">{m.auth_continue()}</Link>
						)}
					</Button>
				</>
			)}
		</main>
	);
}
