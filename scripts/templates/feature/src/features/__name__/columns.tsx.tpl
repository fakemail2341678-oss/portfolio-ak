{{#public}}
import { StatusBadge } from "@/components/data-display/status-badge";
{{/public}}
import { RecordLink } from "@/components/crud/record-link";
import type { DataTableColumn } from "@/components/data-table";
import { formatDateTime } from "@/lib/i18n/intl";
{{#localized}}
import { localizedValue } from "@/lib/i18n/localized";
{{/localized}}
import { m } from "@/paraglide/messages";
import type { __Pascal__ListItem } from "./schema";

/** The admin list's columns; `sort` values match __camel__List's sorts. */
export const __camel__Columns: ReadonlyArray<DataTableColumn<__Pascal__ListItem>> = [
	{
		id: "title",
		header: m.__snake___col_title,
		sort: "title",
		cellClassName: "max-w-72",
		// The edit page for users who may edit.
		cell: (row) => (
			<RecordLink link={{ to: "/admin/__name__/$id", params: { id: row.id } }} permission="__name__:update">
				{{{#localized}}localizedValue(row.title){{/localized}}{{^localized}}row.title{{/localized}}}
			</RecordLink>
		),
		csv: (row) => {{#localized}}localizedValue(row.title){{/localized}}{{^localized}}row.title{{/localized}},
	},
{{#public}}
	{
		id: "status",
		header: m.__snake___col_status,
		hideable: true,
		csv: (row) => (row.published ? m.__snake___status_published() : m.__snake___status_draft()),
		cell: (row) =>
			row.published ? (
				<StatusBadge tone="success">{m.__snake___status_published()}</StatusBadge>
			) : (
				<StatusBadge tone="neutral">{m.__snake___status_draft()}</StatusBadge>
			),
	},
{{/public}}
	{
		id: "updated",
		header: m.__snake___col_updated,
		sort: "updated",
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDateTime(row.updatedAt),
		csv: (row) => row.updatedAt,
	},
];
