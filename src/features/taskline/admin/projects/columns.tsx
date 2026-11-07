import { RecordLink } from "@/components/crud/record-link";
import { StatusOf } from "@/components/data-display/status-badge";
import type { DataTableColumn } from "@/components/data-table";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { tasklineColor } from "../../colors";
import { PROJECT_HEALTH, PROJECT_STATUS, VISIBILITY_LABELS } from "../labels";
import type { AdminProjectItem } from "../schema";

/** Columns of /admin/taskline/projects. */
export const adminProjectColumns: ReadonlyArray<DataTableColumn<AdminProjectItem>> = [
	{
		id: "name",
		header: m.taskline_admin_col_project,
		sort: "name",
		cellClassName: "max-w-80",
		cell: (row) => (
			<div className="flex min-w-0 items-start gap-2">
				<span
					className="mt-1.5 size-2.5 shrink-0 rounded-full"
					style={{ background: tasklineColor(row.color) }}
					aria-hidden
				/>
				<div className="min-w-0">
					<RecordLink
						link={{ to: "/admin/taskline/projects/$id", params: { id: row.id } }}
						permission="taskline:read"
						detail={row.key}
					>
						{row.name}
					</RecordLink>
				</div>
			</div>
		),
		csv: (row) => row.name,
	},
	{
		id: "key",
		header: m.taskline_project_key,
		sort: "key",
		hideable: true,
		csv: (row) => row.key,
		cell: (row) => row.key,
	},
	{
		id: "lead",
		header: m.taskline_admin_col_lead,
		cell: (row) => row.lead?.name ?? <span className="text-muted-foreground">{m.taskline_admin_no_lead()}</span>,
		csv: (row) => row.lead?.name ?? "",
	},
	{
		id: "status",
		header: m.taskline_project_status,
		cell: (row) => <StatusOf status={row.status} map={PROJECT_STATUS} />,
		csv: (row) => PROJECT_STATUS[row.status].label(),
	},
	{
		id: "health",
		header: m.taskline_project_health,
		hideable: true,
		cell: (row) =>
			row.health ? (
				<StatusOf status={row.health} map={PROJECT_HEALTH} />
			) : (
				<span className="text-muted-foreground">{m.taskline_health_none()}</span>
			),
		csv: (row) => (row.health ? PROJECT_HEALTH[row.health].label() : ""),
	},
	{
		id: "visibility",
		header: m.taskline_project_visibility,
		hideable: true,
		cell: (row) => VISIBILITY_LABELS[row.visibility](),
		csv: (row) => VISIBILITY_LABELS[row.visibility](),
	},
	{
		id: "members",
		header: m.taskline_admin_col_members,
		hideable: true,
		cellClassName: "text-end tabular-nums",
		cell: (row) => formatNumber(row.members),
		csv: (row) => String(row.members),
	},
	{
		id: "open",
		header: m.taskline_admin_col_open,
		cellClassName: "text-end tabular-nums",
		cell: (row) => formatNumber(row.open),
		csv: (row) => String(row.open),
	},
	{
		id: "updated",
		header: m.taskline_admin_col_updated,
		sort: "updated",
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDateTime(row.updatedAt),
		csv: (row) => row.updatedAt,
	},
];
