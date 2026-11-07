import { SearchFilter } from "@/components/filters/filters";
import { defineFilters, textChip } from "@/lib/crud/filters";
import { m } from "@/paraglide/messages";
import type { __Pascal__Search } from "./search";

/** The admin list's filter controls (inside <FilterBar>). Names match __camel__List's params. */
export function __Pascal__FilterControls({ search }: { search: __Pascal__Search }) {
	return <SearchFilter label={m.crud_search()} value={search.q} placeholder={m.__snake___search_placeholder()} />;
}

/** One chip per applied filter, each removable; their keys are what "Clear all" resets. Add a chip per filter. */
export const __camel__Filters = defineFilters<__Pascal__Search>([textChip("q", m.crud_search)]);
