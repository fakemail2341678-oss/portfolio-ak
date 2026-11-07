import { Heading, Link, Section, Text } from "react-email";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { ActionButton, type EmailBaseProps, EmailLayout, Greeting, styles } from "./layout";

/** Parda's emails (decision 0241), a file of the layer's so strip-demo takes them with it. */

/** Parda: the new episodes of series the account's profiles follow, from the daily job. */
export type EpisodeDigestProps = EmailBaseProps & {
	name: string;
	items: { id: string; title: string; episodes: string; url: string }[];
	more: number;
	url: string;
	settingsUrl: string;
};

export function EpisodeDigest({ locale, siteName, name, items, more, url, settingsUrl }: EpisodeDigestProps) {
	const count = formatNumber(items.length + more, {}, locale);
	return (
		<EmailLayout locale={locale} siteName={siteName} preview={m.email_parda_digest_preview({ count }, { locale })}>
			<Heading as="h1" style={styles.heading}>
				{m.email_parda_digest_heading({}, { locale })}
			</Heading>
			<Greeting locale={locale} name={name} />
			<Text style={styles.text}>{m.email_parda_digest_body({ count }, { locale })}</Text>
			<Section style={{ margin: "0 0 16px" }}>
				{items.map((item) => (
					<Text key={item.id} style={{ ...styles.text, margin: "0 0 12px" }}>
						<Link href={item.url} style={styles.link}>
							{item.title}
						</Link>
						<span style={{ color: "#52525b" }}>{` · ${item.episodes}`}</span>
					</Text>
				))}
			</Section>
			{more > 0 ? (
				<Text style={styles.muted}>
					{m.email_parda_digest_more({ count: formatNumber(more, {}, locale) }, { locale })}
				</Text>
			) : null}
			<ActionButton locale={locale} href={url} label={m.email_parda_digest_schedule({}, { locale })} />
			<Text style={styles.muted}>
				<Link href={settingsUrl} style={styles.link}>
					{m.email_parda_digest_settings({}, { locale })}
				</Link>
			</Text>
		</EmailLayout>
	);
}

export const episodeDigestSubject = ({ locale, siteName, items, more }: EpisodeDigestProps) =>
	m.email_parda_digest_subject({ count: formatNumber(items.length + more, {}, locale), site: siteName }, { locale });
