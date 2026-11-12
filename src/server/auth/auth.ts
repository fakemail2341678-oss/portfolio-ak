/**
 * Better Auth server instance (server-only).
 *
 * - Email + password with required verification, email OTP sign-in, password
 *   reset, change email, optional Google; admin plugin for roles.
 * - Two-factor authentication (TOTP + backup codes), breached-password checks,
 *   optional Turnstile captcha, and account deletion confirmed by email
 *   (decisions.md 0126–0129).
 * - Guest sessions for the showcase apps (the anonymous plugin, decisions 0185–0186).
 * - Every email goes through the Phase 6a email system in the user's language
 *   (see resolveEmailLocale).
 * - `tanstackStartCookies()` must stay the LAST plugin (official integration).
 */
import "@tanstack/react-start/server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { waitUntil } from "@vercel/functions";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { verifyJWT } from "better-auth/crypto";
import { admin, anonymous, captcha, emailOTP, haveIBeenPwned, twoFactor } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq } from "drizzle-orm";
import { clientEnv } from "@/lib/env/client";
import type { Locale } from "@/paraglide/runtime";
import { accountOwner, prepareAccountDeletion } from "../account/service";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { sendEmail } from "../email/send";
import type { SecurityNoticeKind } from "../email/templates/emails";
import { serverEnv } from "../env";
import { linkGuest, startGuest } from "../guests/auth-hooks";
import { forgetUser as forgetKharchaUser } from "../kharcha/forget"; // @kharcha
import { errorFields, log } from "../log";
import { acceptOnSignIn } from "../taskline/admin/invitations"; // @taskline
import { CLIENT_IP_HEADER } from "./client-ip";
import { DISABLED_ADMIN_PATHS, DISABLED_GUEST_PATHS } from "./disabled-paths";
import {
	hasTwoFactor,
	refuseEmailCodeWithTwoFactor,
	refuseGuestPaths,
	refuseOwnerOnlyWhileImpersonating,
} from "./hooks";
import { resolveEmailLocale } from "./locale";
import { BREACHED_PASSWORD_PATHS, CAPTCHA_PATHS, GUEST_SIGN_IN_PATH, GUEST_SIGN_INS_PER_HOUR } from "./policy";

/** Token and code lifetimes, shared with the email copy ("expires in N minutes"). */
export const AUTH_LIFETIMES = {
	verificationSeconds: 60 * 60,
	passwordResetSeconds: 30 * 60,
	otpSeconds: 5 * 60,
	deleteAccountSeconds: 60 * 60,
} as const;

const minutes = (seconds: number) => Math.round(seconds / 60);

/** Fire-and-forget email delivery that never blocks or fails the auth response. */
export const deliver = (task: Promise<unknown>) => {
	waitUntil(
		task.catch((error: unknown) => {
			log("error", "auth email delivery failed", errorFields(error));
		}),
	);
};

/**
 * When a change-email link is confirmed, Better Auth calls afterEmailVerification
 * with the already-updated user. The signed token in that request still names the
 * previous address, which is who must be told about the change. Better Auth has
 * already verified the token; we re-verify it with the same secret before trusting it.
 */
const readEmailChange = async (request: Request | undefined) => {
	const token = request ? new URL(request.url).searchParams.get("token") : null;
	if (!token) return null;
	const payload = await verifyJWT<{ email?: string; updateTo?: string }>(token, serverEnv.BETTER_AUTH_SECRET);
	return payload?.email && payload.updateTo ? { previousEmail: payload.email, newEmail: payload.updateTo } : null;
};

export const localizedUrl = (locale: Locale, path: string) =>
	new URL(locale === "en" ? path : `/${locale}${path}`, serverEnv.BETTER_AUTH_URL).toString();

const accountUrl = (locale: Locale) => localizedUrl(locale, "/account");

/** A security notice ("two-factor turned on", "Google linked"…) to the account's address. */
const notify = (user: { email: string; name: string }, kind: SecurityNoticeKind, request: Request | undefined) => {
	const locale = resolveEmailLocale(request);
	deliver(
		sendEmail({
			to: user.email,
			template: "security-notice",
			locale,
			data: { name: user.name, kind, url: accountUrl(locale) },
		}),
	);
};

const googleConfigured = Boolean(serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET);
const turnstile =
	serverEnv.TURNSTILE_SITE_KEY && serverEnv.TURNSTILE_SECRET_KEY
		? { siteKey: serverEnv.TURNSTILE_SITE_KEY, secretKey: serverEnv.TURNSTILE_SECRET_KEY }
		: null;

