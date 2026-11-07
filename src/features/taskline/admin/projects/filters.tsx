import { SearchFilter, SelectFilter } from "@/components/filters/filters";
import { choiceChip, defineFilters, textChip } from "@/lib/crud/filters";
import { m } from "@/paraglide/messages";
import { PROJECT_STATUS, VISIBILITY_LABELS } from "../labels";
import { type AdminProjectSearch, PROJECT_STATUS_FILTERS, PROJECT_VISIBILITY_FILTERS } from "../search";

type StatusFilter = (typeof PROJECT_STATUS_FILTERS)[number];
type VisibilityFilter = (typeof PROJECT_VISIBILITY_FILTERS)[number];

const statusLabel = (status: StatusFilter) =>
	status === "all" ? m.taskline_admin_filter_all() : PROJECT_STATUS[status].label();
const visibilityLabel = (visibility: VisibilityFilter) =>
	visibility === "all" ? m.taskline_admin_filter_all() : VISIBILITY_LABELS[visibility]();

/** /admin/taskline/projects' filters (inside <FilterBar>); `members` are the lead's choices. */
export function AdminProjectFilterControls({
	search,
	members,
}: {
	search: AdminProjectSearch;
	members: ReadonlyArray<{ id: string; name: string }>;
}) {
	return (
		<>
			<SearchFilter label={m.crud_search()} value={search.q} placeholder={m.taskline_admin_projects_search()} />
			<SelectFilter
				name="status"
				label={m.taskline_project_status()}
				value={search.status}
				options={PROJECT_STATUS_FILTERS.map((status) => ({ value: status, label: statusLabel(status) }))}
			/>
			<SelectFilter
				name="visibility"
				label={m.taskline_project_visibility()}
				value={search.visibility}
				options={PROJECT_VISIBILITY_FILTERS.map((visibility) => ({
					value: visibility,
					label: visibilityLabel(visibility),
				}))}
			/>
			<SelectFilter
				name="lead"
				label={m.taskline_admin_col_lead()}
				value={search.lead}
				options={[
					{ value: "", label: m.taskline_admin_filter_all() },
					{ value: "none", label: m.taskline_admin_no_lead() },
					...members.map((member) => ({ value: member.id, label: member.name })),
				]}
			/>
		</>
	);
}

type Members = ReadonlyArray<{ id: string; name: string }>;

/** The chips; the lead's name comes from the page's members (the context). */
export const adminProjectFilters = defineFilters<AdminProjectSearch, Members>([
	textChip("q", m.crud_search),
	choiceChip("status", m.taskline_project_status, statusLabel),
	choiceChip("visibility", m.taskline_project_visibility, visibilityLabel),
	choiceChip(
		"lead",
		m.taskline_admin_col_lead,
		(lead: string, members: Members) =>
			lead === "none" ? m.taskline_admin_no_lead() : (members.find((member) => member.id === lead)?.name ?? lead),
		"",
	),
]);
