import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { Honeypot, useTurnstile } from "@/features/auth/components/bot-check";
import { submitContactMessage } from "@/functions/portfolio-public";
import { FORM_ERROR_KEY, isAppError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { cn } from "../../lib/cn";
import { CONTACT_MESSAGE_MAX } from "../../schema";

const FIELDS = ["name", "email", "message"] as const;
type Field = (typeof FIELDS)[number];

const control =
	"hm-focus w-full border-transparent border-b-2 bg-hm-ground-2 px-4 py-3 text-hm-body transition-colors " +
	"hover:border-hm-muted focus-visible:border-hm-ink aria-invalid:border-hm-accent";

const text = (form: FormData, name: string) => {
	const value = form.get(name);
	return typeof value === "string" ? value : "";
};

/**
 * The contact form (decision 0176): a honeypot, Turnstile when the server has a
 * site key, and the server's rate limit. The server validates; its field errors
 * show under their fields. The message lands in the admin inbox and is emailed
 * to the owner. `method="post"`: a submit before hydration never puts the
 * message in the URL.
 */
export function ContactForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
	const id = useId();
	const captcha = useTurnstile(turnstileSiteKey);
	const [formError, setFormError] = useState<string>();
	const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
	const send = useMutation({
		mutationFn: (data: Parameters<typeof submitContactMessage>[0]["data"]) => submitContactMessage({ data }),
		onSettled: () => captcha.reset(),
		onError: (error) => {
			const fields = isAppError(error) ? (error.fieldErrors ?? {}) : {};
			setFieldErrors(
				Object.fromEntries(FIELDS.flatMap((field) => (fields[field]?.[0] ? [[field, fields[field][0]]] : []))),
			);
			const onFields = FIELDS.some((field) => fields[field]?.length);
			setFormError(onFields && !fields[FORM_ERROR_KEY] ? undefined : errorMessage(error));
		},
	});

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setFormError(undefined);
		setFieldErrors({});
		if (!captcha.ready) return setFormError(m.auth_error_captcha());
		const form = new FormData(event.currentTarget);
		send.mutate({
			name: text(form, "name"),
			email: text(form, "email"),
			message: text(form, "message"),
			website: text(form, "website"),
			captcha: captcha.token,
			locale: getLocale(),
		});
	};

	if (send.isSuccess) {
		return <output className="block bg-hm-ground-2 px-5 py-4 text-hm-lead">{m.portfolio_contact_form_sent()}</output>;
	}

	const field = (
		name: Field,
		label: string,
		input: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode,
	) => {
		const error = fieldErrors[name];
		const errorId = `${id}-${name}-error`;
		return (
			<div className="flex flex-col gap-2">
				<label htmlFor={`${id}-${name}`} className="font-semibold">
					{label}
				</label>
				{input({
					id: `${id}-${name}`,
					...(error ? { "aria-invalid": true as const, "aria-describedby": errorId } : {}),
				})}
				{error ? (
					<p id={errorId} className="font-medium text-hm-accent text-hm-small">
						{error}
					</p>
				) : null}
			</div>
		);
	};

	return (
		<form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-6" aria-labelledby={`${id}-title`}>
			<h2 id={`${id}-title`} className="hm-display text-hm-lead">
				{m.portfolio_contact_form_heading()}
			</h2>
			{formError ? (
				<p role="alert" className="bg-hm-ground-2 px-4 py-3 font-medium text-hm-accent text-hm-body">
					{formError}
				</p>
			) : null}
			{field("name", m.portfolio_contact_form_name(), (props) => (
				<input {...props} name="name" autoComplete="name" maxLength={80} className={control} />
			))}
			{field("email", m.portfolio_contact_form_email(), (props) => (
				<input {...props} name="email" type="email" autoComplete="email" maxLength={254} className={control} />
			))}
			{field("message", m.portfolio_contact_form_message(), (props) => (
				<textarea
					{...props}
					name="message"
					rows={6}
					maxLength={CONTACT_MESSAGE_MAX}
					className={cn(control, "resize-y")}
				/>
			))}
			<Honeypot />
			{captcha.element}
			<button type="submit" disabled={send.isPending} className="hm-button self-start disabled:opacity-70">
				{send.isPending ? m.portfolio_contact_form_sending() : m.portfolio_contact_form_send()}
			</button>
		</form>
	);
}
