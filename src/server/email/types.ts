export type EmailMessage = {
	to: string;
	subject: string;
	html: string;
	text: string;
	/** Optional tag for provider dashboards, e.g. the template id. */
	tag?: string;
};

export type SendResult = { id: string };

/** Anything that can deliver an email. Implementations: ConsoleProvider, ResendProvider. */
export interface EmailProvider {
	readonly name: "console" | "resend";
	send(message: EmailMessage): Promise<SendResult>;
}
