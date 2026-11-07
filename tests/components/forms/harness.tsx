import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactNode } from "react";
import { expect, vi } from "vitest";
import { z } from "zod";
import { formValidators, useAppForm } from "@/components/forms";

type HarnessProps = {
	defaultValue: unknown;
	schema: z.ZodType;
	onSubmit: (value: unknown) => void | Promise<void>;
	children: ReactNode;
};

/**
 * A real form (useAppForm + Form + FormErrorSummary + SubmitButton) with one
 * field named "value". Field components read their state from context, so a
 * test renders e.g. <TextField label="Name" /> as the child.
 */
function Harness({ defaultValue, schema, onSubmit, children }: HarnessProps) {
	const form = useAppForm({
		defaultValues: { value: defaultValue },
		validators: formValidators(z.object({ value: schema })),
		onSubmit: ({ value }) => onSubmit(value.value),
	});
	return (
		<form.AppForm>
			<form.Form>
				<form.FormErrorSummary />
				<form.AppField name="value">{() => children}</form.AppField>
				<form.SubmitButton>Submit</form.SubmitButton>
			</form.Form>
		</form.AppForm>
	);
}

export function renderField(
	field: ReactNode,
	options: {
		defaultValue: unknown;
		schema: z.ZodType;
		/** Providers around the form (a QueryClientProvider for fields that fetch). */
		wrapper?: ComponentType<{ children: ReactNode }>;
	},
) {
	const onSubmit = vi.fn<(value: unknown) => void>();
	const user = userEvent.setup();
	const view = render(
		<Harness defaultValue={options.defaultValue} schema={options.schema} onSubmit={onSubmit}>
			{field}
		</Harness>,
		options.wrapper ? { wrapper: options.wrapper } : {},
	);
	const submit = () => user.click(view.getByRole("button", { name: "Submit" }));
	return { ...view, user, onSubmit, submit };
}

/** The accessibility contract for an invalid field: aria-invalid + described by the error text. */
export function expectInvalid(control: HTMLElement, message: string) {
	expect(control).toHaveAttribute("aria-invalid", "true");
	const describedBy = control.getAttribute("aria-describedby") ?? "";
	const texts = describedBy
		.split(" ")
		.map((id) => document.getElementById(id)?.textContent ?? "")
		.join(" | ");
	expect(texts).toContain(message);
}

/** A valid field carries no aria-invalid. */
export function expectValid(control: HTMLElement) {
	expect(control).not.toHaveAttribute("aria-invalid");
}
