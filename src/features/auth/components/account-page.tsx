import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { type AccountSession, revokeMySession } from "@/functions/auth";
import { authClient } from "@/lib/auth-client";
import { formatRelativeTimeFrom } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { authErrorMessage } from "../errors";
import { accountSecurityQueryOptions, accountSessionsQueryOptions, authKeys } from "../queries";
import { localizedPath, useAuthNavigation } from "../use-auth-actions";
import { describeUserAgent } from "../user-agent";
import {
	collectErrors,
	type FieldErrors,
	field,
	validateConfirm,
	validateEmail,
	validatePassword,
	validateRequired,
} from "../validation";
import { AccountDataSection } from "./account-data-section";
import { AccountSection as Section, type Status } from "./account-section";
import { AuthField, FormMessage } from "./auth-field";
import { SignInMethodsSection } from "./sign-in-methods-section";
import { TwoFactorSection } from "./two-factor-section";

/**
 * The account page (/account): profile, email, password, two-factor, sign-in
 * methods, sessions and the account's data. The route loads the sessions and
 * security state and passes in what came from the URL.
 */
export function AccountPage({
	user,
	emailChanged,
	twoFactorRequested,
	signedOutTo,
}: {
	user: { name: string; email: string };
	/** Back from the link confirming a new email address. */
	emailChanged: boolean;
	/** Sent here by the admin area to set up two-factor first (0126). */
	twoFactorRequested: boolean;
	/** Where signing out lands (a section's own landing; the home page by default). */
	signedOutTo?: string;
}) {
	const { signOut } = useAuthNavigation({ signedOutTo });

	return (
		<main
			{...MAIN_CONTENT}
			className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12"
			data-testid="account-page"
		>
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">{m.account_title()}</h1>
					<p className="text-muted-foreground" data-testid="account-email">
						{user.email}
					</p>
				</div>
				<Button type="button" variant="outline" onClick={() => void signOut()}>
					{m.nav_logout()}
				</Button>
			</div>
			<AccountSections user={user} emailChanged={emailChanged} twoFactorRequested={twoFactorRequested} />
		</main>
	);
}

/**
 * The account page's sections without its frame, for a product that draws its own
 * (Parda's /app/parda/account, decision 0249, with `AccountSectionFrameProvider`).
 */
export function AccountSections({
	user,
	emailChanged,
	twoFactorRequested,
	accountPath = "/account",
}: {
	user: { name: string; email: string };
	emailChanged: boolean;
	twoFactorRequested: boolean;
	/** The page the new address's confirmation link returns to, with `?emailChanged=1`. */
	accountPath?: string;
}) {
	const { data: security } = useSuspenseQuery(accountSecurityQueryOptions());
	return (
		<>
			{emailChanged ? <FormMessage tone="success">{m.account_email_changed()}</FormMessage> : null}
			<ProfileSection name={user.name} />
			<EmailSection email={user.email} accountPath={accountPath} />
			{security.hasPassword ? <PasswordSection /> : null}
			<TwoFactorSection
				enabled={security.twoFactorEnabled}
				required={security.twoFactorRequired || twoFactorRequested}
				hasPassword={security.hasPassword}
			/>
			<SignInMethodsSection security={security} />
			<SessionsSection />
			<AccountDataSection email={user.email} />
		</>
	);
}

function ProfileSection({ name }: { name: string }) {
	const { refresh } = useAuthNavigation();
	const [error, setError] = useState<string>();
	const [status, setStatus] = useState<Status>();
	const [pending, setPending] = useState(false);

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const value = field(new FormData(event.currentTarget), "name").trim();
		const invalid = validateRequired(value);
		setError(invalid);
		setStatus(undefined);
		if (invalid) return;
		setPending(true);
		const { error: failure } = await authClient.updateUser({ name: value });
		setPending(false);
		if (failure) return setStatus({ tone: "error", text: authErrorMessage(failure) });
		setStatus({ tone: "success", text: m.account_saved() });
		await refresh();
	};

	return (
		<Section title={m.account_profile_title()}>
			<form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="profile-form">
				{status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
				<AuthField name="name" autoComplete="name" defaultValue={name} label={m.auth_name_label()} error={error} />
				<Button type="submit" disabled={pending} className="self-start">
					{m.account_save()}
				</Button>
			</form>
		</Section>
	);
}

