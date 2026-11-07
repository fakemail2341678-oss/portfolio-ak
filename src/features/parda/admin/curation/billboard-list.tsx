import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, linkOptions } from "@tanstack/react-router";
import { ArrowDownUpIcon, PlusIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { CrudListPage, CrudListPending } from "@/components/crud/crud-list-page";
import { RecordLink } from "@/components/crud/record-link";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusOf } from "@/components/data-display/status-badge";
import type { DataTableColumn, RowAction } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/rbac/can";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import type { PardaPage } from "../../search";
import { pardaAdminKeys } from "../keys";
import { MEDIA_LABELS, SLOT_STATES } from "../labels";
import { pardaAdminMutations, pardaBillboardsQueryOptions } from "../queries";
import type { AdminBillboard } from "../schema";
import { PageNav } from "../segment-nav";
import { titleText } from "../title-cell";

// Opens on click: its dnd-kit list loads with it, not with the page (0168).
const ReorderBillboardDialog = lazy(() =>
	import("./billboard-reorder-dialog").then((module) => ({ default: module.ReorderBillboardDialog })),
);

const route = getRouteApi("/_admin/admin/parda/billboard/");

const BILLBOARD_TABLE_ID = "parda-billboard";

const day = (value: string) => formatDate(isoDateInstant(value), { dateStyle: "medium" });

/** "4 Nov 2026 – 11 Nov 2026"; an open end says so. */
const dates = (row: AdminBillboard) => {
	if (!row.startsOn && !row.endsOn) return m.pd_admin_billboard_always();
	if (!row.endsOn) return m.pd_admin_billboard_from({ date: day(row.startsOn) });
	if (!row.startsOn) return m.pd_admin_billboard_until({ date: day(row.endsOn) });
	return `${day(row.startsOn)} – ${day(row.endsOn)}`;
};

const columns: ReadonlyArray<DataTableColumn<AdminBillboard>> = [
	{
		id: "title",
		header: m.pd_admin_col_title,
		cellClassName: "max-w-80",
		cell: (row) => (
			<RecordLink
				link={{ to: "/admin/parda/billboard/$id", params: { id: row.id } }}
				permission="parda:curate"
				detail={`${MEDIA_LABELS[row.media]()} · TMDB ${formatNumber(row.tmdbId, { useGrouping: false })}`}
			>
				{titleText(row)}
			</RecordLink>
		),
		csv: (row) => titleText(row),
	},
	{
		id: "state",
		header: m.pd_admin_col_state,
		cell: (row) => <StatusOf status={row.state} map={SLOT_STATES} />,
		csv: (row) => SLOT_STATES[row.state].label(),
	},
	{
		id: "dates",
		header: m.pd_admin_col_dates,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: dates,
		csv: dates,
	},
	{
		id: "tagline",
		header: m.pd_admin_billboard_tagline,
		hideable: true,
		cellClassName: "max-w-72 truncate text-muted-foreground text-sm",
		cell: (row) => localizedValue(row.tagline) || m.pd_admin_billboard_tagline_tmdb(),
		csv: (row) => row.tagline.en,
	},
];

/** "New slot", starting on the page being looked at. */
function NewSlotButton({ page }: { page: PardaPage }) {
	if (!useCan("parda:curate")) return null;
	return (
		<Button asChild>
			<Link to="/admin/parda/billboard/new" search={{ page }}>
				<PlusIcon aria-hidden />
				{m.pd_admin_billboard_new()}
			</Link>
		</Button>
	);
}

export function PardaBillboardPending() {
	return (
		<CrudListPending
			title={m.pd_admin_billboard_title()}
			description={m.pd_admin_billboard_description()}
			columns={columns.length}
		/>
	);
}

/**
 * /admin/parda/billboard (PLAN Task 69, decision 0242): a page's slots in order, each with
 * its dates. Live slots lead that page's billboard; the page's rail fills what's left.
 */
export function PardaBillboardPage() {
	const { page } = route.useSearch();
	const { data } = useSuspenseQuery(pardaBillboardsQueryOptions());
	const rows = data.filter((row) => row.page === page);
	const canCurate = useCan("parda:curate");
	const [reordering, setReordering] = useState(false);
	const remove = useCrudMutation(pardaAdminMutations.deleteBillboards(), {
		invalidate: [pardaAdminKeys.all],
		optimistic: {
			queryKey: pardaAdminKeys.billboards(),
			update: (list: AdminBillboard[], ids: string[]) => list.filter((row) => !ids.includes(row.id)),
		},
	});
	const rowActions = (row: AdminBillboard): RowAction[] => [
		{
			id: "edit",
			label: m.crud_edit(),
			permission: "parda:curate",
			render: (label) => (
				<Link to="/admin/parda/billboard/$id" params={{ id: row.id }}>
					{label}
				</Link>
			),
		},
	];
	return (
		<CrudListPage
			title={m.pd_admin_billboard_title()}
			description={m.pd_admin_billboard_description()}
			actions={
				<>
					{canCurate && rows.length > 1 ? (
						<Button variant="outline" onClick={() => setReordering(true)} data-testid="parda-billboard-reorder">
							<ArrowDownUpIcon aria-hidden />
							{m.pd_admin_sources_reorder()}
						</Button>
					) : null}
					<NewSlotButton page={page} />
				</>
			}
			notice={
				<PageNav
					label={m.pd_admin_page_nav()}
					current={page}
					link={(value) => linkOptions({ to: "/admin/parda/billboard", search: { page: value } })}
				/>
			}
			tableId={BILLBOARD_TABLE_ID}
			list={{ rows }}
			columns={columns}
			getRowLabel={titleText}
			rowActions={rowActions}
			remove={{
				permission: "parda:curate",
				run: (ids) => remove.mutateAsync(ids),
				description: m.pd_admin_billboard_delete_body,
			}}
			empty={{ description: m.pd_admin_billboard_empty(), action: <NewSlotButton page={page} /> }}
			exportName="parda-billboard"
			data-testid="parda-billboard-table"
		>
			{reordering ? (
				<Suspense fallback={null}>
					<ReorderBillboardDialog page={page} slots={rows} onClose={() => setReordering(false)} />
				</Suspense>
			) : null}
		</CrudListPage>
	);
}
