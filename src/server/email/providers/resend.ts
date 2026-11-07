import { Resend } from "resend";
import type { EmailMessage, EmailProvider, SendResult } from "../types";

/** The slice of the Resend SDK we use; injectable for tests. */
export type ResendClient = Pick<Resend, "emails">;

export class ResendDeliveryError extends Error {
	override name = "ResendDeliveryError";
}

/** Production provider backed by Resend (https://resend.com). */
export class ResendProvider implements EmailProvider {
	readonly name = "resend";
	private readonly client: ResendClient;

	constructor(
		apiKey: string,
		private readonly from: string,
		client?: ResendClient,
	) {
		this.client = client ?? new Resend(apiKey);
	}

	async send(message: EmailMessage): Promise<SendResult> {
		// The SDK returns errors as values instead of throwing.
		const { data, error } = await this.client.emails.send({
			from: this.from,
			to: message.to,
			subject: message.subject,
			html: message.html,
			text: message.text,
			...(message.tag ? { tags: [{ name: "template", value: message.tag }] } : {}),
		});
		if (error || !data) {
			throw new ResendDeliveryError(`Resend rejected the email: ${error?.name ?? "unknown"}: ${error?.message ?? ""}`);
		}
		return { id: data.id };
	}
}
