import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusOf } from "@/components/data-display/status-badge";
import { errorMessage } from "@/components/errors/error-page";
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
import { Spinner } from "@/components/ui/spinner";
import { m } from "@/paraglide/messages";
import type { ProjectOrderItem } from "../../schema";
import { projectKeys } from "../keys";
import { PORTFOLIO_STATUS } from "../labels";
import { projectMutations, projectOrderQueryOptions } from "../queries";

/**
 * The projects' display order, by drag (or the keyboard: Space, arrows, Space;
 * Alt + ↑/↓ on a handle). The public pages show published projects in this
 * order; saving sends the whole order at once.
 */
export function ReorderProjectsDialog({ onClose }: { onClose: () => void }) {
	const { data, error } = useQuery(projectOrderQueryOptions());
	const [order, setOrder] = useState<ProjectOrderItem[] | null>(null);
	const items = order ?? data ?? [];
	const save = useCrudMutation(projectMutations.reorder(), { invalidate: [projectKeys.all] });

	const submit = () => {
		if (!order) return onClose();
		save.mutate(
			order.map((item) => item.id),
			{
				onSuccess: () => {
					toast.success(m.portfolio_admin_reorder_saved());
					onClose();
				},
			},
		);
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0" data-testid="reorder-dialog">
				<DialogHeader className="border-b px-6 py-4 pe-12">
					<DialogTitle>{m.portfolio_admin_reorder_title()}</DialogTitle>
					<DialogDescription>{m.portfolio_admin_reorder_description()}</DialogDescription>
				</DialogHeader>
				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
					{error ? (
						<p role="alert" className="text-destructive text-sm">
							{errorMessage(error)}
						</p>
					) : data ? (
						<SortableList
							items={items}
							getId={(item) => item.id}
							getLabel={(item) => item.title}
							onMove={(from, to) => setOrder(moveItem(items, from, to))}
							renderItem={(item, index, handle) => (
								<div className="flex items-center gap-3 rounded-md border bg-card p-2">
									{handle}
									<span className="w-6 text-end text-muted-foreground text-sm tabular-nums">{index + 1}</span>
									<span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
									<StatusOf status={item.status} map={PORTFOLIO_STATUS} />
								</div>
							)}
						/>
					) : (
						<output className="flex justify-center py-6">
							<Spinner />
						</output>
					)}
				</div>
				<DialogFooter className="border-t px-6 py-4">
					<Button type="button" variant="ghost" onClick={onClose}>
						{m.common_cancel()}
					</Button>
					<Button type="button" onClick={submit} disabled={!data || save.isPending}>
						{save.isPending ? m.crud_saving() : m.crud_save()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
