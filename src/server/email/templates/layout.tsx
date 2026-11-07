import type { CSSProperties, ReactNode } from "react";
import { Body, Button, Container, Font, Head, Hr, Html, Link, Preview, Section, Text } from "react-email";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";

export type EmailBaseProps = {
	locale: Locale;
	/** Brand name shown in the header and footer (VITE_APP_TITLE). */
	siteName: string;
};

/**
 * Email clients rarely load web fonts, so the stack lists the Devanagari fonts
 * that ship with Windows (Nirmala UI), macOS/iOS (Kohinoor Devanagari),
 * Android (Noto Sans Devanagari) and older Windows (Mangal). Clients that do
 * support web fonts (Apple Mail, iOS) get Noto Sans Devanagari.
 */
const DEVANAGARI_STACK = '"Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", Mangal, Arial, sans-serif';
const LATIN_STACK = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const colors = { text: "#18181b", muted: "#52525b", border: "#e4e4e7", background: "#f4f4f5", brand: "#18181b" };

export const styles = {
	heading: { fontSize: "22px", lineHeight: "30px", fontWeight: 600, margin: "0 0 16px", color: colors.text },
	text: { fontSize: "16px", lineHeight: "26px", margin: "0 0 16px", color: colors.text },
	muted: { fontSize: "14px", lineHeight: "22px", margin: "0 0 12px", color: colors.muted },
	button: {
		backgroundColor: colors.brand,
		color: "#ffffff",
		borderRadius: "8px",
		padding: "12px 20px",
		fontSize: "16px",
		fontWeight: 600,
		textDecoration: "none",
		display: "inline-block",
	},
	code: {
		fontSize: "32px",
		lineHeight: "40px",
		fontWeight: 700,
		letterSpacing: "8px",
		fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
		textAlign: "center",
		backgroundColor: colors.background,
		borderRadius: "8px",
		padding: "16px",
		margin: "8px 0 24px",
		color: colors.text,
	},
	link: { color: colors.text, textDecoration: "underline", wordBreak: "break-all" },
} satisfies Record<string, CSSProperties>;

export function EmailLayout({
	locale,
	siteName,
	preview,
	children,
}: EmailBaseProps & { preview: string; children: ReactNode }) {
	const fontFamily = locale === "ne" ? DEVANAGARI_STACK : LATIN_STACK;
	return (
		<Html lang={locale} dir="ltr">
			<Head>
				{locale === "ne" ? (
					<Font
						fontFamily="Noto Sans Devanagari"
						fallbackFontFamily={["Arial", "sans-serif"]}
						webFont={{
							url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-devanagari@latest/devanagari-400-normal.woff2",
							format: "woff2",
						}}
						fontWeight={400}
						fontStyle="normal"
					/>
				) : null}
			</Head>
			<Preview>{preview}</Preview>
			<Body style={{ backgroundColor: colors.background, fontFamily, margin: 0, padding: "24px 0" }}>
				<Container
					style={{
						backgroundColor: "#ffffff",
						border: `1px solid ${colors.border}`,
						borderRadius: "12px",
						maxWidth: "560px",
						padding: "32px",
					}}
				>
					<Text style={{ ...styles.muted, fontWeight: 600, color: colors.text, margin: "0 0 24px" }}>{siteName}</Text>
					{children}
					<Hr style={{ borderColor: colors.border, margin: "24px 0 16px" }} />
					<Text style={styles.muted}>{m.email_footer_ignore({}, { locale })}</Text>
					<Text style={{ ...styles.muted, margin: 0 }}>{m.email_footer_sent_by({ site: siteName }, { locale })}</Text>
				</Container>
			</Body>
		</Html>
	);
}

export function Greeting({ locale, name }: { locale: Locale; name?: string | undefined }) {
	return (
		<Text style={styles.text}>
			{name ? m.email_greeting({ name }, { locale }) : m.email_greeting_anonymous({}, { locale })}
		</Text>
	);
}

/** A call-to-action button plus the raw URL for clients that block buttons. */
export function ActionButton({ locale, href, label }: { locale: Locale; href: string; label: string }) {
	return (
		<Section style={{ margin: "8px 0 24px" }}>
			<Button href={href} style={styles.button}>
				{label}
			</Button>
			<Text style={{ ...styles.muted, margin: "16px 0 4px" }}>{m.email_button_fallback({}, { locale })}</Text>
			<Link href={href} style={styles.link}>
				{href}
			</Link>
		</Section>
	);
}
