import "@tanstack/react-start/server-only";
import { serverEnv } from "../env";
import { ConsoleProvider } from "./providers/console";
import { ResendProvider } from "./providers/resend";
import type { EmailProvider } from "./types";

export type EmailProviderChoice = { kind: "console" } | { kind: "resend"; apiKey: string };

export type EmailProviderInput = {
	isProduction: boolean;
	EMAIL_PROVIDER?: "console" | "resend" | undefined;
	RESEND_API_KEY?: string | undefined;
};

export class EmailConfigError extends Error {
	override name = "EmailConfigError";
}

/**
 * Pure selection rules (unit-tested):
 * - EMAIL_PROVIDER=resend  -> Resend (the env schema already requires RESEND_API_KEY).
 * - EMAIL_PROVIDER=console -> console, except in production, where it's an error:
 *   emails would silently never arrive.
 * - Unset: Resend when RESEND_API_KEY is configured; otherwise console in
 *   development/test and an error in production.
 */
export const selectEmailProvider = (input: EmailProviderInput): EmailProviderChoice => {
	const { isProduction, EMAIL_PROVIDER, RESEND_API_KEY } = input;

	if (EMAIL_PROVIDER === "resend") {
		if (!RESEND_API_KEY) throw new EmailConfigError("EMAIL_PROVIDER is 'resend' but RESEND_API_KEY is not set.");
		return { kind: "resend", apiKey: RESEND_API_KEY };
	}

	if (EMAIL_PROVIDER === "console") {
		if (isProduction) {
			throw new EmailConfigError(
				"EMAIL_PROVIDER is 'console' in production, so no email would be delivered. Set EMAIL_PROVIDER=resend and RESEND_API_KEY.",
			);
		}
		return { kind: "console" };
	}

	if (RESEND_API_KEY) return { kind: "resend", apiKey: RESEND_API_KEY };
	if (!isProduction) return { kind: "console" };

	throw new EmailConfigError(
		"No email provider is configured for production. Set RESEND_API_KEY (and optionally EMAIL_PROVIDER=resend).",
	);
};

let cached: EmailProvider | undefined;

/**
 * The app's email provider, created once. `import.meta.env.PROD` is fixed at
 * build time, so a production build can never fall back to the console provider.
 */
export const getEmailProvider = (): EmailProvider => {
	if (cached) return cached;
	const choice = selectEmailProvider({
		isProduction: import.meta.env.PROD,
		EMAIL_PROVIDER: serverEnv.EMAIL_PROVIDER,
		RESEND_API_KEY: serverEnv.RESEND_API_KEY,
	});
	cached =
		choice.kind === "resend"
			? new ResendProvider(choice.apiKey, serverEnv.EMAIL_FROM)
			: new ConsoleProvider(serverEnv.EMAIL_FROM);
	return cached;
};
