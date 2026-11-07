import { StatusOf } from "@/components/data-display/status-badge";
import type { DataTableColumn } from "@/components/data-table";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { capacityHours, MEMBER_STATE, TEAM_ROLE_LABELS } from "../labels";
import type { AdminMemberItem } from "../schema";

/** Columns of /admin/taskline/members: who, their role and title, capacity and workload. */
export const adminMemberColumns: ReadonlyArray<DataTableColumn<AdminMemberItem>> = [
	{
		id: "name",
		header: m.taskline_admin_col_member,
		sort: "name",
		cellClassName: "max-w-72",
		cell: (row) => (
			<div className="flex min-w-0 flex-col">
				<span className="truncate font-medium">{row.name}</span>
				<span className="truncate text-muted-foreground text-xs">{row.email ?? m.taskline_admin_no_account()}</span>
			</div>
		),
		csv: (row) => row.name,
	},
	{
		id: "email",
		header: m.taskline_admin_col_email,
		hideable: true,
		cell: (row) => row.email ?? "",
		csv: (row) => row.email ?? "",
	},
	{
		id: "role",
		header: m.taskline_admin_col_role,
		cell: (row) => TEAM_ROLE_LABELS[row.role](),
		csv: (row) => TEAM_ROLE_LABELS[row.role](),
	},
	{
		id: "title",
		header: m.taskline_admin_col_title,
		hideable: true,
		cell: (row) => row.title || <span className="text-muted-foreground">—</span>,
		csv: (row) => row.title,
	},
	{
		id: "capacity",
		header: m.taskline_admin_col_capacity,
		hideable: true,
		cellClassName: "text-end tabular-nums",
		cell: (row) => m.taskline_admin_hours({ hours: formatNumber(capacityHours(row.capacityMinutesWeek)) }),
		csv: (row) => String(capacityHours(row.capacityMinutesWeek)),
	},
	{
		id: "open",
		header: m.taskline_admin_col_workload,
		cellClassName: "text-end tabular-nums",
		cell: (row) => (
			<span>
				{formatNumber(row.open)}
				{row.overdue > 0 ? (
					<span className="ms-1 text-destructive text-xs">
						{m.taskline_admin_overdue_count({ count: formatNumber(row.overdue) })}
					</span>
				) : null}
			</span>
		),
		csv: (row) => String(row.open),
	},
	{
		id: "projects",
		header: m.taskline_admin_col_projects,
		hideable: true,
		cellClassName: "text-end tabular-nums",
		cell: (row) => formatNumber(row.projects),
		csv: (row) => String(row.projects),
	},
	{
		id: "state",
		header: m.taskline_admin_col_state,
		cell: (row) => <StatusOf status={row.deactivated ? "deactivated" : "active"} map={MEMBER_STATE} />,
		csv: (row) => MEMBER_STATE[row.deactivated ? "deactivated" : "active"].label(),
	},
	{
		id: "joined",
		header: m.taskline_admin_col_joined,
		sort: "joined",
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDate(row.joinedAt, { dateStyle: "medium" }),
		csv: (row) => row.joinedAt,
	},
];
