import { Heading, Link, Section, Text } from "react-email";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { ActionButton, type EmailBaseProps, EmailLayout, Greeting, styles } from "./layout";

/** Taskline's emails (decisions 0212, 0214), a file of the layer's so strip-demo takes them with it. */

type WithUrl = { url: string };

/** Taskline (decision 0212): an admin invited this address to the team; signing up or in with it joins. */
export type TeamInviteProps = EmailBaseProps &
	WithUrl & { inviter: string; team: string; project?: string | undefined; expiresInDays: number };

export function TeamInvite({ locale, siteName, inviter, team, project, url, expiresInDays }: TeamInviteProps) {
	return (
		<EmailLayout locale={locale} siteName={siteName} preview={m.email_team_invite_preview({ team }, { locale })}>
			<Heading as="h1" style={styles.heading}>
				{m.email_team_invite_heading({ team }, { locale })}
			</Heading>
			<Text style={styles.text}>{m.email_team_invite_body({ inviter, team, site: siteName }, { locale })}</Text>
			{project ? <Text style={styles.text}>{m.email_team_invite_project({ project }, { locale })}</Text> : null}
			<ActionButton locale={locale} href={url} label={m.email_team_invite_button({}, { locale })} />
			<Text style={styles.muted}>
				{m.email_team_invite_expires({ days: formatNumber(expiresInDays, {}, locale) }, { locale })}
			</Text>
			<Text style={styles.muted}>{m.email_invite_ignore({}, { locale })}</Text>
		</EmailLayout>
	);
}

/** Taskline (decision 0214): what one change told the recipient about one task, sent at once. */
export type TaskNotificationProps = EmailBaseProps &
	WithUrl & { heading: string; items: string[]; excerpt?: string | undefined; settingsUrl: string };

export function TaskNotification({
	locale,
	siteName,
	heading,
	items,
	excerpt,
	url,
	settingsUrl,
}: TaskNotificationProps) {
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
				<Text style={{ ...styles.muted, borderLeft: "3px solid #e4e4e7", paddingLeft: "12px" }}>{excerpt}</Text>
			) : null}
			<ActionButton locale={locale} href={url} label={m.email_taskline_open({}, { locale })} />
			<Text style={styles.muted}>
				<Link href={settingsUrl} style={styles.link}>
					{m.email_taskline_settings({}, { locale })}
				</Link>
			</Text>
		</EmailLayout>
	);
}

/** Taskline (decision 0214): the day's unread notifications, from the daily cron. */
export type DailyDigestProps = EmailBaseProps &
	WithUrl & {
		name: string;
		items: { id: string; text: string; title: string; url: string }[];
		more: number;
		settingsUrl: string;
	};

export function DailyDigest({ locale, siteName, name, items, more, url, settingsUrl }: DailyDigestProps) {
	const count = formatNumber(items.length + more, {}, locale);
	return (
		<EmailLayout locale={locale} siteName={siteName} preview={m.email_taskline_digest_preview({ count }, { locale })}>
			<Heading as="h1" style={styles.heading}>
				{m.email_taskline_digest_heading({}, { locale })}
			</Heading>
			<Greeting locale={locale} name={name} />
			<Text style={styles.text}>{m.email_taskline_digest_body({ count }, { locale })}</Text>
			<Section style={{ margin: "0 0 16px" }}>
				{items.map((item) => (
					<Text key={item.id} style={{ ...styles.text, margin: "0 0 12px" }}>
						<Link href={item.url} style={styles.link}>
							{item.text}
						</Link>
						{item.title ? <span style={{ color: "#52525b" }}>{` · ${item.title}`}</span> : null}
					</Text>
				))}
			</Section>
			{more > 0 ? (
				<Text style={styles.muted}>
					{m.email_taskline_digest_more({ count: formatNumber(more, {}, locale) }, { locale })}
				</Text>
			) : null}
			<ActionButton locale={locale} href={url} label={m.email_taskline_inbox({}, { locale })} />
			<Text style={styles.muted}>
				<Link href={settingsUrl} style={styles.link}>
					{m.email_taskline_settings({}, { locale })}
				</Link>
			</Text>
		</EmailLayout>
	);
}
