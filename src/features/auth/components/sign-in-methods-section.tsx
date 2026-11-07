import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { setMyPassword } from "@/functions/auth";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";
import { authErrorMessage } from "../errors";
import { authKeys } from "../keys";
import type { AccountSecurity } from "../schema";
import { localizedPath } from "../use-auth-actions";
import { collectErrors, type FieldErrors, field, validateConfirm, validatePassword } from "../validation";
import { AccountSection, type Status } from "./account-section";
import { AuthField, FormMessage } from "./auth-field";

/**
 * The ways into the account (decisions.md 0130): a password and Google. Someone who
 * signed up with Google can add a password; Google can be linked, and unlinked
 * only while a password remains (Better Auth refuses to remove the last way in).
 */
export function SignInMethodsSection({ security }: { security: AccountSecurity }) {
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<Status>();
	const [errors, setErrors] = useState<FieldErrors<"password" | "confirm">>({});
	const [pending, setPending] = useState(false);

	const googleAccountId = security.google.accountId;
	const reload = () => queryClient.invalidateQueries({ queryKey: authKeys.security });

	const setPassword = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const newPassword = field(form, "password");
		const invalid = collectErrors({
			password: validatePassword(newPassword),
			confirm: validateConfirm(newPassword, field(form, "confirm")),
		});
		setErrors(invalid ?? {});
		setStatus(undefined);
		if (invalid) return;
		setPending(true);
		try {
			await setMyPassword({ data: { newPassword } });
			setStatus({ tone: "success", text: m.account_methods_password_set() });
			await reload();
		} catch (error) {
			setStatus({ tone: "error", text: errorMessage(error) });
		} finally {
			setPending(false);
		}
	};

	const linkGoogle = async () => {
		setPending(true);
		setStatus(undefined);
		// Leaves for Google; the callback brings the user back here.
		const { error } = await authClient.linkSocial({ provider: "google", callbackURL: localizedPath("/account") });
		if (error) {
			setPending(false);
			setStatus({ tone: "error", text: authErrorMessage(error) });
		}
	};

	const unlinkGoogle = async (accountId: string) => {
		setPending(true);
		setStatus(undefined);
		const { error } = await authClient.unlinkAccount({ accountId });
		setPending(false);
		if (error) return setStatus({ tone: "error", text: authErrorMessage(error) });
		setStatus({ tone: "success", text: m.account_methods_google_unlinked() });
		await reload();
	};

	return (
		<AccountSection title={m.account_methods_title()} description={m.account_methods_intro()}>
			{status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
			<div className="flex flex-col gap-2" data-testid="method-password">
				<h3 className="font-medium text-sm">{m.auth_password_label()}</h3>
				{security.hasPassword ? (
					<p className="text-muted-foreground text-sm">{m.account_methods_password_on()}</p>
				) : (
					<form
						method="post"
						noValidate
						onSubmit={setPassword}
						className="flex flex-col gap-4"
						data-testid="set-password-form"
					>
						<p className="text-muted-foreground text-sm">{m.account_methods_password_none()}</p>
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
						<Button type="submit" disabled={pending} className="self-start">
							{m.account_methods_password_submit()}
						</Button>
					</form>
				)}
			</div>
			{security.google.available || googleAccountId ? (
				<div className="flex flex-col gap-2 border-t pt-4" data-testid="method-google">
					<h3 className="font-medium text-sm">Google</h3>
					{googleAccountId ? (
						<>
							<p className="text-muted-foreground text-sm">
								{security.hasPassword ? m.account_methods_google_on() : m.account_methods_google_only()}
							</p>
							<Button
								type="button"
								variant="outline"
								className="self-start"
								disabled={pending || !security.hasPassword}
								onClick={() => unlinkGoogle(googleAccountId)}
							>
								{m.account_methods_google_unlink()}
							</Button>
						</>
					) : (
						<>
							<p className="text-muted-foreground text-sm">{m.account_methods_google_off()}</p>
							<Button type="button" variant="outline" className="self-start" disabled={pending} onClick={linkGoogle}>
								{m.account_methods_google_link()}
							</Button>
						</>
					)}
				</div>
			) : null}
		</AccountSection>
	);
}
