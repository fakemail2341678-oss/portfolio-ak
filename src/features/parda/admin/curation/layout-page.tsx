import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, linkOptions } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusBadge } from "@/components/data-display/status-badge";
import { moveItem, SortableList } from "@/components/forms/fields/sortable-list";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCan } from "@/features/rbac/can";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { railLabel } from "../../home/rail-labels";
import type { PardaPage } from "../../search";
import { pardaAdminKeys } from "../keys";
import { pardaAdminMutations, pardaLayoutQueryOptions } from "../queries";
import type { AdminLayout, AdminLayoutRail } from "../schema";
import { PageNav } from "../segment-nav";

const route = getRouteApi("/_admin/admin/parda/layout");

const named = (rail: AdminLayoutRail) =>
	rail.collection ? localizedValue(rail.collection.name) : railLabel(rail.label);

function RailRow({
	rail,
	onToggle,
	handle,
	number,
}: {
	rail: AdminLayoutRail;
	onToggle?: ((visible: boolean) => void) | undefined;
	handle?: ReactNode;
	number: number;
}) {
	const name = named(rail);
	return (
		<div className="flex items-center gap-3 rounded-md border bg-card p-2" data-testid="parda-layout-rail">
			{handle}
			<span className="w-6 text-end text-muted-foreground text-sm tabular-nums">{number}</span>
			<span className="min-w-0 flex-1 truncate font-medium">{name}</span>
			{rail.collection ? (
				<StatusBadge tone={rail.collection.published ? "info" : "neutral"}>
					{rail.collection.published ? m.pd_admin_layout_collection() : m.pd_admin_collection_draft()}
				</StatusBadge>
			) : null}
			<Switch
				checked={rail.visible}
				disabled={!onToggle}
				aria-label={m.pd_admin_layout_show({ rail: name })}
				onCheckedChange={onToggle}
			/>
		</div>
	);
}

/** One page's rails: the order and the switches are this page's until saved. */
function LayoutEditor({ layout }: { layout: AdminLayout }) {
	const canCurate = useCan("parda:curate");
	const [rails, setRails] = useState<ReadonlyArray<AdminLayoutRail> | null>(null);
	const items = rails ?? layout.rails;
	const save = useCrudMutation(pardaAdminMutations.saveLayout(), { invalidate: [pardaAdminKeys.all] });
	const toggle = (key: string, visible: boolean) =>
		setRails(items.map((rail) => (rail.key === key ? { ...rail, visible } : rail)));
	const submit = () =>
		save.mutate(
			{ page: layout.page, rails: items.map(({ key, visible }) => ({ key, visible })) },
			{
				onSuccess: () => {
					toast.success(m.pd_admin_layout_saved());
					setRails(null);
				},
			},
		);
	if (!canCurate) {
		return (
			<ol className="flex flex-col gap-2">
				{items.map((rail, index) => (
					<li key={rail.key}>
						<RailRow rail={rail} number={index + 1} />
					</li>
				))}
			</ol>
		);
	}
	return (
		<div className="flex flex-col gap-4">
			<SortableList
				items={items}
				getId={(rail) => rail.key}
				getLabel={(rail) => named(rail)}
				onMove={(from, to) => setRails(moveItem(items, from, to))}
				renderItem={(rail, index, handle) => (
					<RailRow rail={rail} number={index + 1} handle={handle} onToggle={(visible) => toggle(rail.key, visible)} />
				)}
			/>
			<div className="flex items-center justify-end gap-2">
				<Button type="button" variant="ghost" disabled={!rails || save.isPending} onClick={() => setRails(null)}>
					{m.common_cancel()}
				</Button>
				<Button type="button" disabled={!rails || save.isPending} onClick={submit} data-testid="parda-layout-save">
					{save.isPending ? m.crud_saving() : m.crud_save()}
				</Button>
			</div>
		</div>
	);
}

/**
 * /admin/parda/layout (PLAN Task 69, decision 0242): which rails the home and each hub
 * show, in what order, published collections among them. Continue watching and the
 * personal rails aren't here: they stay on top of the home.
 */
export function PardaLayout({ page }: { page: PardaPage }) {
	const { data } = useSuspenseQuery(pardaLayoutQueryOptions(page));
	return (
		<Page width="admin" data-testid="parda-layout">
			<PageHeader title={m.pd_admin_layout_title()} description={m.pd_admin_layout_description()} />
			<PageNav
				label={m.pd_admin_page_nav()}
				current={page}
				link={(value) => linkOptions({ to: "/admin/parda/layout", search: { page: value } })}
			/>
			<LayoutEditor key={page} layout={data} />
		</Page>
	);
}

export function PardaLayoutPage() {
	const { page } = route.useSearch();
	return <PardaLayout page={page} />;
}
