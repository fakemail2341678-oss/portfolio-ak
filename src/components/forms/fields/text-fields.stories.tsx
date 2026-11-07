import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { email, optionalText, password, required, url } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { FieldStory } from "../story-harness";
import { EmailField, PasswordField, TextareaField, TextField, UrlField } from "./text-fields";

const meta = { title: "Forms/Text fields", component: TextField } satisfies Meta<typeof TextField>;
export default meta;
type Story = StoryObj<typeof meta>;

const args = { label: "" };

export const Text: Story = {
	args,
	render: () => (
		<FieldStory schema={required({ max: 80 })} defaultValue="Sita Sharma">
			<TextField label={m.showcase_name()} />
		</FieldStory>
	),
};

export const Email: Story = {
	args,
	render: () => (
		<FieldStory schema={email()} defaultValue="">
			<EmailField label={m.auth_email_label()} />
		</FieldStory>
	),
};

export const Url: Story = {
	args,
	render: () => (
		<FieldStory schema={url({ optional: true })} defaultValue="">
			<UrlField label={m.showcase_website()} optional />
		</FieldStory>
	),
};

export const Textarea: Story = {
	args,
	render: () => (
		<FieldStory schema={optionalText({ max: 200 })} defaultValue="">
			<TextareaField label={m.showcase_bio()} optional maxLength={200} showCount />
		</FieldStory>
	),
};

export const Password: Story = {
	args,
	render: () => (
		<FieldStory schema={password()} defaultValue="">
			<PasswordField label={m.auth_password_label()} />
		</FieldStory>
	),
};

/** Submitting an empty required field: inline error, aria-invalid and the focused error summary. */
export const WithError: Story = {
	args,
	render: () => (
		<FieldStory schema={required()} defaultValue="">
			<TextField label={m.showcase_name()} />
		</FieldStory>
	),
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: m.showcase_submit() }));
		await expect(canvas.getByLabelText(m.showcase_name())).toHaveAttribute("aria-invalid", "true");
		await expect(canvas.getByTestId("form-error-summary")).toHaveFocus();
	},
};
