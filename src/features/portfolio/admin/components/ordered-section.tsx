import { useSuspenseQuery } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { useCrudCollection, useLiveRows } from "@/components/crud/use-crud-collection";
import { crudFormKey } from "@/components/crud/use-crud-form";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { useConfirm } from "@/components/dialogs/use-confirm";
import { moveItem, SortableList } from "@/components/forms/fields/sortable-list";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/rbac/hooks/use-can";
import { type CrudCollectionOptions, deleteRows, updateRows } from "@/lib/crud/collection";
import { m } from "@/paraglide/messages";
import type { SectionRow } from "../collection";
import type { SectionQueries } from "../lib/sections";

/** What a section's sheet gets: the entry to edit (none: a new one) and how to close. */
export type SectionSheetProps<TItem> = { item?: TItem; onClose: () => void };

/**
 * One of the portfolio's ordered sections (experience, skills, process,
 * testimonials; decision 0176): its entries in display order, reordered by drag
 * (or Space, arrows, Space; Alt + ↑/↓ on a handle), each edited in a sheet. A
 * move saves at once and shows at once (rolled back if the server refuses).
 */
export function OrderedSection<TInput, TItem extends SectionRow>({
	title,
	description,
	queries,
	rows,
	label,
	detail,
	badge,
	addLabel,
	empty,
	Sheet,
	"data-testid": testId,
}: {
	title: string;
	description: string;
	queries: SectionQueries<TInput, TItem>;
	/** The section's collection (../collection.ts): a move or a delete changes it at once. */
	rows: CrudCollectionOptions<TItem>;
	/** The entry's name: its row's heading, its handle's label and the delete confirm. */
	label: (item: TItem) => string;
	/** A second line (a period, a summary). */
	detail?: (item: TItem) => ReactNode;
	/** A badge after the name (an unpublished testimonial). */
	badge?: (item: TItem) => ReactNode;
	addLabel: string;
	empty: string;
	Sheet: (props: SectionSheetProps<TItem>) => ReactNode;
	"data-testid"?: string;
}) {
	const { data: read } = useSuspenseQuery(queries.list());
	const collection = useCrudCollection(rows);
	// The entries as the collection has them, in its order: a move shows before the server answers.
	const items = [...useLiveRows(collection, read)].sort((a, b) => a.sortOrder - b.sortOrder);
	const canWrite = useCan("portfolio:write");
	const confirm = useConfirm();
	// The entry being edited, by id: read from the cache, so a reloaded newer version remounts the sheet (crudFormKey).
	const [editing, setEditing] = useState<{ id?: string } | null>(null);
	const editingItem = editing?.id ? items.find((item) => item.id === editing.id) : undefined;

	const reorder = useCrudMutation(queries.reorder(), {
		invalidate: [queries.keys.all],
		optimistic: (ids) => {
			for (const [index, id] of ids.entries()) {
				updateRows(collection, [id], (row) => {
					row.sortOrder = index;
				});
			}
		},
	});
	const remove = useCrudMutation(queries.delete(), {
		invalidate: [queries.keys.all],
		optimistic: (ids) => deleteRows(collection, ids),
	});

	const askDelete = async (item: TItem) => {
		const name = label(item);
		const confirmed = await confirm({
			destructive: true,
			title: m.crud_delete_title({ label: name }),
			description: m.crud_delete_body(),
			confirmLabel: m.crud_delete(),
		});
		if (!confirmed) return;
		remove.mutate([item.id], { onSuccess: () => toast.success(m.crud_toast_deleted({ label: name })) });
	};

	const add = canWrite ? (
		<Button onClick={() => setEditing({})}>
			<PlusIcon aria-hidden />
			{addLabel}
		</Button>
	) : null;

	return (
		<Page width="admin">
			<PageHeader title={title} description={description} actions={add} />
			{items.length === 0 ? (
				<EmptyState description={empty} primaryAction={add} data-testid="empty" />
			) : (
				<div data-testid={testId}>
					<SortableList
						items={items}
						getId={(item) => item.id}
						getLabel={(item) => label(item)}
						onMove={(from, to) => {
							if (canWrite) reorder.mutate(moveItem(items, from, to).map((item) => item.id));
						}}
						renderItem={(item, _index, handle) => (
							<div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
								{canWrite ? handle : null}
								<div className="flex min-w-0 flex-1 flex-col gap-0.5">
									<p className="flex flex-wrap items-center gap-2 font-medium">
										<span className="truncate">{label(item)}</span>
										{badge?.(item)}
									</p>
									{detail ? <div className="line-clamp-2 text-muted-foreground text-sm">{detail(item)}</div> : null}
								</div>
								{canWrite ? (
									<div className="flex shrink-0 gap-1">
										<Button
											variant="ghost"
											size="icon"
											aria-label={m.portfolio_admin_edit_named({ name: label(item) })}
											onClick={() => setEditing({ id: item.id })}
										>
											<PencilIcon aria-hidden />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											aria-label={m.portfolio_admin_delete_named({ name: label(item) })}
											onClick={() => void askDelete(item)}
										>
											<Trash2Icon aria-hidden />
										</Button>
									</div>
								) : null}
							</div>
						)}
					/>
				</div>
			)}
			{editing ? (
				<Sheet
					key={crudFormKey(editingItem)}
					{...(editingItem ? { item: editingItem } : {})}
					onClose={() => setEditing(null)}
				/>
			) : null}
		</Page>
	);
}
