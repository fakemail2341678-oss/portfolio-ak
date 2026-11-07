import { useState } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusOf } from "@/components/data-display/status-badge";
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
import { m } from "@/paraglide/messages";
import type { PardaPage } from "../../search";
import { pardaAdminKeys } from "../keys";
import { SLOT_STATES } from "../labels";
import { pardaAdminMutations } from "../queries";
import type { AdminBillboard } from "../schema";
import { titleText } from "../title-cell";

/** A page's slots in order, by drag or the keyboard; saving sends the whole order. */
export function ReorderBillboardDialog({
	page,
	slots,
	onClose,
}: {
	page: PardaPage;
	slots: ReadonlyArray<AdminBillboard>;
	onClose: () => void;
}) {
	const [order, setOrder] = useState<ReadonlyArray<AdminBillboard> | null>(null);
	const items = order ?? slots;
	const save = useCrudMutation(pardaAdminMutations.reorderBillboards(), { invalidate: [pardaAdminKeys.all] });
	const submit = () => {
		if (!order) return onClose();
		save.mutate(
			{ page, ids: order.map((item) => item.id) },
			{
				onSuccess: () => {
					toast.success(m.pd_admin_billboard_reorder_saved());
					onClose();
				},
			},
		);
	};
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0" data-testid="reorder-dialog">
				<DialogHeader className="border-b px-6 py-4 pe-12">
					<DialogTitle>{m.pd_admin_billboard_reorder_title()}</DialogTitle>
					<DialogDescription>{m.pd_admin_billboard_reorder_description()}</DialogDescription>
				</DialogHeader>
				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
					<SortableList
						items={items}
						getId={(item) => item.id}
						getLabel={titleText}
						onMove={(from, to) => setOrder(moveItem(items, from, to))}
						renderItem={(item, index, handle) => (
							<div className="flex items-center gap-3 rounded-md border bg-card p-2">
								{handle}
								<span className="w-6 text-end text-muted-foreground text-sm tabular-nums">{index + 1}</span>
								<span className="min-w-0 flex-1 truncate font-medium">{titleText(item)}</span>
								<StatusOf status={item.state} map={SLOT_STATES} />
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
