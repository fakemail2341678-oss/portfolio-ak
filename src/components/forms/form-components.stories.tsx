import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { z } from "zod";
import { email, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { formValidators, useAppForm } from "./index";

/** A two-field form to show the shared pieces: SubmitButton and FormErrorSummary. */
function SummaryDemo() {
	const form = useAppForm({
		defaultValues: { name: "", email: "" },
		validators: formValidators(z.object({ name: required(), email: email() })),
	});
	return (
		<form.AppForm>
			<form.Form className="flex max-w-md flex-col gap-4">
				<form.FormErrorSummary />
				<form.AppField name="name">{(field) => <field.TextField label={m.showcase_name()} />}</form.AppField>
				<form.AppField name="email">{(field) => <field.EmailField label={m.auth_email_label()} />}</form.AppField>
				<form.SubmitButton>{m.showcase_submit()}</form.SubmitButton>
			</form.Form>
		</form.AppForm>
	);
}

const meta = { title: "Forms/Form and error summary", component: SummaryDemo } satisfies Meta<typeof SummaryDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A failed submit lists every problem, links to each field and takes focus. */
export const ErrorSummary: Story = {
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: m.showcase_submit() }));
		const summary = await canvas.findByTestId("form-error-summary");
		await expect(summary).toHaveFocus();
		await expect(canvas.getAllByRole("link").length).toBe(2);
		await userEvent.click(canvas.getAllByRole("link")[1] as HTMLElement);
		await expect(canvas.getByLabelText(m.auth_email_label())).toHaveFocus();
	},
};
