import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { AuthField, FormMessage } from "@/features/auth/components/auth-field";
import { Honeypot, useTurnstile } from "@/features/auth/components/bot-check";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { field } from "@/features/auth/validation";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { submitExampleContact } from "@/functions/examples";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * Recipe: a contact form (docs/guides/recipes.md). Bots meet a honeypot field
 * and, when TURNSTILE_* is set, a Turnstile challenge; everyone gets a
 * database-backed rate limit (3 per 10 minutes per IP, src/server/http/rate-limit.ts).
 * The server function validates with the shared schema; this example logs the
 * message instead of emailing it (src/server/examples/contact.ts).
 */
export const Route = createFileRoute("/dev/examples/contact")({
	loader: ({ context }) => ensureQuery(context.queryClient, authFeaturesQueryOptions()),
	staticData: { breadcrumb: staticCrumb(m.examples_contact_title) },
	head: () => privateHead(m.examples_contact_title()),
	component: ContactExample,
});

function ContactExample() {
	const { turnstileSiteKey } = Route.useLoaderData();
	const captcha = useTurnstile(turnstileSiteKey);
	const [formError, setFormError] = useState<string>();
	const send = useMutation({
		mutationFn: (data: Parameters<typeof submitExampleContact>[0]["data"]) => submitExampleContact({ data }),
		onSettled: () => captcha.reset(),
		onError: (error) => setFormError(errorMessage(error)),
	});

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setFormError(undefined);
		if (!captcha.ready) return setFormError(m.auth_error_captcha());
		const form = new FormData(event.currentTarget);
		send.mutate({
			name: field(form, "name"),
			email: field(form, "email"),
			message: field(form, "message"),
			website: field(form, "website"),
			captcha: captcha.token,
		});
	};

	return (
		<ExamplePage slug="contact">
			<Demo title={m.examples_contact_title()} note={m.examples_contact_note()}>
				<form method="post" noValidate onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
					{send.isSuccess ? <FormMessage tone="success">{m.examples_contact_sent()}</FormMessage> : null}
					{formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
					<AuthField name="name" autoComplete="name" label={m.auth_name_label()} />
					<AuthField name="email" type="email" autoComplete="email" label={m.auth_email_label()} />
					<label className="flex flex-col gap-2 font-medium text-sm">
						{m.examples_contact_message()}
						<textarea name="message" rows={4} maxLength={2000} className="rounded-md border bg-transparent p-2" />
					</label>
					<Honeypot />
					{captcha.element}
					<Button type="submit" className="self-start" disabled={send.isPending}>
						{send.isPending ? m.examples_working() : m.examples_contact_send()}
					</Button>
				</form>
			</Demo>
		</ExamplePage>
	);
}
