import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { AuthField, FormMessage } from "@/features/auth/components/auth-field";
import { authErrorMessage } from "@/features/auth/errors";
import { collectErrors, type FieldErrors, field, validateConfirm, validatePassword } from "@/features/auth/validation";
import { authClient } from "@/lib/auth-client";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * Target of the emailed reset link. Better Auth validates the token and redirects
 * here with ?token=…, or with ?error=INVALID_TOKEN when it's invalid or expired.
 *
 * An invitation links here directly with ?token=…&invite=1 (the token is a reset
 * token, decisions.md 0133): the same form, worded as accepting the invitation.
 */
export const Route = createFileRoute("/_public/reset-password")({
	validateSearch: z.object({
		token: z.string().max(512).optional().catch(undefined),
		error: z.string().max(64).optional().catch(undefined),
		// The router parses `invite=1` as the number 1 (like ?emailChanged=1 on /account).
		invite: z.literal(1).optional().catch(undefined),
	}),
	head: ({ match }) => privateHead(match.search.invite ? m.auth_invite_title() : m.auth_reset_title()),
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const { token, error, invite } = Route.useSearch();
	const [errors, setErrors] = useState<FieldErrors<"password" | "confirm">>({});
	const [formError, setFormError] = useState<string>();
	const [done, setDone] = useState(false);
	const [pending, setPending] = useState(false);

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!token) return;
		const form = new FormData(event.currentTarget);
		const password = field(form, "password");
		const invalid = collectErrors({
			password: validatePassword(password),
			confirm: validateConfirm(password, field(form, "confirm")),
		});
		setErrors(invalid ?? {});
		setFormError(undefined);
		if (invalid) return;

		setPending(true);
		const { error: failure } = await authClient.resetPassword({ newPassword: password, token });
		setPending(false);
		if (failure) {
			setFormError(authErrorMessage(failure));
			return;
		}
		setDone(true);
	};

	return (
		<main
			{...MAIN_CONTENT}
			className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16"
			data-testid="reset-password-page"
		>
			<div className="flex flex-col gap-2">
				<h1 className="font-semibold text-2xl tracking-tight">
					{invite ? m.auth_invite_title() : m.auth_reset_title()}
				</h1>
				{invite && !done ? <p className="text-muted-foreground text-sm">{m.auth_invite_description()}</p> : null}
			</div>
			{done ? (
				<>
					<FormMessage tone="success">{invite ? m.auth_invite_success() : m.auth_reset_success()}</FormMessage>
					<Button asChild>
						<Link to="/login">{m.auth_submit_login()}</Link>
					</Button>
				</>
			) : error || !token ? (
				<>
					<FormMessage tone="error">{invite ? m.auth_invite_invalid() : m.auth_reset_invalid()}</FormMessage>
					<Link to="/forgot-password" className="text-sm underline underline-offset-4">
						{m.auth_forgot_submit()}
					</Link>
				</>
			) : (
				<form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
					{formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
					<AuthField
						name="password"
						type="password"
						autoComplete="new-password"
						label={m.auth_new_password_label()}
						description={m.auth_password_hint()}
						error={errors.password}
					/>
					<AuthField
						name="confirm"
						type="password"
						autoComplete="new-password"
						label={m.auth_confirm_password_label()}
						error={errors.confirm}
					/>
					<Button type="submit" disabled={pending}>
						{pending ? m.auth_submitting() : invite ? m.auth_invite_submit() : m.auth_reset_submit()}
					</Button>
				</form>
			)}
		</main>
	);
}
