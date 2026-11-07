import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { CrudListPage } from "@/components/crud/crud-list-page";
import type { DataTableColumn } from "@/components/data-table";
import { DateRangeFilter, SelectFilter } from "@/components/filters/filters";
import { useListPage } from "@/hooks/use-list-page";
import { choiceChip, defineFilters, rangeChip } from "@/lib/crud/filters";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatDateTime } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { activitySentence } from "../../task/activity";
import type { TasklineMember, TasklineStatus } from "../../types";
import { ACTIVITY_KIND_LABELS } from "../labels";
import { activityOptionsQueryOptions, adminActivityQueryOptions } from "../queries";
import type { AdminActivityEntry, AdminActivityOptions } from "../schema";
import { ACTIVITY_KIND_FILTERS, type AdminActivitySearch, TL_ADMIN_ACTIVITY_TABLE_ID } from "../search";

const route = getRouteApi("/_admin/admin/taskline/activity");

type Kind = (typeof ACTIVITY_KIND_FILTERS)[number];
const kindLabel = (kind: Kind) => (kind === "all" ? m.taskline_admin_filter_all() : ACTIVITY_KIND_LABELS[kind]());

const filters = defineFilters<AdminActivitySearch, AdminActivityOptions>([
	choiceChip(
		"project",
		m.taskline_admin_col_project,
		(id: string, options: AdminActivityOptions) => options.projects.find((project) => project.id === id)?.key,
		"",
	),
	choiceChip(
		"actor",
		m.taskline_admin_col_actor,
		(id: string, options: AdminActivityOptions) => options.members.find((member) => member.id === id)?.name,
		"",
	),
	choiceChip("kind", m.taskline_admin_col_kind, kindLabel),
	rangeChip(["from", "to"], m.taskline_admin_col_when, (day: string | undefined) =>
		day ? formatDate(isoDateInstant(day), { dateStyle: "medium" }) : undefined,
	),
]);

function FilterControls({ search, options }: { search: AdminActivitySearch; options: AdminActivityOptions }) {
	return (
		<>
			<SelectFilter
				name="project"
				label={m.taskline_admin_col_project()}
				value={search.project}
				options={[
					{ value: "", label: m.taskline_admin_filter_all() },
					...options.projects.map((project) => ({ value: project.id, label: `${project.key} · ${project.name}` })),
				]}
			/>
			<SelectFilter
				name="actor"
				label={m.taskline_admin_col_actor()}
				value={search.actor}
				options={[
					{ value: "", label: m.taskline_admin_filter_all() },
					...options.members.map((member) => ({ value: member.id, label: member.name })),
				]}
			/>
			<SelectFilter
				name="kind"
				label={m.taskline_admin_col_kind()}
				value={search.kind}
				className="w-48"
				options={ACTIVITY_KIND_FILTERS.map((kind) => ({ value: kind, label: kindLabel(kind) }))}
			/>
			<DateRangeFilter label={m.taskline_admin_col_when()} names={["from", "to"]} value={[search.from, search.to]} />
		</>
	);
}

const columnsFor = (context: {
	members: ReadonlyArray<TasklineMember>;
	statuses: ReadonlyArray<TasklineStatus>;
}): ReadonlyArray<DataTableColumn<AdminActivityEntry>> => [
	{
		id: "at",
		header: m.taskline_admin_col_when,
		sort: "at",
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDateTime(row.at),
		csv: (row) => row.at,
	},
	{
		id: "what",
		header: m.taskline_admin_col_what,
		cellClassName: "min-w-64",
		cell: (row) => activitySentence(row, context),
		csv: (row) => activitySentence(row, context),
	},
	{
		id: "task",
		header: m.taskline_admin_col_task,
		cellClassName: "max-w-64",
		cell: (row) =>
			row.task ? (
				<span className="block truncate">
					<span className="font-mono text-muted-foreground text-xs">{row.task.ref}</span> {row.task.title}
				</span>
			) : (
				<span className="text-muted-foreground">—</span>
			),
		csv: (row) => (row.task ? `${row.task.ref} ${row.task.title}` : ""),
	},
	{
		id: "project",
		header: m.taskline_admin_col_project,
		cell: (row) =>
			row.project.key ? (
				<Link
					to="/admin/taskline/projects/$id"
					params={{ id: row.project.id }}
					className="font-mono text-sm underline-offset-4 hover:underline"
				>
					{row.project.key}
				</Link>
			) : null,
		csv: (row) => row.project.key,
	},
];

/**
 * /admin/taskline/activity: everything the team did, as the app's own sentences, newest
 * first. The members' history, not the admin audit log (which holds admin changes; 0205).
 */
export function TasklineActivityPage() {
	const search = route.useSearch();
	const list = useListPage({ tableId: TL_ADMIN_ACTIVITY_TABLE_ID, search, query: adminActivityQueryOptions });
	const { data: options } = useSuspenseQuery(activityOptionsQueryOptions());
	const context = { members: list.page?.members ?? [], statuses: list.page?.statuses ?? [] };
	return (
		<CrudListPage
			title={m.taskline_admin_activity_title()}
			description={m.taskline_admin_activity_description()}
			tableId={TL_ADMIN_ACTIVITY_TABLE_ID}
			list={list}
			columns={columnsFor(context)}
			getRowLabel={(row) => activitySentence(row, context)}
			search={search}
			filters={{ controls: <FilterControls search={search} options={options} />, ...filters.applied(search, options) }}
			empty={{ description: m.taskline_admin_activity_empty(), filtered: m.taskline_admin_activity_empty_filtered() }}
			exportName="taskline-activity"
			data-testid="taskline-admin-activity"
		/>
	);
}
