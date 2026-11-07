import { SearchFilter, SelectFilter } from "@/components/filters/filters";
import { choiceChip, defineFilters, textChip } from "@/lib/crud/filters";
import { m } from "@/paraglide/messages";
import { roleLabel } from "./labels";
import type { RoleSummary } from "./schema";
import { USER_STATUS_FILTERS, type UserSearch } from "./search";

type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

const STATUS_LABELS: Record<UserStatusFilter, () => string> = {
	all: m.users_status_all,
	active: m.users_status_active,
	banned: m.users_status_banned,
};

/** Role filter options: all, Admin, the baseline only, then every custom role. */
const roleOptions = (roles: ReadonlyArray<RoleSummary>) => [
	{ value: "all", label: m.users_role_all() },
	{ value: "admin", label: m.role_admin_name() },
	{ value: "user", label: m.users_role_baseline() },
	...roles.filter((role) => !role.system).map((role) => ({ value: role.key, label: roleLabel(role) })),
];

/** The users list's filter controls (inside <FilterBar>). */
export function UserFilterControls({ search, roles }: { search: UserSearch; roles: ReadonlyArray<RoleSummary> }) {
	return (
		<>
			<SearchFilter label={m.crud_search()} value={search.q} placeholder={m.users_search_placeholder()} />
			<SelectFilter name="role" label={m.users_filter_role()} value={search.role} options={roleOptions(roles)} />
			<SelectFilter
				name="status"
				label={m.users_filter_status()}
				value={search.status}
				options={USER_STATUS_FILTERS.map((status) => ({ value: status, label: STATUS_LABELS[status]() }))}
			/>
		</>
	);
}

/** The applied filters as chips; role chips are labelled from the role options. */
export const userFilters = defineFilters<UserSearch, ReadonlyArray<RoleSummary>>([
	textChip("q", m.crud_search),
	choiceChip(
		"role",
		m.users_filter_role,
		(role: string, roles: ReadonlyArray<RoleSummary>) =>
			roleOptions(roles).find((option) => option.value === role)?.label ?? role,
	),
	choiceChip("status", m.users_filter_status, (status: UserStatusFilter) => STATUS_LABELS[status]()),
]);
