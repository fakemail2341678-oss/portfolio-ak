import { SearchFilter, SelectFilter } from "@/components/filters/filters";
import { choiceChip, defineFilters, textChip } from "@/lib/crud/filters";
import { m } from "@/paraglide/messages";
import { LINK_MODERATION_STATES, type LinkModerationSearch } from "./search";

type StateFilter = (typeof LINK_MODERATION_STATES)[number];

const STATE_FILTER_LABELS: Record<StateFilter, () => string> = {
	all: m.links_filter_all,
	live: m.links_state_live,
	blocked: m.links_state_blocked,
	guest: m.links_state_guest,
};

/** /admin/links' filters (inside <FilterBar>). Names match linkModerationList's params. */
export function LinkModerationFilterControls({ search }: { search: LinkModerationSearch }) {
	return (
		<>
			<SearchFilter label={m.crud_search()} value={search.q} placeholder={m.links_moderation_search()} />
			<SelectFilter
				name="state"
				label={m.links_col_state()}
				value={search.state}
				options={LINK_MODERATION_STATES.map((state) => ({ value: state, label: STATE_FILTER_LABELS[state]() }))}
			/>
		</>
	);
}

export const linkModerationFilters = defineFilters<LinkModerationSearch>([
	textChip("q", m.crud_search),
	choiceChip("state", m.links_col_state, (state: StateFilter) => STATE_FILTER_LABELS[state]()),
]);
