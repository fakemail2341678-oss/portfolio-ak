import type { ReactNode } from "react";
import { z } from "zod";
import { m } from "@/paraglide/messages";
import { formValidators, useAppForm } from "./index";

/**
 * Storybook harness (used only by *.stories.tsx): a real form with one field
 * named "value", validated by `schema`, plus the error summary and a submit
 * button, so a story shows exactly what the field looks like inside the app.
 */
export function FieldStory({
	schema,
	defaultValue,
	children,
	onSubmit,
}: {
	schema: z.ZodType;
	defaultValue: unknown;
	children: ReactNode;
	onSubmit?: (value: unknown) => void;
}) {
	const form = useAppForm({
		defaultValues: { value: defaultValue },
		validators: formValidators(z.object({ value: schema })),
		onSubmit: ({ value }) => onSubmit?.(value.value),
	});
	return (
		<form.AppForm>
			<form.Form className="flex max-w-md flex-col gap-4">
				<form.FormErrorSummary />
				<form.AppField name="value">{() => children}</form.AppField>
				<form.SubmitButton>{m.showcase_submit()}</form.SubmitButton>
			</form.Form>
		</form.AppForm>
	);
}
