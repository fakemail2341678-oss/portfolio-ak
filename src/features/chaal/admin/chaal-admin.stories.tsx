import type { Meta, StoryObj } from "@storybook/react-vite";
import { Suspense } from "react";
import { expect, within } from "storybook/test";
import { m } from "@/paraglide/messages";
import { sampleAdmin } from "../../../../.storybook/mocks/data";
import { CHAAL_NAME } from "../brand";
import { BlockDialog } from "./blocks/block-form";
import { ChaalCuration } from "./curation/curation-page";
import { FeaturedDialog } from "./curation/featured-dialog";
import { ChaalHealthView } from "./health/health-page";
import { ChaalOverviewView } from "./overview/overview-page";
import { ChaalAdminSettingsPage } from "./settings/settings-page";

/** /admin/chaal's pages (PLAN Tasks 79 and 84) with the mocked functions (.storybook/mocks/functions/chaal-admin/). */
function Settings() {
	return (
		<Suspense>
			<ChaalAdminSettingsPage />
		</Suspense>
	);
}

const meta = {
	title: "Chaal/Admin",
	component: Settings,
	parameters: { app: { session: sampleAdmin, route: "/admin/chaal/settings" } },
} satisfies Meta<typeof Settings>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Maintenance off, every switch with the scopes it adds (studies off), online play, defaults, the engine, notices and the purge. */
export const SettingsPage: Story = {
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { level: 1, name: m.ch_admin_settings_title() })).toBeVisible();
		await expect(canvas.getByTestId("chaal-maintenance")).toHaveAttribute("data-state", "off");
		await expect(canvas.getByRole("switch", { name: m.ch_admin_feature_play() })).toBeChecked();
		await expect(canvas.getByRole("switch", { name: m.ch_admin_feature_studies() })).not.toBeChecked();
		await expect(canvas.getByText(/board:play, challenge:read, challenge:write/)).toBeVisible();
		await expect(canvas.getByTestId("chaal-cache-epoch")).toBeVisible();
	},
};

/** Blocking a Lichess account, filled in from a connection's "Block this account". */
export const BlockAccount: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/chaal/connections" } },
	render: () => <BlockDialog lichess="pawnstorm" onClose={() => {}} />,
	play: async () => {
		const dialog = within(document.body);
		await expect(await dialog.findByLabelText(m.ch_admin_block_username())).toHaveValue("pawnstorm");
		await expect(dialog.getByLabelText(m.ch_admin_col_reason())).toBeVisible();
	},
};

/** A day of calls with trouble at noon: the totals, the chart, a wait running, the endpoints and the failures. */
export const Health: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/chaal/health" } },
	render: () => (
		<Suspense>
			<ChaalHealthView range="24h" />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { level: 1, name: m.ch_admin_health_title() })).toBeVisible();
		await expect(canvas.getByTestId("chaal-health-range-24h")).toHaveAttribute("aria-current", "page");
		await expect(canvas.getByTestId("chaal-cooldowns")).toHaveTextContent("Sita_K");
		await expect(canvas.getAllByText("explorer-masters").length).toBeGreaterThan(0);
	},
};

/** A week of play (Task 84): players connected and active, the range's figures, two charts, the modes and the API's day. */
export const Overview: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/chaal" } },
	render: () => (
		<Suspense>
			<ChaalOverviewView range="7d" />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { level: 1, name: CHAAL_NAME })).toBeVisible();
		await expect(canvas.getByTestId("chaal-range-7d")).toHaveAttribute("aria-current", "page");
		await expect(canvas.getByTestId("chaal-overview-modes")).toHaveTextContent(m.ch_admin_mode_seek());
		await expect(canvas.getByTestId("chaal-overview-api")).toBeVisible();
	},
};

/** The broadcasts tab (Task 84): one showing, one scheduled, each with its dates, to drag, change or remove. */
export const Curation: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/chaal/curation" } },
	render: () => (
		<Suspense>
			<ChaalCuration tab="broadcasts" />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { level: 1, name: m.ch_admin_curation_title() })).toBeVisible();
		await expect(canvas.getAllByTestId("chaal-featured-row")).toHaveLength(2);
		await expect(canvas.getByText(m.ch_admin_featured_scheduled())).toBeVisible();
	},
};

/** The home tab (Task 84): the sections in order with their switches, and the announcement. */
export const CurationHome: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/chaal/curation" } },
	render: () => (
		<Suspense>
			<ChaalCuration tab="home" />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("switch", { name: m.ch_admin_home_show({ section: m.ch_home_start() }) }),
		).toBeChecked();
		await expect(canvas.getByTestId("chaal-announcement-form")).toBeVisible();
	},
};

/** Featuring a tournament (Task 84): arena or Swiss, its id or address, the title in both languages, the dates. */
export const FeatureTournament: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/chaal/curation" } },
	render: () => <FeaturedDialog section="tournaments" onClose={() => {}} />,
	play: async () => {
		const dialog = within(document.body);
		await expect(await dialog.findByLabelText(m.ch_admin_featured_ref())).toBeVisible();
		await expect(dialog.getByRole("radio", { name: m.ch_admin_featured_kind_swiss() })).toBeVisible();
	},
};
