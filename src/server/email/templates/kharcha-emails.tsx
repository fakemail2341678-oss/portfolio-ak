import { Heading, Link, Section, Text } from "react-email";
import { formatMoney } from "@/lib/i18n/currency";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { ActionButton, type EmailBaseProps, EmailLayout, Greeting, styles } from "./layout";

/** Kharcha's emails (decisions 0284 to 0286), a file of the layer's so strip-demo takes them with it. */

/**
 * The footer of an email to someone without an account (Task 92): the one link that stops
 * every email from Kharcha (the same as the `List-Unsubscribe` header).
 */
function Unsubscribe({
	locale,
	siteName,
	url,
}: {
	locale: EmailBaseProps["locale"];
	siteName: string;
	url?: string | undefined;
}) {
	if (!url) return null;
	return (
		<Text style={styles.muted}>
			{m.email_kharcha_unsubscribe_note({ site: siteName }, { locale })}{" "}
			<Link href={url} style={styles.link}>
				{m.email_kharcha_unsubscribe({}, { locale })}
			</Link>
		</Text>
	);
}

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
	unsubscribeUrl?: string | undefined;
};

export function KharchaInvite({
	locale,
	siteName,
	inviter,
	group,
	url,
	expiresInDays,
	unsubscribeUrl,
}: KharchaInviteProps) {
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
			<Unsubscribe locale={locale} siteName={siteName} url={unsubscribeUrl} />
		</EmailLayout>
	);
}

/**
 * Kharcha (Task 91): a friend reminds the recipient of what they owe, per currency, with how
 * they asked to be paid. In the recipient's language when they have an account, else the
 * sender's. No money moves through Kharcha: settling up is recorded there after paying.
 */
export type KharchaReminderProps = EmailBaseProps & {
	sender: string;
	amounts: Array<{ currency: string; amountMinor: number }>;
	payNote?: string | undefined;
	url: string;
	unsubscribeUrl?: string | undefined;
};

export function KharchaReminder({
	locale,
	siteName,
	sender,
	amounts,
	payNote,
	url,
	unsubscribeUrl,
}: KharchaReminderProps) {
	const owed = amounts.map((amount) => formatMoney(amount.amountMinor, amount.currency, locale)).join(", ");
	return (
		<EmailLayout
			locale={locale}
			siteName={siteName}
			preview={m.email_kharcha_reminder_preview({ sender, amount: owed }, { locale })}
		>
			<Heading as="h1" style={styles.heading}>
				{m.email_kharcha_reminder_heading({ sender }, { locale })}
			</Heading>
			<Text style={styles.text}>{m.email_kharcha_reminder_body({ sender, amount: owed }, { locale })}</Text>
			{payNote ? (
				<Text style={styles.text}>{m.email_kharcha_reminder_pay_note({ sender, note: payNote }, { locale })}</Text>
			) : null}
			<ActionButton locale={locale} href={url} label={m.email_kharcha_reminder_button({}, { locale })} />
			<Text style={styles.muted}>{m.email_kharcha_reminder_footer({ site: siteName }, { locale })}</Text>
			<Unsubscribe locale={locale} siteName={siteName} url={unsubscribeUrl} />
		</EmailLayout>
	);
}

/**
 * Kharcha (Task 92): what one change told the recipient, at once (an expense, a payment, a
 * mention…), with the start of a comment when there is one. In their language.
 */
export type KharchaNotificationProps = EmailBaseProps & {
	heading: string;
	items: string[];
	excerpt?: string | undefined;
	url: string;
	settingsUrl: string;
};

export function KharchaNotification({
	locale,
	siteName,
	heading,
	items,
	excerpt,
	url,
	settingsUrl,
}: KharchaNotificationProps) {
	return (
		<EmailLayout locale={locale} siteName={siteName} preview={items[0] ?? heading}>
			<Heading as="h1" style={styles.heading}>
				{heading}
			</Heading>
			{items.map((item) => (
				<Text key={item} style={styles.text}>
					{item}
				</Text>
			))}
			{excerpt ? (
				<Text style={{ ...styles.muted, borderLeft: "3px solid #e0a526", paddingLeft: "12px" }}>{excerpt}</Text>
			) : null}
			<ActionButton locale={locale} href={url} label={m.email_kharcha_open({}, { locale })} />
			<Text style={styles.muted}>
				<Link href={settingsUrl} style={styles.link}>
					{m.email_kharcha_settings({}, { locale })}
				</Link>
			</Text>
		</EmailLayout>
	);
}

/** Kharcha (Task 92): the day's notifications not emailed yet, from the daily job. */
export type KharchaDigestProps = EmailBaseProps & {
	name: string;
	items: Array<{ id: string; text: string; url: string }>;
	more: number;
	url: string;
	settingsUrl: string;
};

/** The digest's subject: how many updates. */
export const digestSubject = ({ locale, siteName, items, more }: KharchaDigestProps): string =>
	m.email_kharcha_digest_subject({ count: formatNumber(items.length + more, {}, locale), site: siteName }, { locale });

export function KharchaDigest({ locale, siteName, name, items, more, url, settingsUrl }: KharchaDigestProps) {
	const count = formatNumber(items.length + more, {}, locale);
	return (
		<EmailLayout locale={locale} siteName={siteName} preview={m.email_kharcha_digest_preview({ count }, { locale })}>
			<Heading as="h1" style={styles.heading}>
				{m.email_kharcha_digest_heading({}, { locale })}
			</Heading>
			<Greeting locale={locale} name={name} />
			<Text style={styles.text}>{m.email_kharcha_digest_body({ count }, { locale })}</Text>
			<Section style={{ margin: "0 0 16px" }}>
				{items.map((item) => (
					<Text key={item.id} style={{ ...styles.text, margin: "0 0 12px" }}>
						<Link href={item.url} style={styles.link}>
							{item.text}
						</Link>
					</Text>
				))}
			</Section>
			{more > 0 ? (
				<Text style={styles.muted}>
					{m.email_kharcha_digest_more({ count: formatNumber(more, {}, locale) }, { locale })}
				</Text>
			) : null}
			<ActionButton locale={locale} href={url} label={m.email_kharcha_open_home({}, { locale })} />
			<Text style={styles.muted}>
				<Link href={settingsUrl} style={styles.link}>
					{m.email_kharcha_settings({}, { locale })}
				</Link>
			</Text>
		</EmailLayout>
	);
}
