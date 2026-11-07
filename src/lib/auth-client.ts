import { adminClient, anonymousClient, emailOTPClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { getLocale } from "@/paraglide/runtime";
import { LOCALE_HEADER } from "./i18n/locale-header";

/**
 * Browser client for Better Auth (/api/auth/*). Every request carries the page
 * locale, so auth emails (verification, OTP, reset) arrive in the language the
 * user is using. See the /api/auth route strategy in project.inlang/paraglide.config.ts.
 */
export const authClient = createAuthClient({
	fetchOptions: {
		onRequest: (context) => {
			context.headers.set(LOCALE_HEADER, getLocale());
			return context;
		},
	},
	// twoFactorClient without a redirect: the login form shows the code step itself.
	// anonymousClient: guest sessions for the showcase apps (decision 0185).
	plugins: [adminClient(), emailOTPClient(), twoFactorClient(), anonymousClient()],
});
