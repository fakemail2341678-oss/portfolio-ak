import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";
import { authErrorMessage } from "../errors";
import { collectErrors, type FieldErrors, field, validateEmail, validateOtp, validateRequired } from "../validation";
import { AuthField, FormMessage } from "./auth-field";
import { Honeypot, isBot } from "./bot-check";

/**
 * Email + password sign-in. Validates locally, then calls Better Auth; failures
 * show a localized message, success calls `onSignedIn` (the route navigates).
 * Accounts with two-factor on get a second step: a code from the authenticator
 * app, or one of the backup codes.
 */
export function LoginForm({ onSignedIn }: { onSignedIn: () => Promise<void> | void }) {
	const [errors, setErrors] = useState<FieldErrors<"email" | "password">>({});
	const [formError, setFormError] = useState<string>();
	const [pending, setPending] = useState(false);
	const [secondStep, setSecondStep] = useState(false);

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const email = field(form, "email").trim();
		const password = field(form, "password");
		const invalid = collectErrors({ email: validateEmail(email), password: validateRequired(password) });
		setErrors(invalid ?? {});
		setFormError(undefined);
		if (invalid || isBot(form)) return;

		setPending(true);
		const { data, error } = await authClient.signIn.email({ email, password });
		setPending(false);
		if (error) {
			setFormError(authErrorMessage(error));
			return;
		}
		if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
			setSecondStep(true);
			return;
		}
		await onSignedIn();
	};

	if (secondStep) return <TwoFactorStep onSignedIn={onSignedIn} onRestart={() => setSecondStep(false)} />;

	return (
		<form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="login-form">
			{formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
			<AuthField name="email" type="email" autoComplete="email" label={m.auth_email_label()} error={errors.email} />
			<AuthField
				name="password"
				type="password"
				autoComplete="current-password"
				label={m.auth_password_label()}
				error={errors.password}
			/>
			<Honeypot />
			<Button type="submit" disabled={pending}>
				{pending ? m.auth_submitting() : m.auth_submit_login()}
			</Button>
		</form>
	);
}

/** The second factor: a 6-digit app code, or a backup code. Optionally trusts this browser for 30 days. */
function TwoFactorStep({ onSignedIn, onRestart }: { onSignedIn: () => Promise<void> | void; onRestart: () => void }) {
	const [backup, setBackup] = useState(false);
	const [error, setError] = useState<string>();
	const [formError, setFormError] = useState<string>();
	const [pending, setPending] = useState(false);

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const code = field(form, "code").trim();
		const trustDevice = form.get("trustDevice") === "on";
		const invalid = backup ? validateRequired(code) : validateOtp(code);
		setError(invalid);
		setFormError(undefined);
		if (invalid) return;

		setPending(true);
		const { error: failure } = backup
			? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
			: await authClient.twoFactor.verifyTotp({ code, trustDevice });
		setPending(false);
		if (failure) {
			setFormError(authErrorMessage(failure));
			return;
		}
		await onSignedIn();
	};

	return (
		<form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="two-factor-form">
			<p className="text-muted-foreground">{backup ? m.auth_2fa_backup_intro() : m.auth_2fa_intro()}</p>
			{formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
			{backup ? (
				<AuthField key="backup" name="code" autoComplete="off" label={m.auth_2fa_backup_label()} error={error} />
			) : (
				<AuthField
					key="totp"
					name="code"
					label={m.auth_code_label()}
					inputMode="numeric"
					autoComplete="one-time-code"
					pattern="[0-9]{6}"
					maxLength={6}
					error={error}
				/>
			)}
			<label className="flex items-center gap-2 text-sm">
				<input type="checkbox" name="trustDevice" className="size-4" />
				{m.auth_2fa_trust_device()}
			</label>
			<Button type="submit" disabled={pending}>
				{pending ? m.auth_submitting() : m.auth_otp_verify()}
			</Button>
			<Button
				type="button"
				variant="ghost"
				onClick={() => {
					setBackup(!backup);
					setError(undefined);
					setFormError(undefined);
				}}
			>
				{backup ? m.auth_2fa_use_app() : m.auth_2fa_use_backup()}
			</Button>
			<Button type="button" variant="ghost" onClick={onRestart}>
				{m.auth_2fa_restart()}
			</Button>
		</form>
	);
}
