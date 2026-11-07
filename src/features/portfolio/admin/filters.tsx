import { SearchFilter, SelectFilter } from "@/components/filters/filters";
import { choiceChip, defineFilters, textChip } from "@/lib/crud/filters";
import { m } from "@/paraglide/messages";
import { MESSAGE_STATES_FILTER, type MessageStateFilter, PORTFOLIO_STATUSES } from "../constants";
import type { MessageSearch, PostSearch, ProjectSearch } from "../search";
import { MESSAGE_FILTER_LABELS, STATUS_FILTER_LABELS } from "./labels";

/** The portfolio admin lists' filter controls (inside <FilterBar>) and their chips. */

type StatusFilter = "all" | (typeof PORTFOLIO_STATUSES)[number];
const STATUS_OPTIONS = ["all", ...PORTFOLIO_STATUSES] as const;

function StatusControls({ search, placeholder }: { search: { q: string; status: StatusFilter }; placeholder: string }) {
	return (
		<>
			<SearchFilter label={m.crud_search()} value={search.q} placeholder={placeholder} />
			<SelectFilter
				name="status"
				label={m.portfolio_admin_filter_status()}
				value={search.status}
				options={STATUS_OPTIONS.map((status) => ({ value: status, label: STATUS_FILTER_LABELS[status]() }))}
			/>
		</>
	);
}

export function ProjectFilterControls({ search }: { search: ProjectSearch }) {
	return <StatusControls search={search} placeholder={m.portfolio_admin_projects_search()} />;
}

export function PostFilterControls({ search }: { search: PostSearch }) {
	return <StatusControls search={search} placeholder={m.portfolio_admin_posts_search()} />;
}

const statusChip = choiceChip("status", m.portfolio_admin_filter_status, (status: StatusFilter) =>
	STATUS_FILTER_LABELS[status](),
);

export const projectFilters = defineFilters<ProjectSearch>([textChip("q", m.crud_search), statusChip]);
export const postFilters = defineFilters<PostSearch>([textChip("q", m.crud_search), statusChip]);

export function MessageFilterControls({ search }: { search: MessageSearch }) {
	return (
		<>
			<SearchFilter label={m.crud_search()} value={search.q} placeholder={m.messages_search()} />
			<SelectFilter
				name="state"
				label={m.messages_filter_state()}
				value={search.state}
				options={MESSAGE_STATES_FILTER.map((state) => ({ value: state, label: MESSAGE_FILTER_LABELS[state]() }))}
			/>
		</>
	);
}

export const messageFilters = defineFilters<MessageSearch>([
	textChip("q", m.crud_search),
	choiceChip("state", m.messages_filter_state, (state: MessageStateFilter) => MESSAGE_FILTER_LABELS[state]()),
]);
