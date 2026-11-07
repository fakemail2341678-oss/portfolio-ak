import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { AppHeader } from "@/components/app-header/app-header";
import { ContourArt } from "@/components/brand/contour-art";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { LoginForm } from "@/features/auth/components/login-form";
import { m } from "@/paraglide/messages";
import { sampleAdmin, sampleUser } from "../../../.storybook/mocks/data";
import { AuthShell } from "./auth-shell";

/** The sign-in pages' frame with the login form, as `_auth` renders it. */
function SignInPage() {
	return (
		<AuthShell>
			<main {...MAIN_CONTENT} className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
				<h1 className="text-title">{m.auth_login_title()}</h1>
				<LoginForm onSignedIn={() => {}} />
			</main>
		</AuthShell>
	);
}

const meta = {
	title: "Layout/Auth shell",
	component: SignInPage,
	parameters: { layout: "fullscreen", app: { route: "/login" } },
} satisfies Meta<typeof SignInPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The form on the left; on wide screens the contour panel on the right (decorative). */
export const SignIn: Story = {
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("heading", { level: 1, name: m.auth_login_title() })).toBeVisible();
		await expect(canvas.getByTestId("auth-brand-panel").querySelector("svg")).toHaveAttribute("aria-hidden", "true");
	},
};

/** The art alone: the same seed draws the same ridge everywhere (server and browser). */
export const Contours: Story = {
	render: () => (
		<div className="h-[32rem] bg-surface-1 text-primary">
			<ContourArt className="size-full" />
		</div>
	),
};

/** The account page's compact header: brand, admin link when permitted, the user menu. */
export const AppHeaderAdmin: Story = {
	parameters: { app: { session: sampleAdmin, route: "/account" } },
	render: () => <AppHeader />,
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("link", { name: m.nav_admin() })).toBeVisible();
		await expect(canvas.getByTestId("user-menu")).toBeVisible();
	},
};

export const AppHeaderMember: Story = {
	parameters: { app: { session: sampleUser, route: "/account" } },
	render: () => <AppHeader />,
	play: async ({ canvas }) => {
		await expect(canvas.queryByRole("link", { name: m.nav_admin() })).toBeNull();
	},
};
