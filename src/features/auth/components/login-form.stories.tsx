import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor } from "storybook/test";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";
import { LoginForm } from "./login-form";

const meta = {
	title: "Auth/Login form",
	component: LoginForm,
	args: { onSignedIn: fn() },
	decorators: [
		(Story) => (
			<div className="max-w-sm">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof LoginForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Empty submit: both fields report localized errors and nothing is sent. */
export const ValidationErrors: Story = {
	play: async ({ canvas, userEvent, args }) => {
		await userEvent.click(canvas.getByRole("button", { name: m.auth_submit_login() }));
		await expect(canvas.getByLabelText(m.auth_email_label())).toHaveAttribute("aria-invalid", "true");
		await expect(canvas.getByLabelText(m.auth_password_label())).toHaveAttribute("aria-invalid", "true");
		await expect(authClient.signIn.email).not.toHaveBeenCalled();
		await expect(args.onSignedIn).not.toHaveBeenCalled();
	},
};

/** Wrong credentials (the mock rejects wrong@example.com): the localized message appears. */
export const WrongCredentials: Story = {
	play: async ({ canvas, userEvent, args }) => {
		await userEvent.type(canvas.getByLabelText(m.auth_email_label()), "wrong@example.com");
		await userEvent.type(canvas.getByLabelText(m.auth_password_label()), "not-the-password");
		await userEvent.click(canvas.getByRole("button", { name: m.auth_submit_login() }));
		await expect(await canvas.findByText(m.auth_error_invalid_credentials())).toBeVisible();
		await expect(args.onSignedIn).not.toHaveBeenCalled();
	},
};

/** Valid credentials: Better Auth is called and the page is told to navigate. */
export const SignsIn: Story = {
	play: async ({ canvas, userEvent, args }) => {
		await userEvent.type(canvas.getByLabelText(m.auth_email_label()), "admin@example.com");
		await userEvent.type(canvas.getByLabelText(m.auth_password_label()), "admin-password-123");
		await userEvent.click(canvas.getByRole("button", { name: m.auth_submit_login() }));
		await waitFor(() => expect(args.onSignedIn).toHaveBeenCalledOnce());
		await expect(authClient.signIn.email).toHaveBeenCalledWith({
			email: "admin@example.com",
			password: "admin-password-123",
		});
	},
};

/** Two-factor on (the mock answers 2fa@example.com that way): the code step replaces the form. */
export const TwoFactorStep: Story = {
	play: async ({ canvas, userEvent, args }) => {
		await userEvent.type(canvas.getByLabelText(m.auth_email_label()), "2fa@example.com");
		await userEvent.type(canvas.getByLabelText(m.auth_password_label()), "admin-password-123");
		await userEvent.click(canvas.getByRole("button", { name: m.auth_submit_login() }));
		await expect(await canvas.findByText(m.auth_2fa_intro())).toBeVisible();
		await expect(args.onSignedIn).not.toHaveBeenCalled();

		await userEvent.type(canvas.getByLabelText(m.auth_code_label()), "123456");
		await userEvent.click(canvas.getByLabelText(m.auth_2fa_trust_device()));
		await userEvent.click(canvas.getByRole("button", { name: m.auth_otp_verify() }));
		await waitFor(() => expect(args.onSignedIn).toHaveBeenCalledOnce());
		await expect(authClient.twoFactor.verifyTotp).toHaveBeenCalledWith({ code: "123456", trustDevice: true });
	},
};
