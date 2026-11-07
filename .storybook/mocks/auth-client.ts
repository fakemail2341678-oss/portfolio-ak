import { fn } from "storybook/test";

type Result = { data: unknown; error: { code?: string; message?: string; status?: number } | null };
const ok = async (): Promise<Result> => ({ data: {}, error: null });
const SAMPLE_BACKUP_CODES = ["a1b2c-d3e4f", "g5h6i-j7k8l", "m9n0o-p1q2r", "s3t4u-v5w6x"];

/**
 * Stand-in for src/lib/auth-client.ts (Better Auth). No network: every call
 * resolves locally. signIn.email rejects "wrong@example.com" so stories can show
 * the error path, and answers "2fa@example.com" with the two-factor step.
 */
export const authClient = {
	signIn: {
		email: fn(
			async ({ email }: { email: string; password: string }): Promise<Result> =>
				email === "wrong@example.com"
					? { data: null, error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } }
					: email === "2fa@example.com"
						? { data: { twoFactorRedirect: true, twoFactorMethods: ["totp"] }, error: null }
						: { data: {}, error: null },
		).mockName("authClient.signIn.email"),
		emailOtp: fn(ok).mockName("authClient.signIn.emailOtp"),
		social: fn(ok).mockName("authClient.signIn.social"),
	},
	signUp: { email: fn(ok).mockName("authClient.signUp.email") },
	signOut: fn(ok).mockName("authClient.signOut"),
	emailOtp: { sendVerificationOtp: fn(ok).mockName("authClient.emailOtp.sendVerificationOtp") },
	sendVerificationEmail: fn(ok).mockName("authClient.sendVerificationEmail"),
	requestPasswordReset: fn(ok).mockName("authClient.requestPasswordReset"),
	resetPassword: fn(ok).mockName("authClient.resetPassword"),
	changeEmail: fn(ok).mockName("authClient.changeEmail"),
	changePassword: fn(ok).mockName("authClient.changePassword"),
	updateUser: fn(ok).mockName("authClient.updateUser"),
	revokeSession: fn(ok).mockName("authClient.revokeSession"),
	revokeOtherSessions: fn(ok).mockName("authClient.revokeOtherSessions"),
	linkSocial: fn(ok).mockName("authClient.linkSocial"),
	unlinkAccount: fn(ok).mockName("authClient.unlinkAccount"),
	deleteUser: fn(ok).mockName("authClient.deleteUser"),
	twoFactor: {
		enable: fn(
			async (): Promise<Result> => ({
				data: {
					totpURI: "otpauth://totp/Portfolio:sita%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Portfolio",
					backupCodes: SAMPLE_BACKUP_CODES,
				},
				error: null,
			}),
		).mockName("authClient.twoFactor.enable"),
		disable: fn(ok).mockName("authClient.twoFactor.disable"),
		generateBackupCodes: fn(
			async (): Promise<Result> => ({ data: { backupCodes: SAMPLE_BACKUP_CODES }, error: null }),
		).mockName("authClient.twoFactor.generateBackupCodes"),
		// "000000" is a wrong code, so stories can show the error path.
		verifyTotp: fn(
			async ({ code }: { code: string }): Promise<Result> =>
				code === "000000" ? { data: null, error: { code: "INVALID_CODE", status: 401 } } : { data: {}, error: null },
		).mockName("authClient.twoFactor.verifyTotp"),
		verifyBackupCode: fn(ok).mockName("authClient.twoFactor.verifyBackupCode"),
	},
};
