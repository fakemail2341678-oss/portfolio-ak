import { ActiveFilters, chipLabel } from "@/components/filters/active-filters";
import { FilterBar } from "@/components/filters/filter-bar";
import { type FilterOption, SearchFilter, SelectFilter } from "@/components/filters/filters";
import { choiceChip, defineFilters, textChip } from "@/lib/crud/filters";
import { m } from "@/paraglide/messages";
import { activeFields, fieldFilterChoices, fieldFilterParam, fieldFilterText, parseFieldFilters } from "../fields";
import { PRIORITY_LABELS, TYPE_LABELS } from "../labels";
import { type BLOCKED_FILTERS, DUE_FILTERS, type DueFilter, type PRIORITY_FILTERS, type TaskFilters } from "../search";
import { type ProjectTasks, TASK_PRIORITIES, TASK_TYPES, type TaskPriority, type TaskType } from "../types";

/**
 * The project's filters, shared by the board and the list (the same URL params, PLAN
 * 11.5): a GET form that works without JavaScript (<FilterBar>), and a chip per
 * filter that's applied. `extra` is the view's own control (swimlanes, grouping).
 */

type Context = Pick<ProjectTasks, "statuses" | "members" | "labels" | "sprints" | "milestones" | "fields"> & {
	project: Pick<ProjectTasks["project"], "settings">;
};

/** The sprint filter's value as words: the active sprint, the backlog, or one sprint by name (Task 52). */
const sprintText = (value: string, context: Context) =>
	value === "active"
		? m.taskline_filter_sprint_active()
		: value === "none"
			? m.taskline_backlog_section()
			: (context.sprints.find((sprint) => sprint.id === value)?.name ?? m.taskline_activity_a_sprint());

const DUE_LABELS: Record<Exclude<DueFilter, "all">, () => string> = {
	overdue: m.taskline_filter_due_overdue,
	week: m.taskline_filter_due_week,
	none: m.taskline_filter_due_none,
};

/** Task 54: the milestone filter's value as words. */
const milestoneText = (value: string, context: Context) =>
	value === "none"
		? m.taskline_milestone_none()
		: (context.milestones.find((milestone) => milestone.id === value)?.name ?? m.taskline_activity_a_milestone());

const BLOCKED_LABELS: Record<Exclude<(typeof BLOCKED_FILTERS)[number], "all">, () => string> = {
	yes: m.taskline_filter_blocked_yes,
	no: m.taskline_filter_blocked_no,
};

const assigneeText = (value: string, context: Context) =>
	value === "me"
		? m.taskline_filter_assignee_me()
		: value === "none"
			? m.taskline_unassigned()
			: context.members.find((member) => member.id === value)?.name;

const taskFilterChips = defineFilters<TaskFilters, Context>([
	textChip("q", m.crud_search),
	choiceChip(
		"status",
		m.taskline_field_status,
		(id: string, context: Context) => context.statuses.find((status) => status.id === id)?.name,
	),
	choiceChip("assignee", m.taskline_field_assignee, assigneeText),
	choiceChip(
		"label",
		m.taskline_field_labels,
		(id: string, context: Context) => context.labels.find((label) => label.id === id)?.name,
	),
	choiceChip("priority", m.taskline_field_priority, (value: (typeof PRIORITY_FILTERS)[number]) =>
		value === "all" ? undefined : PRIORITY_LABELS[Number(value) as TaskPriority](),
	),
	choiceChip("type", m.taskline_field_type, (value: TaskType) => TYPE_LABELS[value]()),
	choiceChip("due", m.taskline_field_due, (value: Exclude<DueFilter, "all">) => DUE_LABELS[value]()),
	choiceChip("sprint", m.taskline_field_sprint, sprintText),
	choiceChip("milestone", m.taskline_field_milestone, milestoneText),
	choiceChip("blocked", m.taskline_filter_blocked, (value: Exclude<(typeof BLOCKED_FILTERS)[number], "all">) =>
		BLOCKED_LABELS[value](),
	),
	// Task 55: a chip per field filter ("Severity: High"), each removing only itself.
	{
		keys: ["cf"],
		chips: (search: Pick<TaskFilters, "cf">, context: Context) =>
			parseFieldFilters(search.cf).flatMap(({ fieldId, value }) => {
				const field = context.fields.find((each) => each.id === fieldId);
				const text = field ? fieldFilterText(field, value, context.members) : undefined;
				const param = fieldFilterParam(fieldId, value);
				return field && text
					? [
							{
								id: `cf:${fieldId}`,
								label: chipLabel(field.name, text),
								remove: { cf: search.cf.filter((each) => each !== param) },
							},
						]
					: [];
			}),
	},
]);

