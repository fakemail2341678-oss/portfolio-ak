import { ImageIcon } from "lucide-react";
import { RecordLink } from "@/components/crud/record-link";
import { StatusOf } from "@/components/data-display/status-badge";
import type { DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { CloudImage } from "@/features/attachments/components/cloud-image";
import { formatCurrency, formatDateTime } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { STATUS_LABELS, TEST_CRUD_STATUS } from "./labels";
import type { TestCrudListItem } from "./schema";

/**
 * The admin list's columns. `sort` values match testCrudList's sorts; `hideable`
 * columns appear in the Columns menu. Title, selection and actions always show.
 */
export const testCrudColumns: ReadonlyArray<DataTableColumn<TestCrudListItem>> = [
	{
		id: "image",
		header: m.test_crud_col_image,
		srOnlyHeader: true,
		hideable: true,
		headClassName: "w-16",
		cell: (row) =>
			row.image ? (
				<CloudImage
					image={row.image}
					variant="thumb"
					alt=""
					loading="lazy"
					className="size-10 rounded border object-cover"
				/>
			) : (
				<div className="flex size-10 items-center justify-center rounded border bg-muted">
					<ImageIcon className="size-4 text-muted-foreground" aria-hidden />
				</div>
			),
	},
	{
		id: "title",
		header: m.test_crud_col_title,
		sort: "title",
		cellClassName: "max-w-72",
		// The edit page for users who may edit; the slug under it.
		cell: (row) => (
			<RecordLink
				link={{ to: "/admin/test-crud/$id", params: { id: row.id } }}
				permission="test-crud:update"
				detail={row.slug}
			>
				{row.title}
			</RecordLink>
		),
		csv: (row) => row.title,
	},
	{
		id: "status",
		header: m.test_crud_col_status,
		hideable: true,
		cell: (row) => <StatusOf status={row.status} map={TEST_CRUD_STATUS} />,
		csv: (row) => STATUS_LABELS[row.status](),
	},
	{
		id: "price",
		header: m.test_crud_col_price,
		sort: "price",
		hideable: true,
		cellClassName: "whitespace-nowrap tabular-nums",
		cell: (row) => formatCurrency(row.price),
		csv: (row) => row.price,
	},
	{
		id: "tags",
		header: m.test_crud_col_tags,
		hideable: true,
		csv: (row) => row.tags.join(", "),
		cell: (row) => (
			<div className="flex max-w-56 flex-wrap gap-1">
				{row.tags.map((tag) => (
					<Badge key={tag} variant="outline">
						{tag}
					</Badge>
				))}
			</div>
		),
	},
	{
		id: "updated",
		header: m.test_crud_col_updated,
		sort: "updated",
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDateTime(row.updatedAt),
		csv: (row) => row.updatedAt,
	},
];
