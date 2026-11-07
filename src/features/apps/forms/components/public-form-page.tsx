import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { CircleCheckIcon, ClipboardListIcon } from "lucide-react";
import { useRef, useState } from "react";
import { BrandName } from "@/components/brand/brand";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme";
import { Page, PageHeader } from "@/components/page/page";
import { Honeypot, useTurnstile } from "@/features/auth/components/bot-check";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { submitFormResponse } from "@/functions/apps/forms-public";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { publicFormQueryOptions } from "../queries";
import type { PublicForm } from "../types";
import { FormRenderer } from "./form-renderer";

const route = getRouteApi("/f/$slug");

/**
 * /f/$slug (decision 0195): a published form for anyone with the link, with a frame
 * of its own (the brand, language and theme; the page is outside every section).
 * Server-rendered from the definition; never indexed. The submission carries the
 * honeypot and Turnstile's token; the server checks the answers again.
 */
export function PublicFormPage() {
	const { slug } = route.useParams();
	const { data: form } = useSuspenseQuery(publicFormQueryOptions(slug));
	return (
		<>
			<header className="border-b">
				<div className="mx-auto flex h-12 max-w-3xl items-center gap-1 px-4">
					<Link to="/" className="me-auto rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
						<BrandName />
					</Link>
					<LanguageSwitcher />
					<ThemeToggle />
				</div>
			</header>
			<Page width="narrow" data-testid="public-form">
				<PublicFormBody form={form} />
				<p className="flex flex-wrap items-center gap-x-2 border-t pt-6 text-muted-foreground text-sm">
					<ClipboardListIcon className="size-4" aria-hidden />
					{m.forms_public_footer()}
					<Link to="/apps/forms" className="font-medium text-foreground underline underline-offset-4">
						{m.forms_public_try()}
					</Link>
				</p>
			</Page>
		</>
	);
}

function PublicFormBody({ form }: { form: PublicForm }) {
	const { data: features } = useSuspenseQuery(authFeaturesQueryOptions());
	const captcha = useTurnstile(features.turnstileSiteKey);
	const bots = useRef<HTMLDivElement>(null);
	const [sent, setSent] = useState(false);

	if (sent) {
		return (
			<output
				className="flex flex-col items-start gap-3 rounded-lg border bg-success-subtle p-6"
				data-testid="form-sent"
			>
				<CircleCheckIcon className="size-6 text-success" aria-hidden />
				<span className="font-medium text-heading">{m.forms_public_sent_title()}</span>
				<span className="text-muted-foreground">{m.forms_public_sent_body()}</span>
			</output>
		);
	}

	return (
		<>
			<PageHeader title={form.title} description={form.description || undefined} />
			<FormRenderer
				fields={form.fields}
				onSubmit={async (answers) => {
					if (!captcha.ready) throw ruleError("BAD_REQUEST", "Captcha not solved", m.auth_error_captcha());
					const website = bots.current?.querySelector<HTMLInputElement>('input[name="website"]')?.value ?? "";
					try {
						await submitFormResponse({
							data: { slug: form.slug, answers, website, ...(captcha.token ? { captcha: captcha.token } : {}) },
						});
						setSent(true);
					} finally {
						captcha.reset();
					}
				}}
			>
				<div ref={bots}>
					<Honeypot />
					{captcha.element}
				</div>
			</FormRenderer>
		</>
	);
}
