import { Accessibility, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/dom";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { GripVerticalIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/**
 * A reorderable list (dnd-kit's React package, decision 0170). Three ways to move an item, all from
 * its handle:
 * - drag it with a pointer (mouse, touch, pen);
 * - keyboard drag: Space picks it up, the arrow keys move it, Space drops, Escape cancels;
 * - Alt + ↑/↓ moves it one place at once.
 * Every move is announced in the page's language. The list is a plain <ol>, server-rendered
 * in order; dragging only starts after hydration.
 */
export type SortableListProps<T> = {
	items: ReadonlyArray<T>;
	getId: (item: T) => string;
	/** The item's name in announcements and the handle's label ("Move Image 2"). */
	getLabel: (item: T, index: number) => string;
	onMove: (from: number, to: number) => void;
	/** One item's content. Put `handle` where the grip should be (usually first). */
	renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
	layout?: "list" | "grid";
	className?: string;
	itemClassName?: string;
};

export function SortableList<T>({
	items,
	getId,
	getLabel,
	onMove,
	renderItem,
	layout = "list",
	className,
	itemClassName,
}: SortableListProps<T>) {
	const group = useId();
	const [announcement, setAnnouncement] = useState("");
	const total = formatNumber(items.length);
	const labelOf = (id: unknown) => {
		const index = items.findIndex((item) => getId(item) === id);
		const item = items[index];
		return item === undefined ? "" : getLabel(item, index);
	};
	const position = (index: number) => ({ position: formatNumber(index + 1), total });

	const moveBy = (index: number, step: number) => {
		const to = index + step;
		const item = items[index];
		if (!item || to < 0 || to >= items.length) return;
		onMove(index, to);
		setAnnouncement(m.sortable_moved({ item: getLabel(item, index), ...position(to) }));
	};

	return (
		<DragDropProvider
			plugins={(defaults) => [
				...defaults,
				Accessibility.configure({
					screenReaderInstructions: { draggable: m.sortable_instructions() },
					announcements: {
						dragstart: ({ operation: { source } }: DragStartEvent) =>
							source && isSortable(source)
								? m.sortable_picked({ item: labelOf(source.id), ...position(source.index) })
								: undefined,
						dragover: ({ operation: { source } }: DragOverEvent) =>
							source && isSortable(source)
								? m.sortable_moved({ item: labelOf(source.id), ...position(source.index) })
								: undefined,
						dragend: ({ operation: { source }, canceled }: DragEndEvent) => {
							if (!source || !isSortable(source)) return undefined;
							const item = labelOf(source.id);
							return canceled ? m.sortable_canceled({ item }) : m.sortable_dropped({ item, ...position(source.index) });
						},
					},
				}),
			]}
			onDragEnd={({ operation: { source }, canceled }) => {
				if (canceled || !source || !isSortable(source)) return;
				if (source.initialIndex !== source.index) onMove(source.initialIndex, source.index);
			}}
		>
			<ol className={cn(layout === "grid" ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-2", className)}>
				{items.map((item, index) => (
					<SortableItem
						key={getId(item)}
						id={getId(item)}
						index={index}
						group={group}
						label={getLabel(item, index)}
						onKeyMove={(step) => moveBy(index, step)}
						className={itemClassName}
					>
						{(handle) => renderItem(item, index, handle)}
					</SortableItem>
				))}
			</ol>
			<p className="sr-only" aria-live="polite">
				{announcement}
			</p>
		</DragDropProvider>
	);
}

function SortableItem({
	id,
	index,
	group,
	label,
	onKeyMove,
	className,
	children,
}: {
	id: string;
	index: number;
	group: string;
	label: string;
	onKeyMove: (step: number) => void;
	className?: string | undefined;
	children: (handle: ReactNode) => ReactNode;
}) {
	const { ref, handleRef, isDragging } = useSortable({ id, index, group });
	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
		event.preventDefault();
		onKeyMove(event.key === "ArrowUp" ? -1 : 1);
	};
	const handle = (
		<button
			ref={handleRef}
			type="button"
			aria-label={m.sortable_handle({ item: label })}
			aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
			onKeyDown={onKeyDown}
			className="flex size-(--control-height) shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
			data-testid="sortable-handle"
		>
			<GripVerticalIcon className="size-4" aria-hidden />
		</button>
	);
	return (
		<li
			ref={ref}
			className={cn("min-w-0 transition-shadow", isDragging && "z-10 opacity-80 shadow-lg", className)}
			data-dragging={isDragging || undefined}
		>
			{children(handle)}
		</li>
	);
}

/** Moves one entry of an array, returning a new array (for `onMove`). */
export const moveItem = <T,>(items: ReadonlyArray<T>, from: number, to: number): T[] => {
	const next = [...items];
	const [item] = next.splice(from, 1);
	if (item !== undefined) next.splice(to, 0, item);
	return next;
};
