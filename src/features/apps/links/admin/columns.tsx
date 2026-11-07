import { StatusOf } from "@/components/data-display/status-badge";
import type { DataTableColumn } from "@/components/data-table";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { displayTarget, shortUrl } from "../format";
import { LINK_STATE } from "../labels";
import type { LinkModerationItem } from "./schema";

/** Columns of /admin/links. */
export const linkModerationColumns: ReadonlyArray<DataTableColumn<LinkModerationItem>> = [
	{
		id: "slug",
		header: m.links_col_link,
		sort: "slug",
		cellClassName: "max-w-72",
		cell: (row) => (
			<div className="flex min-w-0 flex-col">
				<span className="truncate font-medium font-mono">/l/{row.slug}</span>
				<span className="truncate text-muted-foreground text-xs">{row.title}</span>
			</div>
		),
		csv: (row) => shortUrl(row.slug),
	},
	{
		id: "target",
		header: m.links_field_target,
		cellClassName: "max-w-80",
		cell: (row) => <span className="block truncate text-sm">{displayTarget(row.target)}</span>,
		csv: (row) => row.target,
	},
	{
		id: "owner",
		header: m.links_col_owner,
		cellClassName: "max-w-56",
		cell: (row) =>
			row.owner.guest ? (
				<span className="text-muted-foreground text-sm">{m.guest_label()}</span>
			) : (
				<div className="flex min-w-0 flex-col">
					<span className="truncate text-sm">{row.owner.name}</span>
					<span className="truncate text-muted-foreground text-xs">{row.owner.email}</span>
				</div>
			),
		csv: (row) => (row.owner.guest ? m.guest_label() : row.owner.email),
	},
	{
		id: "state",
		header: m.links_col_state,
		cell: (row) => <StatusOf status={row.state} map={LINK_STATE} />,
		csv: (row) => LINK_STATE[row.state].label(),
	},
	{
		id: "clicks",
		header: m.links_total,
		hideable: true,
		cellClassName: "text-end tabular-nums",
		cell: (row) => formatNumber(row.clicks),
		csv: (row) => String(row.clicks),
	},
	{
		id: "created",
		header: m.links_col_created,
		sort: "created",
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDateTime(row.createdAt),
		csv: (row) => row.createdAt,
	},
];
