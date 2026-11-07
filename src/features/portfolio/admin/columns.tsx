import { ImageIcon } from "lucide-react";
import { RecordLink } from "@/components/crud/record-link";
import { StatusOf } from "@/components/data-display/status-badge";
import type { DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { CloudImage } from "@/features/attachments/components/cloud-image";
import type { ImageAsset } from "@/features/attachments/schema";
import { formatDate, formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { ContactMessageItem, PostListItem, ProjectListItem } from "../schema";
import { PORTFOLIO_STATUS, STATUS_LABELS } from "./labels";

/**
 * The portfolio admin lists' columns. `sort` values match the lists' sorts in
 * ../search.ts; `hideable` columns appear in the Columns menu.
 */

/** A cover thumbnail, or a placeholder (a project shows its glyph). */
function Thumb({ image, glyph }: { image: ImageAsset | null; glyph?: string }) {
	return image ? (
		<CloudImage image={image} variant="thumb" alt="" loading="lazy" className="size-10 rounded border object-cover" />
	) : (
		<div
			aria-hidden
			className="flex size-10 items-center justify-center rounded border bg-muted font-semibold text-muted-foreground text-xs"
		>
			{glyph ?? <ImageIcon className="size-4" />}
		</div>
	);
}

const updated = <T extends { updatedAt: string }>(): DataTableColumn<T> => ({
	id: "updated",
	header: m.portfolio_admin_col_updated,
	sort: "updated",
	hideable: true,
	cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
	cell: (row) => formatDateTime(row.updatedAt),
	csv: (row) => row.updatedAt,
});

export const projectColumns: ReadonlyArray<DataTableColumn<ProjectListItem>> = [
	{
		id: "cover",
		header: m.portfolio_admin_col_cover,
		srOnlyHeader: true,
		hideable: true,
		headClassName: "w-16",
		cell: (row) => <Thumb image={row.cover} glyph={row.glyph} />,
	},
	{
		id: "title",
		header: m.portfolio_admin_col_title,
		sort: "title",
		cellClassName: "max-w-72",
		cell: (row) => (
			<RecordLink
				link={{ to: "/admin/portfolio/projects/$id", params: { id: row.id } }}
				permission="portfolio:write"
				detail={row.slug}
			>
				{row.title}
			</RecordLink>
		),
		csv: (row) => row.title,
	},
	{
		id: "status",
		header: m.portfolio_admin_col_status,
		hideable: true,
		cell: (row) => (
			<div className="flex flex-wrap gap-1">
				<StatusOf status={row.status} map={PORTFOLIO_STATUS} />
				{row.featured ? <Badge variant="outline">{m.portfolio_admin_featured()}</Badge> : null}
			</div>
		),
		csv: (row) => STATUS_LABELS[row.status](),
	},
	{
		id: "year",
		header: m.portfolio_admin_col_year,
		sort: "year",
		hideable: true,
		cellClassName: "tabular-nums",
		cell: (row) => formatNumber(row.year, { useGrouping: false }),
		csv: (row) => row.year,
	},
	updated<ProjectListItem>(),
];

export const postColumns: ReadonlyArray<DataTableColumn<PostListItem>> = [
	{
		id: "cover",
		header: m.portfolio_admin_col_cover,
		srOnlyHeader: true,
		hideable: true,
		headClassName: "w-16",
		cell: (row) => <Thumb image={row.cover} />,
	},
	{
		id: "title",
		header: m.portfolio_admin_col_title,
		sort: "title",
		cellClassName: "max-w-80",
		cell: (row) => (
			<RecordLink
				link={{ to: "/admin/portfolio/journal/$id", params: { id: row.id } }}
				permission="portfolio:write"
				detail={row.slug}
			>
				{localizedValue(row.title)}
			</RecordLink>
		),
		csv: (row) => row.title.en,
	},
	{
		id: "status",
		header: m.portfolio_admin_col_status,
		hideable: true,
		cell: (row) => <StatusOf status={row.status} map={PORTFOLIO_STATUS} />,
		csv: (row) => STATUS_LABELS[row.status](),
	},
	{
		id: "tags",
		header: m.portfolio_admin_col_tags,
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
		id: "published",
		header: m.portfolio_admin_col_published,
		sort: "published",
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => (row.publishedAt ? formatDate(row.publishedAt, { dateStyle: "medium" }) : "—"),
		csv: (row) => row.publishedAt ?? "",
	},
	updated<PostListItem>(),
];

/** Unread messages are bold, like any inbox. */
export const messageColumns: ReadonlyArray<DataTableColumn<ContactMessageItem>> = [
	{
		id: "from",
		header: m.messages_col_from,
		cellClassName: "max-w-56",
		cell: (row) => (
			<div className={cn("flex min-w-0 flex-col", !row.readAt && "font-semibold")}>
				<span className="truncate">{row.name}</span>
				<span className="truncate font-normal text-muted-foreground text-xs">{row.email}</span>
			</div>
		),
		csv: (row) => `${row.name} <${row.email}>`,
	},
	{
		id: "message",
		header: m.messages_col_message,
		cellClassName: "max-w-96",
		cell: (row) => (
			<p className={cn("line-clamp-2 text-sm", row.readAt ? "text-muted-foreground" : "font-medium")}>
				{row.readAt ? null : <span className="sr-only">{`${m.messages_unread()} `}</span>}
				{row.message}
			</p>
		),
		csv: (row) => row.message,
	},
	{
		id: "received",
		header: m.messages_col_received,
		sort: "received",
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDateTime(row.createdAt),
		csv: (row) => row.createdAt,
	},
];