export const auth = betterAuth({
	appName: clientEnv.VITE_APP_TITLE,
	baseURL: serverEnv.BETTER_AUTH_URL,
	secret: serverEnv.BETTER_AUTH_SECRET,
	trustedOrigins: [serverEnv.BETTER_AUTH_URL],
	database: drizzleAdapter(db, { provider: "pg", schema }),
	disabledPaths: [...DISABLED_ADMIN_PATHS, ...DISABLED_GUEST_PATHS],

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		resetPasswordTokenExpiresIn: AUTH_LIFETIMES.passwordResetSeconds,
		revokeSessionsOnPasswordReset: true,
		// Only the address's owner could open the reset link, so it's now verified. This is
		// also how an invitation is accepted (src/server/auth/invite.ts, decisions.md 0133).
		onPasswordReset: async ({ user }) => {
			if (!user.emailVerified) {
				await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, user.id));
			}
		},
		sendResetPassword: async ({ user, url }, request) => {
			deliver(
				sendEmail({
					to: user.email,
					template: "password-reset",
					locale: resolveEmailLocale(request),
					data: { name: user.name, url, expiresInMinutes: minutes(AUTH_LIFETIMES.passwordResetSeconds) },
				}),
			);
		},
	},

	emailVerification: {
		sendOnSignUp: true,
		// Unverified users who try to log in get a fresh link.
		sendOnSignIn: true,
		autoSignInAfterVerification: true,
		expiresIn: AUTH_LIFETIMES.verificationSeconds,
		sendVerificationEmail: async ({ user, url }, request) => {
			deliver(
				sendEmail({
					to: user.email,
					template: "verify-email",
					locale: resolveEmailLocale(request),
					data: { name: user.name, url, expiresInMinutes: minutes(AUTH_LIFETIMES.verificationSeconds) },
				}),
			);
		},
		afterEmailVerification: async (user, request) => {
			const locale = resolveEmailLocale(request);
			const change = await readEmailChange(request);
			if (change) {
				// Security notice to the address that no longer controls the account.
				deliver(
					sendEmail({
						to: change.previousEmail,
						template: "email-changed",
						locale,
						data: { name: user.name, newEmail: change.newEmail, url: accountUrl(locale) },
					}),
				);
				return;
			}
			deliver(
				sendEmail({ to: user.email, template: "welcome", locale, data: { name: user.name, url: accountUrl(locale) } }),
			);
		},
	},

	user: {
		// Verified users confirm the new address by email before it takes effect.
		changeEmail: { enabled: true },
		// Deleting an account always takes the emailed link (0129). The link opens
		// /account/delete, which asks once more and sends the token back.
		deleteUser: {
			enabled: true,
			deleteTokenExpiresIn: AUTH_LIFETIMES.deleteAccountSeconds,
			sendDeleteAccountVerification: async ({ user, token }, request) => {
				const locale = resolveEmailLocale(request);
				deliver(
					sendEmail({
						to: user.email,
						template: "delete-account",
						locale,
						data: {
							name: user.name,
							url: `${localizedUrl(locale, "/account/delete")}?token=${encodeURIComponent(token)}`,
							expiresInMinutes: minutes(AUTH_LIFETIMES.deleteAccountSeconds),
						},
					}),
				);
			},
			beforeDelete: async (user) => {
				const check = await prepareAccountDeletion(db, user.id);
				if (!check.ok) {
					throw new APIError("BAD_REQUEST", { code: check.reason, message: "The last active admin can't be deleted" });
				}
				// kharcha:start
				// What is theirs alone in Kharcha goes; what they share stays, without the account (0277).
				await forgetKharchaUser(db, user.id);
				// kharcha:end
				log("info", "account deletion", { userId: user.id, queuedAttachments: check.queuedAttachments });
			},
			afterDelete: async (user, request) => {
				deliver(
					sendEmail({
						to: user.email,
						template: "account-deleted",
						locale: resolveEmailLocale(request),
						data: { name: user.name },
					}),
				);
			},
		},
	},

	account: {
		// A signed-in user can link Google when its verified address matches theirs; the
		// last way in can't be unlinked (Better Auth refuses FAILED_TO_UNLINK_LAST_ACCOUNT).
		accountLinking: { enabled: true, allowDifferentEmails: false, allowUnlinkingAll: false },
	},

	databaseHooks: {
		// taskline:start
		session: {
			create: {
				// A verified account's first session joins the Taskline team it was invited to (0212).
				after: async (session) => {
					await acceptOnSignIn(db, session);
				},
			},
		},
		// taskline:end
		user: {
			update: {
				// Two-factor turned on (the setup code was confirmed) or off.
				after: async (user, ctx) => {
					if (ctx?.path === "/two-factor/verify-totp" && hasTwoFactor(user)) {
						notify(user, "two-factor-enabled", ctx.request);
					}
					if (ctx?.path === "/two-factor/disable" && !hasTwoFactor(user)) {
						notify(user, "two-factor-disabled", ctx.request);
					}
				},
			},
		},
		account: {
			create: {
				// A second way in was added (a password, or Google linked to an existing account).
				after: async (account, ctx) => {
					const owner = await accountOwner(db, account.userId);
					if (!owner || owner.accounts < 2) return;
					notify(owner, account.providerId === "credential" ? "password-set" : "google-linked", ctx?.request);
				},
			},
		},
	},

	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			await refuseOwnerOnlyWhileImpersonating(ctx);
			await refuseGuestPaths(ctx);
		}),
		after: createAuthMiddleware(async (ctx) => {
			await refuseEmailCodeWithTwoFactor(ctx);
			await startGuest(ctx);
			if (ctx.path === "/unlink-account" && !isAPIError(ctx.context.returned) && ctx.context.session) {
				notify(ctx.context.session.user, "google-unlinked", ctx.request);
			}
		}),
	},

	...(googleConfigured
		? {
				socialProviders: {
					google: {
						clientId: serverEnv.GOOGLE_CLIENT_ID ?? "",
						clientSecret: serverEnv.GOOGLE_CLIENT_SECRET ?? "",
					},
				},
			}
		: {}),

	rateLimit: {
		// Better Auth disables rate limiting in development by default; keep it on so it's testable.
		enabled: true,
		// Database storage works across serverless instances (memory would be per instance).
		storage: "database",
		window: 60,
		max: 100,
		customRules: {
			"/sign-in/email": { window: 60, max: 5 },
			"/sign-up/email": { window: 60, max: 5 },
			"/email-otp/send-verification-otp": { window: 60, max: 3 },
			"/sign-in/email-otp": { window: 60, max: 5 },
			"/request-password-reset": { window: 60, max: 3 },
			"/send-verification-email": { window: 60, max: 3 },
			"/change-email": { window: 60, max: 3 },
			"/change-password": { window: 60, max: 5 },
			// Setup, sign-in codes, backup codes and turning it off. Failed codes also lock
			// the account for 15 minutes after 10 tries (the plugin's accountLockout).
			"/two-factor/*": { window: 60, max: 10 },
			"/delete-user": { window: 60, max: 3 },
			"/delete-user/callback": { window: 60, max: 5 },
			"/link-social": { window: 60, max: 5 },
			// Guest sessions: each one is a user row, so a limit per address (decisions 0185, 0201).
			// `?.`: Better Auth's CLI (pnpm auth:schema, db:seed-admin) loads this file outside Vite.
			[GUEST_SIGN_IN_PATH]: { window: 60 * 60, max: import.meta.env?.DEV ? 10_000 : GUEST_SIGN_INS_PER_HOUR },
			"/unlink-account": { window: 60, max: 5 },
		},
	},

	advanced: {
		// Rate limits key on this header only; the /api/auth route sets it from a trusted source
		// (src/server/auth/client-ip.ts), so clients can't spoof or share buckets.
		ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
		// Emails are sent in the background (no timing side channel); waitUntil keeps
		// serverless functions alive until delivery finishes.
		backgroundTasks: { handler: waitUntil },
	},

	plugins: [
		admin({ defaultRole: "user", adminRoles: ["admin"] }),
		emailOTP({
			otpLength: 6,
			expiresIn: AUTH_LIFETIMES.otpSeconds,
			allowedAttempts: 3,
			// OTP signs existing users in; new accounts go through sign-up + verification.
			disableSignUp: true,
			sendVerificationOTP: async ({ email, otp }, ctx) => {
				deliver(
					sendEmail({
						to: email,
						template: "otp-code",
						locale: resolveEmailLocale(ctx?.request),
						data: { code: otp, expiresInMinutes: minutes(AUTH_LIFETIMES.otpSeconds) },
					}),
				);
			},
		}),
		twoFactor({
			issuer: clientEnv.VITE_APP_TITLE,
			// Users without a password (Google only) can still turn it on; it applies once they set one.
			allowPasswordless: true,
		}),
		haveIBeenPwned({ enabled: serverEnv.AUTH_BREACHED_PASSWORD_CHECK, paths: [...BREACHED_PASSWORD_PATHS] }),
		// Guest sessions (decisions 0185, 0186). After twoFactor: a password sign-in that stops for the
		// second factor has dropped the session by the time this plugin's hook looks, so nothing is
		// claimed before the code is checked. The guest is deleted by the claim (in its transaction),
		// not by the plugin.
		anonymous({
			generateName: () => "Guest",
			disableDeleteAnonymousUser: true,
			onLinkAccount: linkGuest,
		}),
		...(turnstile
			? [captcha({ provider: "cloudflare-turnstile", secretKey: turnstile.secretKey, endpoints: [...CAPTCHA_PATHS] })]
			: []),
		// Must be last: lets Better Auth set cookies from TanStack Start server functions.
		tanstackStartCookies(),
	],
});

export const authFeatures = {
	google: googleConfigured,
	/** Turnstile's public site key, or null when there's no captcha. */
	turnstileSiteKey: turnstile?.siteKey ?? null,
} as const;
