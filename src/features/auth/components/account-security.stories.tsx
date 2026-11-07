import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { setMyPassword } from "@/functions/auth";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";
import { AccountDataSection } from "./account-data-section";
import { SignInMethodsSection } from "./sign-in-methods-section";
import { TwoFactorSection } from "./two-factor-section";

/** The account page's security sections: two-factor, sign-in methods, and your data. */
const meta = {
	title: "Auth/Account security",
	component: TwoFactorSection,
	args: { enabled: false, required: false, hasPassword: true },
	decorators: [
		(Story) => (
			<div className="max-w-2xl">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof TwoFactorSection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TwoFactorOff: Story = {};

/** AUTH_REQUIRE_ADMIN_2FA applies: the section says why it's needed. */
export const TwoFactorRequired: Story = {
	args: { required: true },
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("alert")).toHaveTextContent(m.account_2fa_required());
	},
};

/** Setting it up: password, scan the QR code, confirm a code, then the backup codes. */
export const TwoFactorSetup: Story = {
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(canvas.getByLabelText(m.auth_current_password_label()), "my-password-123");
		await userEvent.click(canvas.getByRole("button", { name: m.account_2fa_enable() }));
		await expect(authClient.twoFactor.enable).toHaveBeenCalledWith({ password: "my-password-123" });
		await expect(await canvas.findByRole("img", { name: m.account_2fa_qr_alt() })).toBeVisible();
		await expect(canvas.getByTestId("2fa-secret")).toHaveTextContent("JBSWY3DPEHPK3PXP");

		await userEvent.type(canvas.getByLabelText(m.auth_code_label()), "000000");
		await userEvent.click(canvas.getByRole("button", { name: m.account_2fa_confirm() }));
		await expect(await canvas.findByText(m.auth_error_invalid_code())).toBeVisible();

		await userEvent.clear(canvas.getByLabelText(m.auth_code_label()));
		await userEvent.type(canvas.getByLabelText(m.auth_code_label()), "123456");
		await userEvent.click(canvas.getByRole("button", { name: m.account_2fa_confirm() }));
		await expect(await canvas.findByTestId("2fa-backup-codes")).toHaveTextContent("a1b2c-d3e4f");
	},
};

export const TwoFactorOn: Story = { args: { enabled: true } };

/** Signed up with Google, no password: the password form and a locked "Unlink". */
export const GoogleOnly: Story = {
	render: () => (
		<SignInMethodsSection
			security={{
				hasPassword: false,
				google: { available: true, accountId: "acc-google" },
				twoFactorEnabled: false,
				twoFactorRequired: false,
			}}
		/>
	),
	play: async ({ canvas, userEvent }) => {
		await expect(canvas.getByRole("button", { name: m.account_methods_google_unlink() })).toBeDisabled();
		await userEvent.type(canvas.getByLabelText(m.auth_new_password_label()), "a-new-password-123");
		await userEvent.type(canvas.getByLabelText(m.auth_confirm_password_label()), "a-new-password-123");
		await userEvent.click(canvas.getByRole("button", { name: m.account_methods_password_submit() }));
		await waitFor(() => expect(setMyPassword).toHaveBeenCalledWith({ data: { newPassword: "a-new-password-123" } }));
		await expect(await canvas.findByText(m.account_methods_password_set())).toBeVisible();
	},
};

export const PasswordAndGoogle: Story = {
	render: () => (
		<SignInMethodsSection
			security={{
				hasPassword: true,
				google: { available: true, accountId: "acc-google" },
				twoFactorEnabled: true,
				twoFactorRequired: false,
			}}
		/>
	),
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: m.account_methods_google_unlink() }));
		await expect(authClient.unlinkAccount).toHaveBeenCalledWith({ accountId: "acc-google" });
	},
};

/** Export link and the emailed deletion request. */
export const YourData: Story = {
	render: () => <AccountDataSection email="sita@example.com" />,
	play: async ({ canvas, userEvent }) => {
		await expect(canvas.getByRole("link", { name: m.account_export_download() })).toHaveAttribute(
			"href",
			"/api/account/export",
		);
		await userEvent.click(canvas.getByRole("button", { name: m.account_delete_request() }));
		await expect(await canvas.findByText(m.account_delete_sent({ email: "sita@example.com" }))).toBeVisible();
	},
};
