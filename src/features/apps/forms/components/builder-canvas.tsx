import { Accessibility, type DragEndEvent, type DragStartEvent } from "@dnd-kit/dom";
import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { AsteriskIcon, CircleAlertIcon, GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { FIELD_TYPES, type FieldType, FORM_FIELDS_MAX, type FormField } from "../fields";
import { FIELD_TYPE_INFO } from "../labels";

/**
 * The builder's palette and question list (decision 0195), in one dnd-kit provider so
 * a field type can be dragged from the palette into the list, at the place it is
 * dropped. Every way in works from the keyboard:
 * - a palette entry's button adds the type after the selected question (or at the end);
 * - its grip is a keyboard drag too: Space picks it up, the arrows move it, Space drops;
 * - a question's grip reorders it the same way, or Alt + ↑/↓ moves it one place at once.
 * The list only reports what happened (`onAdd`, `onMove`); the builder changes its draft.
 * Every change is announced in the page's language.
 */

const END_ZONE = "forms-end";
const PALETTE = "palette";
const FIELD = "field";

type PaletteData = { fieldType: FieldType };

export type BuilderCanvasProps = {
	fields: ReadonlyArray<FormField>;
	selectedId: string | null;
	/** Field ids with a problem to fix (from the last save). */
	invalid: ReadonlySet<string>;
	/** Adds a new field of `type`; at `index`, or after the selected one (the end when none is). */
	onAdd: (type: FieldType, index?: number) => FormField | null;
	onMove: (from: number, to: number) => void;
	onSelect: (id: string) => void;
	onRemove: (field: FormField) => void;
};

export function BuilderCanvas({ fields, selectedId, invalid, onAdd, onMove, onSelect, onRemove }: BuilderCanvasProps) {
	const [announcement, setAnnouncement] = useState("");
	const listLabel = useId();
	const total = formatNumber(fields.length);
	const full = fields.length >= FORM_FIELDS_MAX;
	const labelOf = (id: unknown) => fields.find((field) => field.id === id)?.label ?? "";
	const position = (index: number) => ({ position: formatNumber(index + 1), total });

	const add = (type: FieldType, index?: number) => {
		const field = onAdd(type, index);
		if (field) setAnnouncement(m.forms_added({ item: FIELD_TYPE_INFO[type].label() }));
	};
	const moveBy = (index: number, step: number) => {
		const to = index + step;
		const field = fields[index];
		if (!field || to < 0 || to >= fields.length) return;
		onMove(index, to);
		setAnnouncement(m.sortable_moved({ item: field.label, ...position(to) }));
	};

	const describe = (source: { id: unknown; type?: unknown; data?: unknown } | null) => {
		if (!source) return "";
		if (source.type === PALETTE) return FIELD_TYPE_INFO[(source.data as PaletteData).fieldType].label();
		return labelOf(source.id);
	};

	return (
		<DragDropProvider
			plugins={(defaults) => [
				...defaults,
				Accessibility.configure({
					screenReaderInstructions: { draggable: m.sortable_instructions() },
					announcements: {
						dragstart: ({ operation: { source } }: DragStartEvent) =>
							source ? m.forms_picked({ item: describe(source) }) : undefined,
						dragover: () => undefined,
						dragend: ({ operation: { source }, canceled }: DragEndEvent) =>
							source && canceled ? m.sortable_canceled({ item: describe(source) }) : undefined,
					},
				}),
			]}
			onDragEnd={({ operation: { source, target }, canceled }) => {
				if (canceled || !source) return;
				if (source.type === PALETTE) {
					if (!target || full) return;
					const index = target.id === END_ZONE ? fields.length : fields.findIndex((field) => field.id === target.id);
					if (index >= 0) add((source.data as PaletteData).fieldType, index);
					return;
				}
				if (!isSortable(source) || source.initialIndex === source.index) return;
				onMove(source.initialIndex, source.index);
				setAnnouncement(m.sortable_dropped({ item: labelOf(source.id), ...position(source.index) }));
			}}
		>
			<section aria-labelledby={`${listLabel}-palette`} className="flex flex-col gap-3" data-testid="forms-palette">
				<h2 id={`${listLabel}-palette`} className="font-medium text-body">
					{m.forms_palette_title()}
				</h2>
				<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
					{FIELD_TYPES.map((type) => (
						<PaletteItem key={type} type={type} disabled={full} onAdd={() => add(type)} />
					))}
				</ul>
				{full ? (
					<p className="text-caption text-muted-foreground">
						{m.forms_fields_full({ max: formatNumber(FORM_FIELDS_MAX) })}
					</p>
				) : null}
			</section>
			<section aria-labelledby={listLabel} className="flex min-w-0 flex-col gap-3" data-testid="forms-fields">
				<h2 id={listLabel} className="font-medium text-body">
					{m.forms_fields_title({ count: total })}
				</h2>
				<ol className="flex flex-col gap-2">
					{fields.map((field, index) => (
						<FieldCard
							key={field.id}
							field={field}
							index={index}
							selected={field.id === selectedId}
							invalid={invalid.has(field.id)}
							onSelect={() => onSelect(field.id)}
							onRemove={() => onRemove(field)}
							onKeyMove={(step) => moveBy(index, step)}
						/>
					))}
				</ol>
				<EndZone empty={fields.length === 0} />
			</section>
			<p className="sr-only" aria-live="polite" data-testid="forms-announcement">
				{announcement}
			</p>
		</DragDropProvider>
	);
}

function PaletteItem({ type, disabled, onAdd }: { type: FieldType; disabled: boolean; onAdd: () => void }) {
	const info = FIELD_TYPE_INFO[type];
	const data: PaletteData = { fieldType: type };
	const { ref, handleRef, isDragging } = useDraggable({
		id: `${PALETTE}-${type}`,
		type: PALETTE,
		data,
		disabled,
	});
	return (
		<li
			ref={ref}
			className={cn(
				"flex min-w-0 items-center gap-1 rounded-md border bg-surface-1 pe-1",
				isDragging && "opacity-80 shadow-lg",
			)}
		>
			<button
				ref={handleRef}
				type="button"
				disabled={disabled}
				aria-label={m.forms_palette_drag({ item: info.label() })}
				className="flex size-(--control-height) shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
			>
				<GripVerticalIcon className="size-4" aria-hidden />
			</button>
			<button
				type="button"
				onClick={onAdd}
				disabled={disabled}
				className="flex min-h-(--control-height) min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-start text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
				data-testid={`forms-add-${type}`}
			>
				<info.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
				<span className="min-w-0 truncate">{info.label()}</span>
				<span className="sr-only">{m.forms_palette_add_hint()}</span>
				<PlusIcon className="ms-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden />
			</button>
		</li>
	);
}

function FieldCard({
	field,
	index,
	selected,
	invalid,
	onSelect,
	onRemove,
	onKeyMove,
}: {
	field: FormField;
	index: number;
	selected: boolean;
	invalid: boolean;
	onSelect: () => void;
	onRemove: () => void;
	onKeyMove: (step: number) => void;
}) {
	const info = FIELD_TYPE_INFO[field.type];
	const { ref, handleRef, isDragging, isDropTarget } = useSortable({
		id: field.id,
		index,
		type: FIELD,
		accept: [FIELD, PALETTE],
	});
	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
		event.preventDefault();
		onKeyMove(event.key === "ArrowUp" ? -1 : 1);
	};
	return (
		<li
			ref={ref}
			className={cn(
				"flex min-w-0 items-center gap-1 rounded-lg border bg-surface-1 p-1 transition-shadow",
				selected && "border-primary ring-1 ring-primary",
				invalid && "border-destructive",
				isDropTarget && "border-dashed",
				isDragging && "z-10 opacity-80 shadow-lg",
			)}
			data-testid="forms-field"
		>
			<button
				ref={handleRef}
				type="button"
				aria-label={m.sortable_handle({ item: field.label })}
				aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
				onKeyDown={onKeyDown}
				className="flex size-(--control-height) shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
			>
				<GripVerticalIcon className="size-4" aria-hidden />
			</button>
			<button
				type="button"
				onClick={onSelect}
				aria-pressed={selected}
				className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-start outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
				data-testid="forms-field-select"
			>
				<info.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
				<span className="flex min-w-0 flex-col">
					<span className="flex min-w-0 items-center gap-1 font-medium text-sm">
						<span className="min-w-0 truncate">{field.label || m.forms_untitled()}</span>
						{field.required ? (
							<>
								<AsteriskIcon className="size-3 shrink-0 text-destructive" aria-hidden />
								<span className="sr-only">{m.forms_required_short()}</span>
							</>
						) : null}
					</span>
					<span className="text-caption text-muted-foreground">{info.label()}</span>
				</span>
				{invalid ? (
					<>
						<CircleAlertIcon className="ms-auto size-4 shrink-0 text-destructive" aria-hidden />
						<span className="sr-only">{m.forms_field_has_problem()}</span>
					</>
				) : null}
			</button>
			<button
				type="button"
				onClick={onRemove}
				aria-label={m.forms_remove_field({ item: field.label || m.forms_untitled() })}
				className="flex size-(--control-height) shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				<Trash2Icon className="size-4" aria-hidden />
			</button>
		</li>
	);
}

/** Where a palette entry dropped below the last question goes: the end. */
function EndZone({ empty }: { empty: boolean }) {
	const { ref, isDropTarget } = useDroppable({ id: END_ZONE, accept: PALETTE });
	return (
		<div
			ref={ref}
			className={cn(
				"flex min-h-16 items-center justify-center rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm",
				isDropTarget && "border-primary bg-primary/5 text-foreground",
			)}
		>
			{empty ? m.forms_drop_first() : m.forms_drop_here()}
		</div>
	);
}
