import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { DownloadIcon, LockIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { CrudListPage } from "@/components/crud/crud-list-page";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusBadge } from "@/components/data-display/status-badge";
import type { DataTableColumn, RowAction } from "@/components/data-table";
import { DateRangeFilter, SelectFilter } from "@/components/filters/filters";
import { PageTab, PageTabs } from "@/components/page/page-tabs";
import { Button } from "@/components/ui/button";
import { Can } from "@/features/rbac/can";
import { useListPage } from "@/hooks/use-list-page";
import { choiceChip, defineFilters, rangeChip } from "@/lib/crud/filters";
import { downloadCsv } from "@/lib/csv";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { formatDuration } from "../../time/duration";
import type { TimeEntry } from "../../types";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { adminTimeListQueryOptions, tasklineAdminMutations, timeOptionsQueryOptions } from "../queries";
import type { AdminTimeOptions } from "../schema";
import { type AdminTimeSearch, BILLABLE_FILTERS, TL_ADMIN_TIME_TABLE_ID } from "../search";

const dialogs = () => import("./time-dialogs");
const EditTimeDialog = lazy(() => dialogs().then((module) => ({ default: module.EditTimeDialog })));
const LockDialog = lazy(() => dialogs().then((module) => ({ default: module.LockDialog })));

const route = getRouteApi("/_admin/admin/taskline/timesheets/");

const dayText = (day: string) => formatDate(isoDateInstant(day), { dateStyle: "medium" });

type Billable = (typeof BILLABLE_FILTERS)[number];
const billableLabel = (value: Billable) =>
	value === "all"
		? m.taskline_admin_filter_all()
		: value === "billable"
			? m.taskline_time_billable()
			: m.taskline_time_unbillable();

/** Entries | Utilization, over both pages. */
export function TimeTabs() {
	return (
		<PageTabs label={m.taskline_admin_timesheets_title()}>
			<PageTab to="/admin/taskline/timesheets" activeOptions={{ exact: true }} data-testid="time-tab-entries">
				{m.taskline_admin_time_entries()}
			</PageTab>
			<PageTab to="/admin/taskline/timesheets/utilization" data-testid="time-tab-utilization">
				{m.taskline_admin_utilization_title()}
			</PageTab>
		</PageTabs>
	);
}

const filters = defineFilters<AdminTimeSearch, AdminTimeOptions>([
	choiceChip(
		"member",
		m.taskline_time_member,
		(id: string, options: AdminTimeOptions) => options.members.find((member) => member.id === id)?.name,
		"",
	),
	choiceChip(
		"project",
		m.taskline_admin_col_project,
		(id: string, options: AdminTimeOptions) => options.projects.find((project) => project.id === id)?.key,
		"",
	),
	choiceChip("billable", m.taskline_time_billable, billableLabel),
	rangeChip(["from", "to"], m.taskline_time_field_day, (day: string | undefined) => (day ? dayText(day) : undefined)),
]);

function FilterControls({ search, options }: { search: AdminTimeSearch; options: AdminTimeOptions }) {
	return (
		<>
			<SelectFilter
				name="member"
				label={m.taskline_time_member()}
				value={search.member}
				options={[
					{ value: "", label: m.taskline_admin_filter_all() },
					...options.members.map((member) => ({ value: member.id, label: member.name })),
				]}
			/>
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
				name="billable"
				label={m.taskline_time_billable()}
				value={search.billable}
				options={BILLABLE_FILTERS.map((value) => ({ value, label: billableLabel(value) }))}
			/>
			<DateRangeFilter label={m.taskline_time_field_day()} names={["from", "to"]} value={[search.from, search.to]} />
		</>
	);
}

