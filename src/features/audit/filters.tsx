import { dayValue } from "@/components/filters/active-filters";
import { DateRangeFilter, SearchFilter, SelectFilter } from "@/components/filters/filters";
import { choiceChip, defineFilters, rangeChip, textChip } from "@/lib/crud/filters";
import { m } from "@/paraglide/messages";
import { AUDIT_ACTION_LABELS, AUDIT_TARGET_LABELS } from "./labels";
import { AUDIT_ACTIONS, AUDIT_TARGETS, type AuditAction, type AuditTarget } from "./schema";
import type { AuditSearch } from "./search";

/** The audit log's filters (inside <FilterBar>). Names match auditList's params. */
export function AuditFilterControls({ search }: { search: AuditSearch }) {
	return (
		<>
			<SearchFilter label={m.audit_search_label()} value={search.q} placeholder={m.audit_search_placeholder()} />
			<SearchFilter
				name="actor"
				label={m.audit_filter_actor()}
				value={search.actor}
				placeholder={m.audit_actor_placeholder()}
			/>
			<SelectFilter
				name="action"
				label={m.audit_filter_action()}
				value={search.action}
				options={[
					{ value: "all", label: m.audit_action_all() },
					...AUDIT_ACTIONS.map((action) => ({ value: action, label: AUDIT_ACTION_LABELS[action]() })),
				]}
			/>
			<SelectFilter
				name="target"
				label={m.audit_filter_target()}
				value={search.target}
				options={[
					{ value: "all", label: m.audit_target_all() },
					...AUDIT_TARGETS.map((target) => ({ value: target, label: AUDIT_TARGET_LABELS[target]() })),
				]}
			/>
			<DateRangeFilter label={m.audit_filter_date()} names={["from", "to"]} value={[search.from, search.to]} />
		</>
	);
}

/** One chip per applied filter, each removable; their keys are what "Clear all" resets. */
export const auditFilters = defineFilters<AuditSearch>([
	textChip("q", m.audit_search_label),
	textChip("actor", m.audit_filter_actor),
	choiceChip("action", m.audit_filter_action, (action: AuditAction) => AUDIT_ACTION_LABELS[action]()),
	choiceChip("target", m.audit_filter_target, (target: AuditTarget) => AUDIT_TARGET_LABELS[target]()),
	rangeChip(["from", "to"], m.audit_filter_date, dayValue),
]);
