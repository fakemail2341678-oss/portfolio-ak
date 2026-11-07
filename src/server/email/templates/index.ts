import type { ReactElement } from "react";
import { formatNumber } from "@/lib/i18n/intl"; // @taskline
import { m } from "@/paraglide/messages";
import {
	AccountDeleted,
	type AccountDeletedProps,
	ContactMessage, // @portfolio
	type ContactMessageProps, // @portfolio
	DeleteAccount,
	type DeleteAccountProps,
	EmailChanged,
	type EmailChangedProps,
	Invite,
	type InviteProps,
	OtpCode,
	type OtpCodeProps,
	PasswordReset,
	type PasswordResetProps,
	SecurityNotice,
	type SecurityNoticeProps,
	VerifyEmail,
	type VerifyEmailProps,
	Welcome,
	type WelcomeProps,
} from "./emails";
import type { EmailBaseProps } from "./layout";
import * as parda from "./parda-emails"; // @parda
import * as taskline from "./taskline-emails"; // @taskline

/** Full props per template (including locale and siteName). */
export interface EmailPropsMap {
	"verify-email": VerifyEmailProps;
	"otp-code": OtpCodeProps;
	"password-reset": PasswordResetProps;
	"email-changed": EmailChangedProps;
	welcome: WelcomeProps;
	invite: InviteProps;
	"delete-account": DeleteAccountProps;
	"account-deleted": AccountDeletedProps;
	"security-notice": SecurityNoticeProps;
	"contact-message": ContactMessageProps; // @portfolio
	"taskline-invite": taskline.TeamInviteProps; // @taskline
	"taskline-notification": taskline.TaskNotificationProps; // @taskline
	"taskline-digest": taskline.DailyDigestProps; // @taskline
	"parda-digest": parda.EpisodeDigestProps; // @parda
}

export type EmailTemplateId = keyof EmailPropsMap;

/** What callers pass: everything except the shared locale/siteName. */
export type EmailTemplateData<K extends EmailTemplateId> = Omit<EmailPropsMap[K], keyof EmailBaseProps>;

export type EmailTemplate<P extends EmailBaseProps> = {
	component: (props: P) => ReactElement;
	subject: (props: P) => string;
	/** Sample data for the dev preview and tests. */
	sample: Omit<P, keyof EmailBaseProps>;
};

// A mapped type keeps each template's props correlated with its id, so callers of
// renderEmail(id, data) / sendEmail() must pass exactly that template's data.
type EmailRegistry = { [K in EmailTemplateId]: EmailTemplate<EmailPropsMap[K]> };

