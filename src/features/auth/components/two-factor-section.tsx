import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { renderSVG } from "uqr";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";
import { authErrorMessage } from "../errors";
import { refreshAuth } from "../queries";
import { field, validateOtp, validateRequired } from "../validation";
import { AccountSection, type Status } from "./account-section";
import { AuthField, FormMessage } from "./auth-field";

/** What the authenticator app needs: the otpauth:// URI as a QR code, and its secret for typing in. */
const qrImage = (uri: string) => `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(uri, { border: 2 }))}`;
const secretOf = (uri: string) => new URL(uri).searchParams.get("secret") ?? "";

type Step =
	| { name: "idle" }
	| { name: "scan"; totpURI: string; backupCodes: string[] }
	| { name: "codes"; backupCodes: string[] };

/**
 * Two-factor authentication on the account page (decisions.md 0126): turn it on
 * with an authenticator app (scan, confirm a code, save the backup codes), get new
 * backup codes, or turn it off. Turning it on or off asks for the password when
 * the account has one.
 */
export function TwoFactorSection({
	enabled,
	required,
	hasPassword,
}: {
	enabled: boolean;
	/** AUTH_REQUIRE_ADMIN_2FA applies and it's off: the admin area waits for it. */
	required: boolean;
	hasPassword: boolean;
}) {
	const queryClient = useQueryClient();
	const [step, setStep] = useState<Step>({ name: "idle" });
	const [status, setStatus] = useState<Status>();
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);

	const passwordOf = (form: HTMLFormElement) =>
		hasPassword ? field(new FormData(form), "twoFactorPassword") : undefined;
	const checkPassword = (password: string | undefined) => {
		const invalid = password === undefined ? undefined : validateRequired(password);
		setError(invalid);
		setStatus(undefined);
		return !invalid;
	};

	const start = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const password = passwordOf(event.currentTarget);
		if (!checkPassword(password)) return;
		setPending(true);
		const { data, error: failure } = await authClient.twoFactor.enable(password === undefined ? {} : { password });
		setPending(false);
		if (failure || !data || !("totpURI" in data) || !data.totpURI) {
			return setStatus({ tone: "error", text: authErrorMessage(failure) });
		}
		setStep({ name: "scan", totpURI: data.totpURI, backupCodes: data.backupCodes ?? [] });
	};

	const confirm = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (step.name !== "scan") return;
		const code = field(new FormData(event.currentTarget), "code").trim();
		const invalid = validateOtp(code);
		setError(invalid);
		setStatus(undefined);
		if (invalid) return;
		setPending(true);
		const { error: failure } = await authClient.twoFactor.verifyTotp({ code });
		setPending(false);
		if (failure) return setStatus({ tone: "error", text: authErrorMessage(failure) });
		setStep({ name: "codes", backupCodes: step.backupCodes });
	};

	/** "New backup codes" and "Turn off" share the password field; the clicked button decides. */
	const manage = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
		const password = passwordOf(event.currentTarget);
		if (!checkPassword(password)) return;
		const body = password === undefined ? {} : { password };
		setPending(true);
		if (intent === "codes") {
			const { data, error: failure } = await authClient.twoFactor.generateBackupCodes(body);
			setPending(false);
			if (failure || !data) return setStatus({ tone: "error", text: authErrorMessage(failure) });
			return setStep({ name: "codes", backupCodes: data.backupCodes });
		}
		const { error: failure } = await authClient.twoFactor.disable(body);
		setPending(false);
		if (failure) return setStatus({ tone: "error", text: authErrorMessage(failure) });
		setStatus({ tone: "success", text: m.account_2fa_disabled() });
		await refreshAuth(queryClient);
	};

	const finish = async () => {
		setStep({ name: "idle" });
		setStatus({ tone: "success", text: m.account_2fa_codes_saved() });
		await refreshAuth(queryClient);
	};

	const passwordField = hasPassword ? (
		<AuthField
			name="twoFactorPassword"
			type="password"
			autoComplete="current-password"
			label={m.auth_current_password_label()}
			error={error}
		/>
	) : null;

	return (
		<AccountSection
			id="two-factor"
			title={m.account_2fa_title()}
			description={enabled ? m.account_2fa_on() : m.account_2fa_intro()}
		>
			{required && !enabled ? <FormMessage tone="error">{m.account_2fa_required()}</FormMessage> : null}
			{status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}

			{step.name === "scan" ? (
				<form
					method="post"
					noValidate
					onSubmit={confirm}
					className="flex flex-col gap-4"
					data-testid="2fa-confirm-form"
				>
					<p className="text-sm">{m.account_2fa_scan()}</p>
					<img
						src={qrImage(step.totpURI)}
						alt={m.account_2fa_qr_alt()}
						width={176}
						height={176}
						className="size-44 rounded-md border bg-white"
					/>
					<p className="text-muted-foreground text-sm">
						{m.account_2fa_manual_key()}{" "}
						<code className="break-all font-mono text-foreground" data-testid="2fa-secret">
							{secretOf(step.totpURI)}
						</code>
					</p>
					<AuthField
						name="code"
						label={m.auth_code_label()}
						inputMode="numeric"
						autoComplete="one-time-code"
						pattern="[0-9]{6}"
						maxLength={6}
						error={error}
					/>
					<div className="flex flex-wrap gap-2">
						<Button type="submit" disabled={pending}>
							{m.account_2fa_confirm()}
						</Button>
						<Button type="button" variant="ghost" onClick={() => setStep({ name: "idle" })}>
							{m.common_cancel()}
						</Button>
					</div>
				</form>
			) : step.name === "codes" ? (
				<div className="flex flex-col gap-4" data-testid="2fa-backup-codes">
					<p className="text-sm">{m.account_2fa_codes_intro()}</p>
					<ul className="grid grid-cols-2 gap-2 rounded-md border p-4 font-mono text-sm">
						{step.backupCodes.map((code) => (
							<li key={code}>{code}</li>
						))}
					</ul>
					<Button type="button" className="self-start" onClick={finish}>
						{m.account_2fa_codes_done()}
					</Button>
				</div>
			) : enabled ? (
				<form method="post" noValidate onSubmit={manage} className="flex flex-col gap-4" data-testid="2fa-manage-form">
					{passwordField}
					<div className="flex flex-wrap gap-2">
						<Button type="submit" name="intent" value="codes" variant="outline" disabled={pending}>
							{m.account_2fa_new_codes()}
						</Button>
						<Button type="submit" name="intent" value="disable" variant="destructive" disabled={pending}>
							{m.account_2fa_disable()}
						</Button>
					</div>
				</form>
			) : (
				<form method="post" noValidate onSubmit={start} className="flex flex-col gap-4" data-testid="2fa-enable-form">
					{passwordField}
					<Button type="submit" disabled={pending} className="self-start">
						{m.account_2fa_enable()}
					</Button>
				</form>
			)}
		</AccountSection>
	);
}
