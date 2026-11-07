import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { exampleSignupSchema } from "@/features/dev/examples/schema";
import { submitExampleSignup } from "@/functions/examples";
import { staticCrumb } from "@/lib/breadcrumbs";
import { privateHead } from "@/lib/seo";
import { email, optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";

/**
 * Forms: useAppForm + the field library, validated by one Zod schema built from
 * src/lib/validation.ts (localized messages).
 * - Simple: client validation only (on change, blur and submit), an error summary.
 * - Server field errors: the server validates the same schema plus its own rules;
 *   a refusal with `fieldErrors` lands on the matching field (handleSaveError)
 *   and clears when the field is edited (every useAppForm form does, clearServerErrorOnChange).
 */
export const Route = createFileRoute("/dev/examples/forms")({
	staticData: { breadcrumb: staticCrumb(m.examples_forms_title) },
	head: () => privateHead(m.examples_forms_title()),
	component: FormsExample,
});

const contactSchema = z.object({ name: required({ max: 80 }), email: email(), message: optionalText({ max: 500 }) });

function FormsExample() {
	return (
		<ExamplePage slug="forms">
			<Demo title={m.examples_forms_simple()} note={m.examples_forms_simple_note()}>
				<SimpleForm />
			</Demo>
			<Demo title={m.examples_forms_server()} note={m.examples_forms_server_note()}>
				<ServerErrorsForm />
			</Demo>
		</ExamplePage>
	);
}

function SimpleForm() {
	const form = useAppForm({
		defaultValues: { name: "", email: "", message: "" },
		validators: formValidators(contactSchema),
		onSubmit: ({ value, formApi }) => {
			toast.success(m.examples_forms_sent({ name: value.name }));
			formApi.reset();
		},
	});
	return (
		<form.AppForm>
			<form.Form className="flex max-w-md flex-col gap-4" data-testid="simple-form">
				<form.FormErrorSummary />
				<form.AppField name="name">{(field) => <field.TextField label={m.examples_forms_name()} />}</form.AppField>
				<form.AppField name="email">{(field) => <field.EmailField label={m.examples_forms_email()} />}</form.AppField>
				<form.AppField name="message">
					{(field) => <field.TextareaField label={m.examples_forms_message()} optional />}
				</form.AppField>
				<form.SubmitButton>{m.examples_forms_send()}</form.SubmitButton>
			</form.Form>
		</form.AppForm>
	);
}

function ServerErrorsForm() {
	const [created, setCreated] = useState<string | null>(null);
	const form = useAppForm({
		defaultValues: { username: "", email: "" },
		validators: formValidators(exampleSignupSchema),
		onSubmit: async ({ value, formApi }) => {
			try {
				const result = await submitExampleSignup({ data: value });
				setCreated(result.username);
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<form.Form className="flex max-w-md flex-col gap-4" data-testid="server-form">
				<form.FormErrorSummary />
				<form.AppField name="username">
					{(field) => (
						<field.TextField
							label={m.examples_forms_username()}
							description={m.examples_forms_username_hint()}
							autoComplete="off"
						/>
					)}
				</form.AppField>
				<form.AppField name="email">{(field) => <field.EmailField label={m.examples_forms_email()} />}</form.AppField>
				<form.SubmitButton>{m.examples_forms_sign_up()}</form.SubmitButton>
				<p className="min-h-5 text-sm" aria-live="polite" data-testid="server-form-result">
					{created ? m.examples_forms_signed_up({ username: created }) : null}
				</p>
			</form.Form>
		</form.AppForm>
	);
}
