import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxIcon, PaletteIcon, UserIcon } from "lucide-react";
import { expect } from "storybook/test";
import { useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { EmptyState } from "./empty-state";
import { FormCard, FormSection, StickyFormBar } from "./form-layout";
import { DetailLayout, SettingsLayout, SettingsNavLink } from "./layouts";
import { PageHeader } from "./page";
import { PageTab, PageTabs } from "./page-tabs";

/** Page layouts and form layouts of the kit. */
const meta = {
	title: "Page/Layouts",
	component: DetailLayout,
	parameters: { app: { route: "/admin/roles" } },
	args: { children: null, aside: null },
} satisfies Meta<typeof DetailLayout>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Route tabs under the header: the tab of the current route is aria-current. */
export const HeaderWithTabs: Story = {
	render: () => (
		<PageHeader
			title="Roles"
			description="Who can do what."
			tabs={
				<PageTabs label="Roles">
					<PageTab to="/admin/roles" activeOptions={{ exact: true }}>
						Roles
					</PageTab>
					<PageTab to="/admin/roles/permissions">Permissions</PageTab>
				</PageTabs>
			}
		/>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("link", { name: "Roles" })).toHaveAttribute("aria-current", "page");
		await expect(canvas.getByRole("link", { name: "Permissions" })).not.toHaveAttribute("aria-current");
	},
};

export const Detail: Story = {
	args: {
		children: <div className="h-48 rounded-lg border border-dashed p-4">Main column: the form or the content.</div>,
		aside: (
			<section className="rounded-lg border p-4">
				<h2 className="text-heading">Details</h2>
				<p className="text-sm">Status, owner, dates.</p>
			</section>
		),
	},
};

export const Settings: Story = {
	parameters: { app: { route: "/admin/settings/appearance" } },
	render: () => (
		<SettingsLayout
			label="Settings"
			nav={
				<>
					<SettingsNavLink to="/admin/settings/appearance">
						<PaletteIcon aria-hidden />
						Appearance
					</SettingsNavLink>
					<SettingsNavLink to="/account">
						<UserIcon aria-hidden />
						Account
					</SettingsNavLink>
				</>
			}
		>
			<FormCard title="Theme" description="Light, dark, or follow the system.">
				<p className="text-sm">The section's content.</p>
			</FormCard>
		</SettingsLayout>
	),
};

/** Sections with headings, and the sticky save bar that says when something changed. */
export const LongForm: Story = {
	render: function Render() {
		const form = useAppForm({ defaultValues: { title: "Momo Kitchen", summary: "" } });
		return (
			<form.AppForm>
				<form.Form>
					<FormSection title="Basics" description="What visitors see first.">
						<form.AppField name="title">{(field) => <field.TextField label="Title" />}</form.AppField>
					</FormSection>
					<FormSection title="Details">
						<form.AppField name="summary">{(field) => <field.TextareaField label="Summary" optional />}</form.AppField>
					</FormSection>
					<StickyFormBar submitLabel="Save" cancel={<Button variant="ghost">Cancel</Button>} />
				</form.Form>
			</form.AppForm>
		);
	},
	play: async ({ canvas, userEvent }) => {
		await expect(canvas.queryByText(m.form_unsaved_changes())).toBeNull();
		await userEvent.type(canvas.getByRole("textbox", { name: "Title" }), "!");
		await expect(canvas.getByText(m.form_unsaved_changes())).toBeVisible();
	},
};

export const Card: Story = {
	render: () => (
		<FormCard
			title="Danger zone"
			description="Deleting the account can't be undone."
			action={<Button variant="link">Learn more</Button>}
			footer={<Button variant="destructive">Delete the account</Button>}
		>
			<p className="text-sm">Your items stay until you delete them.</p>
		</FormCard>
	),
};

/** "Nothing yet" offers to create; "no matches" offers to clear the filters. */
export const EmptyStates: Story = {
	render: () => (
		<div className="grid gap-3 md:grid-cols-2">
			<EmptyState
				icon={InboxIcon}
				title="No items yet"
				description="Items you create appear here."
				primaryAction={<Button>Create the first item</Button>}
				secondaryAction={<Button variant="ghost">Import</Button>}
			/>
			<EmptyState
				variant="no-matches"
				description="No items match."
				primaryAction={<Button variant="outline">Clear filters</Button>}
			/>
		</div>
	),
};
