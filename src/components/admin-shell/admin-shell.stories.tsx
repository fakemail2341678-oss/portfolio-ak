import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Page, PageHeader } from "@/components/page/page";
import { m } from "@/paraglide/messages";
import { sampleAdmin, sampleEditor } from "../../../.storybook/mocks/data";
import { AdminShell } from "./admin-shell";

/** The admin frame around a stand-in page, as `_admin` renders it. */
function ShellWithPage() {
	return (
		<AdminShell>
			<Page width="admin">
				<PageHeader title="Test CRUD" description="Create, edit and publish items." />
				<div className="h-64 rounded-lg border border-dashed" />
			</Page>
		</AdminShell>
	);
}

const meta = {
	title: "Admin/Shell",
	component: ShellWithPage,
	parameters: { layout: "fullscreen", app: { session: sampleAdmin, route: "/admin/test-crud" } },
} satisfies Meta<typeof ShellWithPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Grouped sections, the current one highlighted; breadcrumbs and the palette button on top. */
export const Expanded: Story = {
	play: async ({ canvas }) => {
		const nav = canvas.getByRole("navigation", { name: m.admin_sidebar_label() });
		await expect(within(nav).getByRole("link", { name: m.admin_nav_test_crud() })).toHaveAttribute(
			"data-active",
			"true",
		);
		await expect(within(nav).getByText(m.admin_group_access())).toBeVisible();
		await expect(canvas.getByRole("button", { name: m.sidebar_collapse() })).toHaveAttribute("aria-expanded", "true");
	},
};

/** Icons only (the `sidebar` preference); labels move into tooltips. */
export const Collapsed: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/test-crud", preferences: { sidebarCollapsed: true } } },
	play: async ({ canvas, userEvent }) => {
		const expand = canvas.getByRole("button", { name: m.sidebar_expand() });
		await expect(expand).toHaveAttribute("aria-expanded", "false");
		await userEvent.click(expand);
		await expect(canvas.getByRole("button", { name: m.sidebar_collapse() })).toHaveAttribute("aria-expanded", "true");
	},
};

/** An editor (Test CRUD only) sees just the sections they may open. */
export const Editor: Story = {
	parameters: { app: { session: sampleEditor, route: "/admin/test-crud" } },
	play: async ({ canvas }) => {
		await expect(canvas.queryByRole("link", { name: m.admin_nav_users() })).toBeNull();
		await expect(canvas.getByRole("link", { name: m.admin_nav_appearance() })).toBeVisible();
	},
};

/** Ctrl K opens the palette: sections, feature actions, theme, language and sign out. */
export const CommandMenu: Story = {
	play: async ({ canvas, canvasElement, userEvent }) => {
		await userEvent.click(canvas.getByTestId("open-command-menu"));
		const body = within(canvasElement.ownerDocument.body);
		const dialog = await body.findByRole("dialog", { name: m.command_title() });
		await expect(within(dialog).getByText(m.command_test_crud_new())).toBeVisible();
		await userEvent.type(within(dialog).getByTestId("command-input"), "audit");
		await waitFor(() => expect(within(dialog).getByText(m.admin_nav_audit())).toBeVisible());
		await expect(within(dialog).queryByText(m.admin_nav_roles())).toBeNull();
		// Escape closes it. (Left open, axe would flag cmdk's aria-activedescendant, which
		// briefly names an item the filter just removed.)
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
	},
};

/** The user menu at the bottom of the sidebar. */
export const UserMenuOpen: Story = {
	play: async ({ canvas, canvasElement, userEvent }) => {
		await userEvent.click(within(canvas.getByTestId("admin-sidebar")).getByTestId("user-menu"));
		const menu = await within(canvasElement.ownerDocument.body).findByRole("menu");
		await expect(within(menu).getByRole("menuitem", { name: m.admin_nav_appearance() })).toBeVisible();
		await expect(within(menu).getByRole("menuitem", { name: m.nav_logout() })).toBeVisible();
	},
};