export function TaskFilterBar({
	search,
	context,
	member,
	preserve,
	extra,
	tools,
}: {
	search: TaskFilters & Readonly<Record<string, unknown>>;
	context: Context;
	/** Whether the caller is a member of the workspace (only then "Assigned to me" means someone). */
	member: boolean;
	/** The view's params the form keeps on a no-JS submit (sort, page size, swimlanes). */
	preserve: ReadonlyArray<string>;
	extra?: React.ReactNode;
	/** Beside the filters, outside their form: the view's "Views" menu (Task 51). */
	tools?: React.ReactNode;
}) {
	const all: FilterOption = { value: "all", label: m.filters_any() };
	const applied = taskFilterChips.applied(search, context);
	return (
		<div className="flex flex-col gap-2" data-testid="task-filters">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<FilterBar values={search} preserve={preserve} label={m.taskline_filters_label()}>
					<SearchFilter name="q" label={m.crud_search()} value={search.q} placeholder={m.taskline_filter_search()} />
					<SelectFilter
						name="status"
						label={m.taskline_field_status()}
						value={search.status}
						options={[all, ...context.statuses.map((status) => ({ value: status.id, label: status.name }))]}
					/>
					<SelectFilter
						name="assignee"
						label={m.taskline_field_assignee()}
						value={search.assignee}
						options={[
							all,
							...(member ? [{ value: "me", label: m.taskline_filter_assignee_me() }] : []),
							{ value: "none", label: m.taskline_unassigned() },
							...context.members
								.filter((each) => !each.deactivated)
								.map((each) => ({ value: each.id, label: each.name })),
						]}
					/>
					<SelectFilter
						name="label"
						label={m.taskline_field_labels()}
						value={search.label}
						options={[all, ...context.labels.map((label) => ({ value: label.id, label: label.name }))]}
					/>
					<SelectFilter
						name="priority"
						label={m.taskline_field_priority()}
						value={search.priority}
						options={[
							all,
							...[...TASK_PRIORITIES].reverse().map((priority) => ({
								value: String(priority),
								label: PRIORITY_LABELS[priority](),
							})),
						]}
					/>
					<SelectFilter
						name="type"
						label={m.taskline_field_type()}
						value={search.type}
						options={[all, ...TASK_TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type]() }))]}
					/>
					<SelectFilter
						name="due"
						label={m.taskline_field_due()}
						value={search.due}
						options={[
							all,
							...DUE_FILTERS.filter((due) => due !== "all").map((due) => ({ value: due, label: DUE_LABELS[due]() })),
						]}
					/>
					{/* Task 52: shown while the project has sprints on, or a link still sets it. */}
					{context.project.settings.sprints || search.sprint !== "all" ? (
						<SelectFilter
							name="sprint"
							label={m.taskline_field_sprint()}
							value={search.sprint}
							options={[
								all,
								{ value: "active", label: m.taskline_filter_sprint_active() },
								{ value: "none", label: m.taskline_backlog_section() },
								...context.sprints.map((sprint) => ({ value: sprint.id, label: sprint.name })),
							]}
						/>
					) : null}
					{/* Task 54: shown while the project has milestones, or a link still sets it. */}
					{context.milestones.length > 0 || search.milestone !== "all" ? (
						<SelectFilter
							name="milestone"
							label={m.taskline_field_milestone()}
							value={search.milestone}
							options={[
								all,
								{ value: "none", label: m.taskline_milestone_none() },
								...context.milestones.map((milestone) => ({ value: milestone.id, label: milestone.name })),
							]}
						/>
					) : null}
					<SelectFilter
						name="blocked"
						label={m.taskline_filter_blocked()}
						value={search.blocked}
						options={[all, { value: "yes", label: BLOCKED_LABELS.yes() }, { value: "no", label: BLOCKED_LABELS.no() }]}
					/>
					{/* Task 55: a select per custom field, all named `cf` (`?cf=<field>:<value>`, repeated). */}
					{activeFields(context.fields).map((field) => {
						const applied = parseFieldFilters(search.cf).find((filter) => filter.fieldId === field.id);
						return (
							<SelectFilter
								key={field.id}
								name="cf"
								label={field.name}
								value={applied ? fieldFilterParam(field.id, applied.value) : ""}
								options={[
									{ value: "", label: m.filters_any() },
									...fieldFilterChoices(field, context.members, { member }).map((choice) => ({
										value: fieldFilterParam(field.id, choice.value),
										label: choice.label,
									})),
								]}
							/>
						);
					})}
					{extra}
				</FilterBar>
				{tools ? <div className="ms-auto flex items-center gap-2">{tools}</div> : null}
			</div>
			<ActiveFilters chips={applied.chips} clearAll={applied.clearAll} />
		</div>
	);
}
