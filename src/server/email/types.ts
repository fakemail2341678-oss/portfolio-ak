export type EmailMessage = {
	to: string;
	subject: string;
	html: string;
	text: string;
	/** Optional tag for provider dashboards, e.g. the template id. */
	tag?: string;
	/** Extra headers, such as `List-Unsubscribe` (Kharcha's emails to people without an account). */
	headers?: Record<string, string>;
};

export type SendResult = { id: string };

/** Anything that can deliver an email. Implementations: ConsoleProvider, ResendProvider. */
export interface EmailProvider {
	readonly name: "console" | "resend";
	send(message: EmailMessage): Promise<SendResult>;
}
