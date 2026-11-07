import type { Meta, StoryObj } from "@storybook/react-vite";
import { Suspense } from "react";
import { expect, waitFor, within } from "storybook/test";
import { m } from "@/paraglide/messages";
import { sampleAdmin } from "../../../../.storybook/mocks/data";
import { PardaCollectionNewPage } from "./curation/collection-form";
import { PardaCollectionsPage } from "./curation/collection-list";
import { PardaLayout } from "./curation/layout-page";
import { SANDBOX_LABELS } from "./labels";
import { PardaOverview } from "./overview/overview-page";
import { PardaSettingsPage } from "./settings/settings-page";
import { PardaSourceNewPage } from "./sources/source-form";
import { PardaSourcesPage } from "./sources/source-list";
import { PardaTakedownNewPage } from "./titles/takedown-form";

/** /admin/parda's control pages (PLAN Task 65) with the mocked functions (.storybook/mocks/functions/parda-admin/). */
function Sources() {
	return (
		<Suspense>
			<PardaSourcesPage />
		</Suspense>
	);
}

const meta = {
	title: "Parda/Admin",
	component: Sources,
	parameters: { app: { session: sampleAdmin, route: "/admin/parda/sources" } },
} satisfies Meta<typeof Sources>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The servers in order under the kill switch: one pinned with open reports, one sandboxed, one disabled. */
export const SourceList: Story = {
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { level: 1, name: m.pd_admin_sources_title() })).toBeVisible();
		await expect(canvas.getByRole("switch", { name: m.pd_admin_playback_switch() })).toBeChecked();
		await expect(canvas.getByText(m.pd_admin_source_pinned())).toBeVisible();
		// Task 65a: the order's mode, and each row's standing (the player flags sit behind the Columns menu).
		await expect(canvas.getByTestId("parda-source-order")).toHaveAttribute("data-state", "auto");
		await expect(canvas.getAllByText(m.pd_admin_score_from_probe()).length).toBeGreaterThan(0);
		await expect(canvas.getByText(m.pd_admin_quality_from_admin())).toBeVisible();
		await expect(canvas.getByRole("link", { name: /^(Server 1|सर्भर 1)$/ })).toBeVisible();
	},
};

/** A new source: every field, and a sandbox brings its warning. */
export const NewSource: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/parda/sources/new" } },
	render: () => <PardaSourceNewPage />,
	play: async ({ canvas, userEvent }) => {
		await expect(await canvas.findByLabelText(m.pd_admin_source_movie_template())).toBeVisible();
		await expect(canvas.queryByTestId("parda-sandbox-warning")).toBeNull();
		await userEvent.click(canvas.getByRole("combobox", { name: m.pd_admin_source_sandbox_label() }));
		await userEvent.click(await within(document.body).findByRole("option", { name: SANDBOX_LABELS.popups() }));
		await expect(await canvas.findByTestId("parda-sandbox-warning")).toBeVisible();
		// The list has closed and the page is no longer hidden from assistive technology (the a11y check runs next).
		await waitFor(() => expect(document.querySelector("[data-aria-hidden]")).toBeNull());
	},
};

/** Blocking a title: its type, its TMDB id and the reason. */
export const BlockTitle: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/parda/titles/new" } },
	render: () => <PardaTakedownNewPage />,
	play: async ({ canvas }) => {
		await expect(await canvas.findByLabelText(m.pd_admin_takedown_id())).toHaveValue("");
		await expect(canvas.getByLabelText(m.pd_admin_takedown_reason())).toBeVisible();
	},
};

/** The kill switch, the catalogue's region and kids' cap, the players' languages, the banner and the purge. */
export const Settings: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/parda/settings" } },
	render: () => (
		<Suspense>
			<PardaSettingsPage />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByLabelText(m.pd_admin_settings_region())).toHaveValue("US");
		await expect(canvas.getByRole("switch", { name: m.pd_admin_playback_switch() })).toBeChecked();
		await expect(canvas.getByRole("button", { name: m.pd_admin_purge_action() })).toBeVisible();
	},
};

/** Task 69: the numbers, the 30-day chart by kind of viewer, top titles and searches, failures by server. */
export const Overview: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/parda" } },
	render: () => (
		<Suspense>
			<PardaOverview range="7d" />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByText(m.pd_admin_stat_plays_month())).toBeVisible();
		await expect(canvas.getByTestId("parda-range-7d")).toHaveAttribute("aria-current", "page");
		await expect(canvas.getByRole("link", { name: /^(Fight Club|फाइट क्लब)$/ })).toBeVisible();
		await expect(canvas.getByTestId("parda-zero-searches")).toHaveTextContent("kathmandu nights");
		// The chart's numbers are there for a screen reader too.
		await expect(canvas.getByRole("table", { name: m.pd_admin_overview_days_label() })).toBeInTheDocument();
		await expect(canvas.getByTestId("parda-servers")).toHaveTextContent(/Server 2|सर्भर 2/);
	},
};

/** Task 69: the home's rails in order, a published collection among them, one switched off. */
export const Layout: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/parda/layout" } },
	render: () => (
		<Suspense>
			<PardaLayout page="home" />
		</Suspense>
	),
	play: async ({ canvas, userEvent }) => {
		await expect(await canvas.findByText(m.pd_rail_top10())).toBeVisible();
		await expect(canvas.getByText(m.pd_admin_layout_collection())).toBeVisible();
		const save = canvas.getByTestId("parda-layout-save");
		await expect(save).toBeDisabled();
		await userEvent.click(canvas.getByRole("switch", { name: m.pd_admin_layout_show({ rail: m.pd_rail_upcoming() }) }));
		await expect(save).toBeEnabled();
	},
};

/** Task 69: collections, a published one with its address and how many titles it holds. */
export const Collections: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/parda/collections" } },
	render: () => (
		<Suspense>
			<PardaCollectionsPage />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByText("/c/festival-picks")).toBeVisible();
		await expect(canvas.getByText(m.pd_admin_collection_published())).toBeVisible();
	},
};

/** Task 69: a new collection: the address follows the name, and the titles are added with the picker. */
export const NewCollection: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/parda/collections/new" } },
	render: () => <PardaCollectionNewPage />,
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(await canvas.findByRole("textbox", { name: /^(Name|नाम)/ }), "Festival picks");
		await expect(canvas.getByLabelText(m.pd_admin_collection_slug())).toHaveValue("festival-picks");
		await userEvent.click(canvas.getByRole("combobox", { name: m.pd_admin_collection_titles() }));
		await userEvent.type(
			await within(document.body).findByRole("combobox", { name: m.pd_admin_title_search() }),
			"fight",
		);
		await userEvent.click(await within(document.body).findByRole("option", { name: /Fight Club/ }));
		await expect(await canvas.findByTestId("collection-title")).toHaveTextContent("Fight Club");
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(document.querySelector("[data-aria-hidden]")).toBeNull());
	},
};
