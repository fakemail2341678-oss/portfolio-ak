import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";
import { authErrorMessage } from "../errors";
import { localizedPath } from "../use-auth-actions";
import {
	collectErrors,
	type FieldErrors,
	field,
	validateConfirm,
	validateEmail,
	validatePassword,
	validateRequired,
} from "../validation";
import { AuthField, FormMessage } from "./auth-field";
import { captchaFetchOptions, Honeypot, isBot, useTurnstile } from "./bot-check";
import { CheckEmail } from "./check-email";

type Field = "name" | "email" | "password" | "confirm";

/**
 * Registration (the /register page, and Taskline's sign-up): the title, the form, and
 * "check your email" once it's sent. Verification is required, so there is no
 * session until the emailed link opens `verifyPath` (a de-localized path; it may
 * carry a ?redirect= for after).
 */
export function RegisterForm({
	turnstileSiteKey,
	verifyPath = "/verify-email",
	signInLink,
}: {
	turnstileSiteKey: string | null;
	verifyPath?: string;
	/** The "Sign in" link under the form (the page's own sign-in, with its search). */
	signInLink: ReactNode;
}) {
	const captcha = useTurnstile(turnstileSiteKey);
	const [errors, setErrors] = useState<FieldErrors<Field>>({});
	const [formError, setFormError] = useState<string>();
	const [pending, setPending] = useState(false);
	const [sentTo, setSentTo] = useState<string>();

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const name = field(form, "name").trim();
		const email = field(form, "email").trim();
		const password = field(form, "password");
		const invalid = collectErrors({
			name: validateRequired(name),
			email: validateEmail(email),
			password: validatePassword(password),
			confirm: validateConfirm(password, field(form, "confirm")),
		});
		setErrors(invalid ?? {});
		setFormError(undefined);
		if (invalid) return;
		// A bot filled the hidden field: look successful, send nothing.
		if (isBot(form)) return setSentTo(email);
		if (!captcha.ready) return setFormError(m.auth_error_captcha());

		setPending(true);
		// Verification is required: no session until the emailed link is opened.
		const { error } = await authClient.signUp.email({
			name,
			email,
			password,
			callbackURL: localizedPath(verifyPath),
			...captchaFetchOptions(captcha.token),
		});
		setPending(false);
		captcha.reset();
		if (error) {
			setFormError(authErrorMessage(error));
			return;
		}
		setSentTo(email);
	};

	if (sentTo) return <CheckEmail email={sentTo} />;

	return (
		<>
			<h1 className="font-semibold text-2xl tracking-tight">{m.auth_register_title()}</h1>
			<form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="register-form">
				{formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
				<AuthField name="name" autoComplete="name" label={m.auth_name_label()} error={errors.name} />
				<AuthField name="email" type="email" autoComplete="email" label={m.auth_email_label()} error={errors.email} />
				<AuthField
					name="password"
					type="password"
					autoComplete="new-password"
					label={m.auth_password_label()}
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
				<Honeypot />
				{captcha.element}
				<Button type="submit" disabled={pending}>
					{pending ? m.auth_submitting() : m.auth_submit_register()}
				</Button>
			</form>
			<p className="text-sm">
				{m.auth_have_account()} {signInLink}
			</p>
		</>
	);
}
