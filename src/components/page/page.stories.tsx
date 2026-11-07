import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxIcon, PlusIcon } from "lucide-react";
import { expect } from "storybook/test";
import { Button } from "@/components/ui/button";
import { breadcrumbJsonLd } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";
import { Breadcrumbs } from "./breadcrumbs";
import { EmptyState } from "./empty-state";
import { Page, PageHeader } from "./page";
import { ListSkeleton, PageHeaderSkeleton } from "./skeletons";

const trail = [
	{ label: "Admin", path: "/admin" },
	{ label: "Test CRUD", path: "/admin/test-crud" },
	{ label: "Momo Kitchen", path: "/admin/test-crud/1" },
];

const meta = {
	title: "Page/Building blocks",
	component: PageHeader,
	args: { title: "Test CRUD", description: "Create, edit and publish items." },
} satisfies Meta<typeof PageHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Header: Story = {
	args: {
		actions: (
			<Button>
				<PlusIcon aria-hidden />
				New item
			</Button>
		),
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("heading", { level: 1, name: "Test CRUD" })).toBeVisible();
		await expect(canvas.getByRole("button", { name: "New item" })).toBeVisible();
	},
};

export const DisplayHeader: Story = { args: { size: "display" } };

/** Outside the admin area (whose topbar shows the trail), a page renders <Breadcrumbs /> above its header. */
export const WithBreadcrumbs: Story = {
	render: (args) => (
		<div className="flex flex-col gap-4">
			<Breadcrumbs items={trail} />
			<PageHeader {...args} />
		</div>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("navigation", { name: m.breadcrumbs_label() })).toBeVisible();
		// Earlier crumbs are links; the last one is the current page.
		await expect(canvas.getByRole("link", { name: "Test CRUD" })).toBeVisible();
		await expect(canvas.getByText("Momo Kitchen")).toHaveAttribute("aria-current", "page");
	},
};

/** Public pages also emit the trail as schema.org JSON-LD (absolute, localized URLs). */
export const BreadcrumbsWithJsonLd: Story = {
	render: () => <Breadcrumbs items={trail} jsonLd />,
	play: async ({ canvasElement }) => {
		const script = canvasElement.querySelector('script[type="application/ld+json"]');
		await expect(JSON.parse(script?.textContent ?? "{}")).toEqual(JSON.parse(JSON.stringify(breadcrumbJsonLd(trail))));
	},
};

export const Empty: Story = {
	render: () => (
		<EmptyState
			icon={InboxIcon}
			title="No items yet"
			description="Items you create appear here."
			primaryAction={<Button>Create the first item</Button>}
		/>
	),
};

export const Skeletons: Story = {
	render: () => (
		<Page width="wide" className="py-0 sm:py-0">
			<PageHeaderSkeleton size="display" extra />
			<ListSkeleton
				count={3}
				item={<div className="h-40 w-full animate-pulse rounded-xl bg-muted" />}
				className="sm:grid-cols-3"
			/>
		</Page>
	),
};

/** Guards the story-test setup: each Vitest project really renders its own locale and theme. */
export const VariantProbe: Story = {
	play: async () => {
		const darkNe = import.meta.env.STORYBOOK_VARIANT === "dark-ne";
		await expect(document.documentElement.lang).toBe(darkNe ? "ne" : "en");
		await expect(document.documentElement.classList.contains("dark")).toBe(darkNe);
	},
};
