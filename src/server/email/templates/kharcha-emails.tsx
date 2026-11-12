import { Heading, Text } from "react-email";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { ActionButton, type EmailBaseProps, EmailLayout, styles } from "./layout";

/** Kharcha's emails (decision 0284), a file of the layer's so strip-demo takes them with it. Task 92 adds the rest. */

/**
 * Kharcha (Task 90): a friend added this address and sent an invite. The link joins the
 * account that opens it, after a confirm; signing up with the address joins without it.
 * In the inviter's language: the recipient has no account to have one of their own.
 */
export type KharchaInviteProps = EmailBaseProps & {
	inviter: string;
	group?: string | undefined;
	url: string;
	expiresInDays: number;
};

export function KharchaInvite({ locale, siteName, inviter, group, url, expiresInDays }: KharchaInviteProps) {
	return (
		<EmailLayout locale={locale} siteName={siteName} preview={m.email_kharcha_invite_preview({ inviter }, { locale })}>
			<Heading as="h1" style={styles.heading}>
				{m.email_kharcha_invite_heading({ inviter }, { locale })}
			</Heading>
			<Text style={styles.text}>{m.email_kharcha_invite_body({ inviter, site: siteName }, { locale })}</Text>
			{group ? <Text style={styles.text}>{m.email_kharcha_invite_group({ group }, { locale })}</Text> : null}
			<ActionButton locale={locale} href={url} label={m.email_kharcha_invite_button({}, { locale })} />
			<Text style={styles.muted}>
				{m.email_kharcha_invite_expires({ days: formatNumber(expiresInDays, {}, locale) }, { locale })}
			</Text>
			<Text style={styles.muted}>{m.email_invite_ignore({}, { locale })}</Text>
		</EmailLayout>
	);
}
