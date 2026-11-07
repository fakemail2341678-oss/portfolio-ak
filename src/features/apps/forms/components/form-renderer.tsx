import type { ReactNode } from "react";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { m } from "@/paraglide/messages";
import { type AnswerDraft, emptyAnswers, type FormField, toZodSchema } from "../fields";
import { RatingField } from "./rating-field";

/**
 * A form drawn from its definition (decision 0195) with TanStack Form: the public
 * page (/f/$slug) and the builder's preview render the same thing. The answers are
 * checked by `toZodSchema(fields)`, the schema the server checks again; the server's
 * problems come back per field id and show under their questions.
 *
 * `children` sits above the submit button (the honeypot and Turnstile on the public
 * page). Give it a `key` that changes with the fields: the form's values are made
 * from them once.
 */
export function FormRenderer({
	fields,
	onSubmit,
	submitLabel,
	children,
}: {
	fields: ReadonlyArray<FormField>;
	onSubmit: (answers: Record<string, AnswerDraft>) => Promise<unknown>;
	submitLabel?: string;
	children?: ReactNode;
}) {
	const form = useAppForm({
		defaultValues: emptyAnswers(fields),
		validators: formValidators(toZodSchema(fields)),
		onSubmit: async ({ value, formApi }) => {
			try {
				await onSubmit(value);
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<form.Form data-testid="form-renderer">
				<form.FormErrorSummary />
				{fields.map((field) => (
					<form.AppField key={field.id} name={field.id}>
						{(control) => {
							const common = { label: field.label, description: field.help || undefined, optional: !field.required };
							switch (field.type) {
								case "short_text":
									return <control.TextField {...common} maxLength={field.maxLength} />;
								case "long_text":
									return <control.TextareaField {...common} rows={4} maxLength={field.maxLength} />;
								case "email":
									return <control.EmailField {...common} />;
								case "number":
									return <control.NumberField {...common} integer={field.integer} />;
								case "single_select": {
									const options = field.options.map((option) => ({ value: option.id, label: option.label }));
									return field.display === "dropdown" ? (
										<control.SelectField {...common} options={options} />
									) : (
										<control.RadioGroupField {...common} options={options} />
									);
								}
								case "multi_select":
									return (
										<control.CheckboxGroupField
											{...common}
											options={field.options.map((option) => ({ value: option.id, label: option.label }))}
										/>
									);
								case "rating":
									return <RatingField {...common} lowLabel={field.lowLabel} highLabel={field.highLabel} />;
								case "date":
									return (
										<control.DateField
											{...common}
											{...(field.min ? { min: field.min } : {})}
											{...(field.max ? { max: field.max } : {})}
										/>
									);
								case "consent":
									return <control.CheckboxField label={field.label} description={field.help || undefined} />;
							}
						}}
					</form.AppField>
				))}
				{children}
				<form.SubmitButton className="self-start">{submitLabel ?? m.forms_submit()}</form.SubmitButton>
			</form.Form>
		</form.AppForm>
	);
}
