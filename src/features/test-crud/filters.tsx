import { dayValue } from "@/components/filters/active-filters";
import {
	BooleanFilter,
	DateRangeFilter,
	MultiSelectFilter,
	NumberRangeFilter,
	SearchFilter,
	SelectFilter,
} from "@/components/filters/filters";
import { choiceChip, defineFilters, eachChip, flagChip, rangeChip, textChip } from "@/lib/crud/filters";
import { formatCurrency } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { STATUS_FILTER_LABELS } from "./labels";
import { TEST_CRUD_STATUS_FILTERS, type TestCrudSearch, type TestCrudStatusFilter } from "./search";

/** The admin list's filter controls (inside <FilterBar>). Names match testCrudList's params. */
export function TestCrudFilterControls({ search, tags }: { search: TestCrudSearch; tags: ReadonlyArray<string> }) {
	return (
		<>
			<SearchFilter label={m.crud_search()} value={search.q} placeholder={m.test_crud_search_placeholder()} />
			<SelectFilter
				name="status"
				label={m.test_crud_filter_status()}
				value={search.status}
				options={TEST_CRUD_STATUS_FILTERS.map((status) => ({ value: status, label: STATUS_FILTER_LABELS[status]() }))}
			/>
			<MultiSelectFilter
				name="tags"
				label={m.test_crud_filter_tags()}
				value={search.tags}
				// Keep selected tags listed even if no row uses them any more.
				options={[...new Set([...tags, ...search.tags])].map((tag) => ({ value: tag, label: tag }))}
			/>
			<NumberRangeFilter
				label={m.test_crud_filter_price()}
				names={["priceMin", "priceMax"]}
				value={[search.priceMin, search.priceMax]}
			/>
			<DateRangeFilter label={m.test_crud_filter_published()} names={["from", "to"]} value={[search.from, search.to]} />
			<BooleanFilter
				name="hasImage"
				label={m.test_crud_filter_has_image()}
				value={search.hasImage}
				trueLabel={m.test_crud_filter_with_image()}
				falseLabel={m.test_crud_filter_without_image()}
			/>
		</>
	);
}

const money = (value: number | undefined) => (value === undefined ? undefined : formatCurrency(value));

/** One chip per applied filter (one per tag), each removable; their keys are what "Clear all" resets. */
export const testCrudFilters = defineFilters<TestCrudSearch>([
	textChip("q", m.crud_search),
	choiceChip("status", m.test_crud_filter_status, (status: TestCrudStatusFilter) => STATUS_FILTER_LABELS[status]()),
	eachChip("tags", m.test_crud_filter_tags),
	rangeChip(["priceMin", "priceMax"], m.test_crud_filter_price, money),
	rangeChip(["from", "to"], m.test_crud_filter_published, dayValue),
	flagChip("hasImage", (on) => (on ? m.test_crud_filter_with_image() : m.test_crud_filter_without_image())),
]);
