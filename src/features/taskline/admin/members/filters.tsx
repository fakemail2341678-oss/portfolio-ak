import { SearchFilter, SelectFilter } from "@/components/filters/filters";
import { choiceChip, defineFilters, textChip } from "@/lib/crud/filters";
import { m } from "@/paraglide/messages";
import { MEMBER_STATE, TEAM_ROLE_LABELS } from "../labels";
import { type AdminMemberSearch, MEMBER_ROLE_FILTERS, MEMBER_STATE_FILTERS } from "../search";

type StateFilter = (typeof MEMBER_STATE_FILTERS)[number];
type RoleFilter = (typeof MEMBER_ROLE_FILTERS)[number];

const stateLabel = (state: StateFilter) =>
	state === "all" ? m.taskline_admin_filter_all() : MEMBER_STATE[state].label();
const roleLabel = (role: RoleFilter) => (role === "all" ? m.taskline_admin_filter_all() : TEAM_ROLE_LABELS[role]());

/** /admin/taskline/members' filters (inside <FilterBar>). */
export function AdminMemberFilterControls({ search }: { search: AdminMemberSearch }) {
	return (
		<>
			<SearchFilter label={m.crud_search()} value={search.q} placeholder={m.taskline_admin_members_search()} />
			<SelectFilter
				name="state"
				label={m.taskline_admin_col_state()}
				value={search.state}
				options={MEMBER_STATE_FILTERS.map((state) => ({ value: state, label: stateLabel(state) }))}
			/>
			<SelectFilter
				name="role"
				label={m.taskline_admin_col_role()}
				value={search.role}
				options={MEMBER_ROLE_FILTERS.map((role) => ({ value: role, label: roleLabel(role) }))}
			/>
		</>
	);
}

/** The chips. The state's default is "active", so that one shows no chip. */
export const adminMemberFilters = defineFilters<AdminMemberSearch>([
	textChip("q", m.crud_search),
	choiceChip("state", m.taskline_admin_col_state, stateLabel, "active"),
	choiceChip("role", m.taskline_admin_col_role, roleLabel),
]);
