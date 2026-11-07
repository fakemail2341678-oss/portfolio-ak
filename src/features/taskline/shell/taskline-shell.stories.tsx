import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Page, PageHeader } from "@/components/page/page";
import { m } from "@/paraglide/messages";
import {
	sampleGuestNav,
	sampleTasklineGuest,
	sampleTasklineMember,
	sampleTasklineNav,
} from "../../../../.storybook/mocks/taskline";
import type { TasklineNav } from "../types";
import { TasklineShell } from "./taskline-shell";

/** Taskline's frame around a stand-in page, as the `_shell` layout renders it (decision 0208). */
function ShellWithPage({ nav }: { nav: TasklineNav }) {
	return (
		<TasklineShell nav={nav}>
			<Page width="admin">
				<PageHeader title="Projects" description="Himal Studio" />
				<div className="h-64 rounded-lg border border-dashed" />
			</Page>
		</TasklineShell>
	);
}

const meta = {
	title: "Taskline/Shell",
	component: ShellWithPage,
	args: { nav: sampleTasklineNav },
	parameters: {
		layout: "fullscreen",
		app: { session: sampleTasklineMember, route: "/app/taskline/team/projects" },
	},
} satisfies Meta<typeof ShellWithPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A team member with a sandbox too: the switcher, Home and Projects, starred and recent projects. */
export const Desktop: Story = {
	play: async ({ canvas }) => {
		const nav = canvas.getByRole("navigation", { name: m.taskline_sidebar_label() });
		await expect(within(nav).getByTestId("workspace-switcher")).toBeVisible();
		await expect(within(nav).getByText(m.taskline_nav_starred())).toBeVisible();
		await expect(canvas.queryByTestId("guest-banner")).toBeNull();
	},
};

/** A guest in their sandbox: no switcher, and the banner offering sign-up. */
export const Guest: Story = {
	args: { nav: sampleGuestNav },
	parameters: { app: { session: sampleTasklineGuest, route: "/app/taskline/sandbox/projects" } },
	play: async ({ canvas }) => {
		await expect(canvas.getByTestId("guest-banner")).toBeVisible();
		await expect(canvas.queryByTestId("workspace-switcher")).toBeNull();
	},
};

/** Ctrl K: every project, the pages, a new project per workspace, preferences. */
export const Palette: Story = {
	play: async ({ canvas, canvasElement, userEvent }) => {
		await userEvent.click(canvas.getByTestId("open-command-menu"));
		const body = within(canvasElement.ownerDocument.body);
		const dialog = await body.findByRole("dialog", { name: m.command_title() });
		await userEvent.type(within(dialog).getByTestId("command-input"), "ops");
		await waitFor(() => expect(within(dialog).getByText("Operations")).toBeVisible());
		// Escape closes it (left open, axe would flag cmdk's aria-activedescendant mid-filter).
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
	},
};

/** On a phone the sidebar is a sheet, opened from the topbar; the user menu moves to the topbar. */
export const Phone: Story = {
	globals: { viewport: { value: "mobile1", isRotated: false } },
	play: async ({ canvas, canvasElement, userEvent }) => {
		// Both menus are rendered and CSS shows one: on a phone, the topbar's (the last).
		await expect(canvas.getAllByTestId("user-menu").at(-1)).toBeVisible();
		await userEvent.click(canvas.getByRole("button", { name: m.sidebar_open() }));
		const sheet = await within(canvasElement.ownerDocument.body).findByRole("dialog");
		await expect(within(sheet).getByRole("link", { name: m.taskline_nav_home() })).toBeVisible();
		await userEvent.keyboard("{Escape}");
	},
};
