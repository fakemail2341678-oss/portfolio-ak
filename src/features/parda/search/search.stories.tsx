import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";
import { getPardaSuggest } from "@/functions/parda/search";
import { m } from "@/paraglide/messages";
import { withParda } from "../../../../.storybook/mocks/parda";
import { CatalogUnconfigured } from "../home/catalog-unconfigured";
import { PardaFrame } from "../shell/parda-frame";

/**
 * Parda's search overlay (Task 66): opened from the top mask, its hits come from the
 * (mocked) multi search; the pictures are missing, so each row shows its mask.
 */
const meta = {
	title: "Parda/Search",
	decorators: [withParda],
	parameters: { layout: "fullscreen", app: { route: "/app/parda" } },
	beforeEach: () => {
		// The mock module (.storybook/mocks/functions/parda/search.ts) stands in for the server function.
		mocked(getPardaSuggest).mockResolvedValue({
			imageBase: "",
			hits: [
				{
					media: "movie",
					id: 11,
					slug: "a-quiet-orbit",
					title: "A Quiet Orbit",
					year: 2024,
					poster: null,
					backdrop: null,
					overview: "",
					genres: [878],
					rating: 7.4,
				},
				{
					media: "tv",
					id: 12,
					slug: "river-of-stars",
					title: "River of Stars",
					year: 2021,
					poster: null,
					backdrop: null,
					overview: "",
					genres: [18],
					rating: 8.1,
				},
				{ media: "person", id: 13, name: "Asha Rai", profile: null, department: "Acting", knownFor: ["A Quiet Orbit"] },
			],
		});
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Typed: "See all results" first (Enter opens the page), then titles and people. */
export const Overlay: Story = {
	render: () => (
		<PardaFrame>
			<main className="flex flex-1 flex-col">
				<CatalogUnconfigured />
			</main>
		</PardaFrame>
	),
	play: async ({ canvas }) => {
		await userEvent.click(canvas.getByTestId("parda-search-button"));
		const body = within(document.body);
		// The overlay is its own chunk, loaded on first use.
		const overlay = await body.findByTestId("parda-search-overlay", {}, { timeout: 10_000 });
		await userEvent.type(within(overlay).getByTestId("parda-search-input"), "star");
		await waitFor(() => expect(within(overlay).getByText("River of Stars")).toBeVisible(), { timeout: 5_000 });
		await expect(within(overlay).getByText(m.pd_search_see_all({ q: "star" }))).toBeVisible();
		await expect(within(overlay).getByText("Asha Rai")).toBeVisible();
	},
};
