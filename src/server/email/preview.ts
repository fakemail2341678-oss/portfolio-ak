/**
 * Dev-only helpers for the email preview at /dev/emails, which is served by a
 * Vite dev-server middleware (vite.config.ts). Nothing imports this module from
 * the app, so it never ends up in a production build.
 */
import { clientEnv } from "@/lib/env/client";
import { type Locale, locales } from "@/paraglide/runtime";
import { renderEmail } from "./render";
import { EMAIL_TEMPLATE_IDS, type EmailTemplateId, emailTemplates } from "./templates";

export const previewTemplates = (): ReadonlyArray<EmailTemplateId> => EMAIL_TEMPLATE_IDS;
export const previewLocales = (): ReadonlyArray<Locale> => locales;

export const isTemplateId = (value: string): value is EmailTemplateId =>
	(EMAIL_TEMPLATE_IDS as ReadonlyArray<string>).includes(value);

export const isLocale = (value: string): value is Locale => (locales as ReadonlyArray<string>).includes(value);

export const renderPreview = <K extends EmailTemplateId>(id: K, locale: Locale) =>
	renderEmail(id, emailTemplates[id].sample, { locale, siteName: clientEnv.VITE_APP_TITLE });
