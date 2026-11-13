import "@tanstack/react-start/server-only";
import { clientEnv } from "@/lib/env/client";
import type { Locale } from "@/paraglide/runtime";
import { getEmailProvider } from "./config";
import { renderEmail } from "./render";
import type { EmailTemplateData, EmailTemplateId } from "./templates";
import type { EmailProvider, SendResult } from "./types";

export type SendEmailOptions<K extends EmailTemplateId> = {
	to: string;
	template: K;
	data: EmailTemplateData<K>;
	/** The recipient's language (e.g. their saved preference), not necessarily the request's. */
	locale: Locale;
	/** The name the email is signed with: a product's own (Taskline's) instead of the app's. */
	siteName?: string;
	/** Extra headers, such as `List-Unsubscribe`. */
	headers?: Record<string, string>;
};

/**
 * Addresses that can't receive mail: the reserved `.invalid` top-level domain (RFC 2606),
 * which guests' placeholder addresses use ("…@anonymous.placeholder.invalid", decision 0185).
 */
export const isUndeliverable = (address: string) => address.trim().toLowerCase().endsWith(".invalid");

/**
 * Renders a localized template and delivers it through the configured provider.
 * Refuses an undeliverable address (a guest's) before rendering anything.
 */
export const sendEmail = async <K extends EmailTemplateId>(
	options: SendEmailOptions<K>,
	provider: EmailProvider = getEmailProvider(),
): Promise<SendResult> => {
	if (isUndeliverable(options.to)) throw new Error(`Refused to email an undeliverable address (${options.template})`);
	const email = await renderEmail(options.template, options.data, {
		locale: options.locale,
		siteName: options.siteName ?? clientEnv.VITE_APP_TITLE,
	});
	return provider.send({
		to: options.to,
		...email,
		tag: options.template,
		...(options.headers ? { headers: options.headers } : {}),
	});
};