function EmailSection({ email, accountPath }: { email: string; accountPath: string }) {
	const [error, setError] = useState<string>();
	const [status, setStatus] = useState<Status>();
	const [pending, setPending] = useState(false);

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const newEmail = field(new FormData(event.currentTarget), "newEmail").trim();
		const invalid =
			validateEmail(newEmail) ??
			(newEmail.toLowerCase() === email.toLowerCase() ? m.auth_error_same_email() : undefined);
		setError(invalid);
		setStatus(undefined);
		if (invalid) return;
		setPending(true);
		// The change takes effect when the link sent to the NEW address is opened;
		// the old address then gets a security notice (see auth.ts afterEmailVerification).
		const { error: failure } = await authClient.changeEmail({
			newEmail,
			callbackURL: localizedPath(`${accountPath}?emailChanged=1`),
		});
		setPending(false);
		if (failure) return setStatus({ tone: "error", text: authErrorMessage(failure) });
		setStatus({ tone: "success", text: m.account_email_sent({ email: newEmail }) });
	};

	return (
		<Section title={m.account_email_title()} description={m.account_email_current({ email })}>
			<form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="email-form">
				{status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
				<AuthField
					name="newEmail"
					type="email"
					autoComplete="email"
					label={m.account_email_new_label()}
					error={error}
				/>
				<Button type="submit" disabled={pending} className="self-start">
					{m.account_email_submit()}
				</Button>
			</form>
		</Section>
	);
}

function PasswordSection() {
	const queryClient = useQueryClient();
	const [errors, setErrors] = useState<FieldErrors<"current" | "password" | "confirm">>({});
	const [status, setStatus] = useState<Status>();
	const [pending, setPending] = useState(false);

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const currentPassword = field(form, "current");
		const newPassword = field(form, "password");
		const invalid = collectErrors({
			current: validateRequired(currentPassword),
			password: validatePassword(newPassword),
			confirm: validateConfirm(newPassword, field(form, "confirm")),
		});
		setErrors(invalid ?? {});
		setStatus(undefined);
		if (invalid) return;
		setPending(true);
		const { error: failure } = await authClient.changePassword({
			currentPassword,
			newPassword,
			revokeOtherSessions: form.get("revokeOthers") === "on",
		});
		setPending(false);
		if (failure) return setStatus({ tone: "error", text: authErrorMessage(failure) });
		formElement.reset();
		setStatus({ tone: "success", text: m.account_password_changed() });
		await queryClient.invalidateQueries({ queryKey: authKeys.sessions });
	};

	return (
		<Section title={m.account_password_title()}>
			<form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="password-form">
				{status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
				<AuthField
					name="current"
					type="password"
					autoComplete="current-password"
					label={m.auth_current_password_label()}
					error={errors.current}
				/>
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
				<label className="flex items-center gap-2 text-sm">
					<input type="checkbox" name="revokeOthers" defaultChecked className="size-4" />
					{m.account_password_revoke_others()}
				</label>
				<Button type="submit" disabled={pending} className="self-start">
					{m.account_password_submit()}
				</Button>
			</form>
		</Section>
	);
}

const deviceLabel = (session: AccountSession) => {
	const { browser, os } = describeUserAgent(session.userAgent);
	if (browser && os) return m.account_session_on({ browser, os });
	return browser ?? os ?? m.account_session_unknown_device();
};

function SessionsSection() {
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(accountSessionsQueryOptions());
	const [status, setStatus] = useState<Status>();
	/** The session being signed out ("others" for all of them), while the request runs. */
	const [pending, setPending] = useState<string>();

	const afterRevoke = async (errorText?: string) => {
		setPending(undefined);
		if (errorText) return setStatus({ tone: "error", text: errorText });
		setStatus({ tone: "success", text: m.account_sessions_revoked() });
		await queryClient.invalidateQueries({ queryKey: authKeys.sessions });
	};

	const revoke = async (id: string) => {
		setPending(id);
		try {
			await revokeMySession({ data: { id } });
			await afterRevoke();
		} catch (error) {
			await afterRevoke(errorMessage(error));
		}
	};

	const revokeOthers = async () => {
		setPending("others");
		const { error } = await authClient.revokeOtherSessions();
		await afterRevoke(error ? authErrorMessage(error) : undefined);
	};

	const others = data.sessions.filter((session) => !session.current);

	return (
		<Section title={m.account_sessions_title()}>
			{status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
			<ul className="flex flex-col divide-y" data-testid="session-list">
				{data.sessions.map((session) => (
					<li key={session.id} className="flex items-center justify-between gap-4 py-3">
						<div className="text-sm">
							<p className="font-medium">
								{m.account_session_meta({
									device: deviceLabel(session),
									when: formatRelativeTimeFrom(session.createdAt, data.now),
								})}
							</p>
							{session.current ? <p className="text-muted-foreground">{m.account_session_current()}</p> : null}
						</div>
						{session.current ? null : (
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={pending !== undefined}
								onClick={() => revoke(session.id)}
							>
								{m.account_session_revoke()}
							</Button>
						)}
					</li>
				))}
			</ul>
			{others.length > 0 ? (
				<Button
					type="button"
					variant="outline"
					className="self-start"
					disabled={pending !== undefined}
					onClick={revokeOthers}
				>
					{m.account_session_revoke_others()}
				</Button>
			) : null}
		</Section>
	);
}
