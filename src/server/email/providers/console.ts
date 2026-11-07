import type { EmailMessage, EmailProvider, SendResult } from "../types";

/**
 * Development provider: prints the email to the server console instead of
 * sending it. The plain-text body is printed so links and codes (verification
 * URLs, OTPs) are easy to copy while testing auth flows.
 */
export class ConsoleProvider implements EmailProvider {
	readonly name = "console";

	constructor(
		private readonly from: string,
		private readonly write: (line: string) => void = (line) => console.info(line),
	) {}

	async send(message: EmailMessage): Promise<SendResult> {
		const id = `console-${crypto.randomUUID()}`;
		const rule = "─".repeat(60);
		this.write(
			[
				rule,
				`📧 Email (console provider, not sent) ${id}`,
				`From:    ${this.from}`,
				`To:      ${message.to}`,
				`Subject: ${message.subject}`,
				...(message.tag ? [`Tag:     ${message.tag}`] : []),
				rule,
				message.text,
				rule,
			].join("\n"),
		);
		return { id };
	}
}
