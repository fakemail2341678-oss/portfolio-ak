import { createElement } from "react";
import { render, toPlainText } from "react-email";
import type { Locale } from "@/paraglide/runtime";
import {
	type EmailPropsMap,
	type EmailTemplate,
	type EmailTemplateData,
	type EmailTemplateId,
	emailTemplates,
} from "./templates";
import type { EmailBaseProps } from "./templates/layout";

export type RenderedEmail = { subject: string; html: string; text: string };

const renderTemplate = async <P extends EmailBaseProps>(
	template: EmailTemplate<P>,
	props: P,
): Promise<RenderedEmail> => {
	const html = await render(createElement(template.component, props));
	return { subject: template.subject(props), html, text: toPlainText(html) };
};

/**
 * Renders a template in an explicit locale. Emails go to a recipient whose
 * language may differ from the current request's, so the locale is always
 * passed in rather than read from getLocale().
 */
export const renderEmail = <K extends EmailTemplateId>(
	id: K,
	data: EmailTemplateData<K>,
	context: { locale: Locale; siteName: string },
): Promise<RenderedEmail> => {
	const template: EmailTemplate<EmailPropsMap[K]> = emailTemplates[id];
	// Spread order: shared context can't be overridden by template data. TypeScript can't prove
	// Omit<P, base> & base === P for a generic K, hence the one assertion; callers stay fully typed.
	const props = { ...data, ...context } as EmailPropsMap[K];
	return renderTemplate(template, props);
};
