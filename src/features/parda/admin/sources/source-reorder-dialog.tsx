import { useState } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusBadge } from "@/components/data-display/status-badge";
import { moveItem, SortableList } from "@/components/forms/fields/sortable-list";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { pardaAdminKeys } from "../keys";
import { pardaAdminMutations } from "../queries";
import type { AdminSource } from "../schema";

/**
 * The sources' order, by drag (or the keyboard: Space, arrows, Space; Alt + ↑/↓ on a
 * handle). The watch page starts from the first enabled source, pinned rows first;
 * saving sends the whole order at once.
 */
export function ReorderSourcesDialog({
	sources,
	onClose,
}: {
	sources: ReadonlyArray<AdminSource>;
	onClose: () => void;
}) {
	const [order, setOrder] = useState<ReadonlyArray<AdminSource> | null>(null);
	const items = order ?? sources;
	const save = useCrudMutation(pardaAdminMutations.reorderSources(), { invalidate: [pardaAdminKeys.all] });

	const submit = () => {
		if (!order) return onClose();
		save.mutate(
			order.map((item) => item.id),
			{
				onSuccess: () => {
					toast.success(m.pd_admin_sources_reorder_saved());
					onClose();
				},
			},
		);
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0" data-testid="reorder-dialog">
				<DialogHeader className="border-b px-6 py-4 pe-12">
					<DialogTitle>{m.pd_admin_sources_reorder_title()}</DialogTitle>
					<DialogDescription>{m.pd_admin_sources_reorder_description()}</DialogDescription>
				</DialogHeader>
				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
					<SortableList
						items={items}
						getId={(item) => item.id}
						getLabel={(item) => localizedValue(item.name)}
						onMove={(from, to) => setOrder(moveItem(items, from, to))}
						renderItem={(item, index, handle) => (
							<div className="flex items-center gap-3 rounded-md border bg-card p-2">
								{handle}
								<span className="w-6 text-end text-muted-foreground text-sm tabular-nums">{index + 1}</span>
								<span className="min-w-0 flex-1 truncate font-medium">{localizedValue(item.name)}</span>
								{item.pinned ? <StatusBadge tone="info">{m.pd_admin_source_pinned()}</StatusBadge> : null}
								{item.enabled ? null : <StatusBadge tone="neutral">{m.pd_admin_source_disabled()}</StatusBadge>}
							</div>
						)}
					/>
				</div>
				<DialogFooter className="border-t px-6 py-4">
					<Button type="button" variant="ghost" onClick={onClose}>
						{m.common_cancel()}
					</Button>
					<Button type="button" onClick={submit} disabled={save.isPending}>
						{save.isPending ? m.crud_saving() : m.crud_save()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