const columns: ReadonlyArray<DataTableColumn<TimeEntry>> = [
	{
		id: "day",
		header: m.taskline_time_field_day,
		sort: "day",
		cellClassName: "whitespace-nowrap text-sm",
		cell: (row) => dayText(row.onDay),
		csv: (row) => row.onDay,
	},
	{ id: "member", header: m.taskline_time_member, cell: (row) => row.memberName, csv: (row) => row.memberName },
	{
		id: "task",
		header: m.taskline_admin_col_task,
		cellClassName: "max-w-72",
		cell: (row) => (
			<span className="block truncate">
				<span className="font-mono text-muted-foreground text-xs">{row.ref ?? row.project.key}</span>{" "}
				{row.title ?? m.taskline_timesheet_no_task()}
			</span>
		),
		csv: (row) => `${row.ref ?? row.project.key} ${row.title ?? ""}`.trim(),
	},
	{
		id: "minutes",
		header: m.taskline_time_field_duration,
		sort: "minutes",
		cellClassName: "whitespace-nowrap tabular-nums",
		cell: (row) => (row.running ? m.taskline_time_running() : formatDuration(row.minutes)),
		csv: (row) => row.minutes,
	},
	{
		id: "billable",
		header: m.taskline_time_billable,
		cell: (row) =>
			row.billable ? (
				<StatusBadge tone="info">{m.taskline_time_billable()}</StatusBadge>
			) : (
				<span className="text-muted-foreground">—</span>
			),
		csv: (row) => (row.billable ? "yes" : "no"),
	},
	{
		id: "note",
		header: m.taskline_time_field_note,
		cellClassName: "max-w-64 truncate text-muted-foreground",
		cell: (row) => (
			<>
				{row.locked ? <LockIcon className="me-1 inline size-3.5" aria-label={m.taskline_time_locked()} /> : null}
				{row.note}
			</>
		),
		csv: (row) => row.note,
	},
];

/**
 * /admin/taskline/timesheets (Task 53, `taskline:time`): every entry of the team, with
 * filters and totals; an entry changed or deleted (unless locked or still running);
 * the lock date; the filtered entries as CSV from the server (not just this page).
 */
export function AdminTimeList() {
	const search = route.useSearch();
	const list = useListPage({ tableId: TL_ADMIN_TIME_TABLE_ID, search, query: adminTimeListQueryOptions });
	const { data: options } = useSuspenseQuery(timeOptionsQueryOptions());
	const [editing, setEditing] = useState<TimeEntry | null>(null);
	const [locking, setLocking] = useState(false);
	const remove = useCrudMutation(tasklineAdminMutations.deleteTimeEntry(), { invalidate: ALL_TASKLINE_ADMIN });
	const exporter = useCrudMutation(tasklineAdminMutations.exportTime(), { invalidate: [] });
	const page = list.page;
	const totals = page
		? m.taskline_admin_time_totals({
				total: formatDuration(page.totalMinutes),
				billable: formatDuration(page.billableMinutes),
			})
		: "";
	const lock = options.lockOn
		? m.taskline_timesheet_locked_until({ date: dayText(options.lockOn) })
		: m.taskline_admin_time_unlocked();

	const rowActions = (row: TimeEntry): RowAction[] => [
		{
			id: "edit",
			label: m.crud_edit(),
			permission: "taskline:time",
			hidden: !row.canEdit,
			onSelect: () => setEditing(row),
		},
	];

	return (
		<CrudListPage
			title={m.taskline_admin_timesheets_title()}
			description={`${totals} · ${lock}`}
			actions={
				<Can permission="taskline:time">
					<Button variant="outline" onClick={() => setLocking(true)} data-testid="time-lock-open">
						<LockIcon aria-hidden />
						{m.taskline_admin_time_lock()}
					</Button>
					<Button
						variant="outline"
						disabled={exporter.isPending}
						onClick={() =>
							exporter.mutate(
								{ ...search, page: 1, pageSize: 10 },
								{ onSuccess: (file) => downloadCsv(file.filename, file.content) },
							)
						}
						data-testid="time-export"
					>
						<DownloadIcon aria-hidden />
						{m.taskline_admin_time_export()}
					</Button>
				</Can>
			}
			tabs={<TimeTabs />}
			tableId={TL_ADMIN_TIME_TABLE_ID}
			list={list}
			columns={columns}
			getRowLabel={(row) => `${row.memberName} · ${dayText(row.onDay)} · ${formatDuration(row.minutes)}`}
			search={search}
			filters={{ controls: <FilterControls search={search} options={options} />, ...filters.applied(search, options) }}
			rowActions={rowActions}
			remove={{
				permission: "taskline:time",
				can: (row) => !row.locked,
				bulk: false,
				run: async (ids) => {
					for (const id of ids) await remove.mutateAsync({ id });
				},
			}}
			empty={{ description: m.taskline_admin_time_empty(), filtered: m.taskline_admin_time_empty_filtered() }}
			data-testid="taskline-admin-time"
		>
			<Suspense fallback={null}>
				{editing ? <EditTimeDialog entry={editing} options={options} onClose={() => setEditing(null)} /> : null}
				{locking ? (
					<LockDialog lockOn={options.lockOn} today={options.today} onClose={() => setLocking(false)} />
				) : null}
			</Suspense>
		</CrudListPage>
	);
}
