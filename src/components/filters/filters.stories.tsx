import type { Meta, StoryObj } from "@storybook/react-vite";
import { useSearch } from "@tanstack/react-router";
import { expect, waitFor, within } from "storybook/test";
import { z } from "zod";
import { arrayParam, booleanParam, dateParam, enumParam, numberParam, searchParam } from "@/lib/list/params";
import { m } from "@/paraglide/messages";
import { ActiveFilters, chipLabel, type FilterChip, rangeValue } from "./active-filters";
import { FilterBar } from "./filter-bar";
import {
	BooleanFilter,
	DateRangeFilter,
	MultiSelectFilter,
	NumberRangeFilter,
	SearchFilter,
	SelectFilter,
} from "./filters";

const schema = z.object({
	q: searchParam(),
	status: enumParam(["all", "draft", "published"], "all"),
	tags: arrayParam(z.string()),
	priceMin: numberParam(),
	priceMax: numberParam(),
	from: dateParam(),
	to: dateParam(),
	hasImage: booleanParam(),
});

/** Every filter control in one bar, reading the story router's URL like a real route. */
function AllFilters() {
	const search = schema.parse(useSearch({ strict: false }));
	const chips: FilterChip[] = [
		...search.tags.map((tag) => ({
			id: tag,
			label: chipLabel("Tags", tag),
			remove: { tags: search.tags.filter((other) => other !== tag) },
		})),
		...(search.status !== "all"
			? [{ id: "status", label: chipLabel("Status", search.status), remove: { status: undefined } }]
			: []),
	];
	const price = rangeValue(search.priceMin?.toString(), search.priceMax?.toString());
	if (price)
		chips.push({ id: "price", label: chipLabel("Price", price), remove: { priceMin: undefined, priceMax: undefined } });
	return (
		<div className="flex flex-col gap-3">
			<FilterBar values={search}>
				<SearchFilter label="Search" value={search.q} placeholder="Title or slug" />
				<SelectFilter
					name="status"
					label="Status"
					value={search.status}
					options={[
						{ value: "all", label: "All statuses" },
						{ value: "draft", label: "Draft" },
						{ value: "published", label: "Published" },
					]}
				/>
				<MultiSelectFilter
					name="tags"
					label="Tags"
					value={search.tags}
					options={["drink", "food", "nepal"].map((tag) => ({ value: tag, label: tag }))}
				/>
				<NumberRangeFilter label="Price" names={["priceMin", "priceMax"]} value={[search.priceMin, search.priceMax]} />
				<DateRangeFilter label="Published" names={["from", "to"]} value={[search.from, search.to]} />
				<BooleanFilter name="hasImage" label="Image" value={search.hasImage} />
			</FilterBar>
			<ActiveFilters
				chips={chips}
				clearAll={{ q: undefined, status: undefined, tags: undefined, priceMin: undefined, priceMax: undefined }}
			/>
		</div>
	);
}

const meta = {
	title: "Data/Filters",
	component: AllFilters,
	parameters: { app: { route: "/admin/items" } },
} satisfies Meta<typeof AllFilters>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

/** Values come from the URL: controls and chips render them (also on the server). */
export const FromUrl: Story = {
	parameters: {
		app: { route: "/admin/items?status=draft&tags=food&tags=nepal&priceMin=100&priceMax=500&hasImage=true" },
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("combobox", { name: "Status" })).toHaveValue("draft");
		await expect(canvas.getByRole("spinbutton", { name: `Price: ${m.filters_min()}` })).toHaveValue(100);
		await expect(
			canvas.getByRole("link", { name: m.filters_remove({ label: chipLabel("Tags", "food") }) }),
		).toBeVisible();
	},
};

/** The tag dropdown is a native <details>: it opens without JavaScript, and its panel floats. */
export const TagsOpen: Story = {
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByText(m.filters_any(), { selector: "summary span" }));
		const food = await canvas.findByRole("checkbox", { name: "food" });
		await userEvent.click(food);
		await waitFor(() =>
			expect(canvas.getByRole("link", { name: m.filters_remove({ label: chipLabel("Tags", "food") }) })).toBeVisible(),
		);
		await expect(
			within(canvas.getByTestId("active-filters")).getByRole("link", { name: m.filters_clear_all() }),
		).toBeVisible();
	},
};