export const emailTemplates: EmailRegistry = {
	"verify-email": {
		component: VerifyEmail,
		subject: ({ locale, siteName }) => m.email_verify_subject({ site: siteName }, { locale }),
		sample: { name: "Sita Sharma", url: "https://example.com/verify?token=sample", expiresInMinutes: 60 },
	},
	"otp-code": {
		component: OtpCode,
		subject: ({ locale, siteName }) => m.email_otp_subject({ site: siteName }, { locale }),
		sample: { name: "Sita Sharma", code: "482913", expiresInMinutes: 5 },
	},
	"password-reset": {
		component: PasswordReset,
		subject: ({ locale, siteName }) => m.email_reset_subject({ site: siteName }, { locale }),
		sample: { name: "Sita Sharma", url: "https://example.com/reset?token=sample", expiresInMinutes: 30 },
	},
	"email-changed": {
		component: EmailChanged,
		subject: ({ locale, siteName }) => m.email_changed_subject({ site: siteName }, { locale }),
		sample: { name: "Sita Sharma", newEmail: "sita.new@example.com", url: "https://example.com/account" },
	},
	welcome: {
		component: Welcome,
		subject: ({ locale, siteName }) => m.email_welcome_subject({ site: siteName }, { locale }),
		sample: { name: "Sita Sharma", url: "https://example.com/account" },
	},
	invite: {
		component: Invite,
		subject: ({ locale, siteName }) => m.email_invite_subject({ site: siteName }, { locale }),
		sample: {
			name: "Sita Sharma",
			inviter: "Ram Thapa",
			url: "https://example.com/reset-password?token=sample&invite=1",
			expiresInDays: 3,
		},
	},
	"delete-account": {
		component: DeleteAccount,
		subject: ({ locale, siteName }) => m.email_delete_subject({ site: siteName }, { locale }),
		sample: { name: "Sita Sharma", url: "https://example.com/account/delete?token=sample", expiresInMinutes: 60 },
	},
	"account-deleted": {
		component: AccountDeleted,
		subject: ({ locale, siteName }) => m.email_deleted_subject({ site: siteName }, { locale }),
		sample: { name: "Sita Sharma" },
	},
	"security-notice": {
		component: SecurityNotice,
		subject: ({ locale, siteName }) => m.email_notice_subject({ site: siteName }, { locale }),
		sample: { name: "Sita Sharma", kind: "two-factor-enabled", url: "https://example.com/account" },
	},
	// portfolio:start
	"contact-message": {
		component: ContactMessage,
		subject: ({ locale, siteName, name }) => m.email_contact_subject({ name, site: siteName }, { locale }),
		sample: {
			name: "Sita Sharma",
			email: "sita@example.com",
			message: "Namaste! We are planning a bilingual booking site for our trekking agency.\n\nCould we talk next week?",
			url: "https://example.com/admin/portfolio/messages",
		},
	},
	// portfolio:end
	// taskline:start
	"taskline-invite": {
		component: taskline.TeamInvite,
		subject: ({ locale, siteName, team }) => m.email_team_invite_subject({ team, site: siteName }, { locale }),
		sample: {
			inviter: "Ram Thapa",
			team: "Himal Studio",
			project: "Website relaunch",
			url: "https://example.com/app/taskline/sign-up?redirect=%2Fapp%2Ftaskline%2Fteam%2Fp%2FWEB",
			expiresInDays: 7,
		},
	},
	"taskline-notification": {
		component: taskline.TaskNotification,
		subject: ({ locale, siteName, heading }) => m.email_taskline_task_subject({ heading, site: siteName }, { locale }),
		sample: {
			heading: "WEB-12 · Write the launch announcement",
			items: ["Asha Gurung assigned you WEB-12", "Asha Gurung mentioned you on WEB-12"],
			excerpt: "@Sita could you take this one? The draft is in the shared folder.",
			url: "https://example.com/app/taskline/team/t/WEB-12",
			settingsUrl: "https://example.com/app/taskline/settings",
		},
	},
	"taskline-digest": {
		component: taskline.DailyDigest,
		subject: ({ locale, siteName, items, more }) =>
			m.email_taskline_digest_subject(
				{ count: formatNumber(items.length + more, {}, locale), site: siteName },
				{ locale },
			),
		sample: {
			name: "Sita Sharma",
			items: [
				{
					id: "n1",
					text: "WEB-7 is due tomorrow",
					title: "Fix the header on phones",
					url: "https://example.com/app/taskline/team/t/WEB-7",
				},
				{
					id: "n2",
					text: "Bikash Rai commented on WEB-3",
					title: "Choose the fonts",
					url: "https://example.com/app/taskline/team/t/WEB-3",
				},
			],
			more: 0,
			url: "https://example.com/app/taskline/inbox",
			settingsUrl: "https://example.com/app/taskline/settings",
		},
	},
	// taskline:end
	// parda:start
	"parda-digest": {
		component: parda.EpisodeDigest,
		subject: parda.episodeDigestSubject,
		sample: {
			name: "Sita Sharma",
			items: [
				{
					id: "n1",
					title: "The Long Monsoon",
					episodes: "S2 · E5",
					url: "https://example.com/app/parda/watch/series/1-the-long-monsoon?s=2&e=5",
				},
				{
					id: "n2",
					title: "Paper Lanterns",
					episodes: "S1 · E1–8",
					url: "https://example.com/app/parda/watch/series/2-paper-lanterns?s=1&e=1",
				},
			],
			more: 0,
			url: "https://example.com/app/parda/schedule",
			settingsUrl: "https://example.com/app/parda/profiles",
		},
	},
	// parda:end
};

export const EMAIL_TEMPLATE_IDS = Object.keys(emailTemplates) as EmailTemplateId[];
