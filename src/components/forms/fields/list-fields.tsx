import { ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useFieldContext } from "../contexts";
import { type FieldBaseProps, FieldLabelText, FieldMessages, useFieldA11y } from "../field-shell";
import { fieldDomId, useFormMeta } from "../form-meta";
import { SortableList } from "./sortable-list";

/**
 * Fields whose value is an array: add, remove and reorder (SortableList: drag, keyboard
 * drag or Alt + ↑/↓). Render them inside `form.AppField`; they are not registered on
 * `useAppForm` (decision 0168), so pages that don't use them don't load dnd-kit.
 */

/** Stable React keys for the entries of an array value that has no ids of its own. */
function useEntryKeys(length: number) {
	const keys = useRef<string[]>([]);
	const next = useRef(0);
	const make = () => `entry-${next.current++}`;
	while (keys.current.length < length) keys.current.push(make());
	if (keys.current.length > length) keys.current.length = length;
	return {
		keys: keys.current,
		move: (from: number, to: number) => {
			const [key] = keys.current.splice(from, 1);
			if (key) keys.current.splice(to, 0, key);
		},
		remove: (index: number) => keys.current.splice(index, 1),
	};
}

type ArrayShellProps = FieldBaseProps & {
	children: ReactNode;
	footer?: ReactNode;
	/** The element FormErrorSummary focuses (the add button). */
	focusSuffix?: string;
};

/** A fieldset with the label as its legend, the entries, an add control and the messages. */
function ArrayShell({ label, description, optional, children, footer, focusSuffix = "add" }: ArrayShellProps) {
	const a11y = useFieldA11y(label, { focusId: (id) => `${id}-${focusSuffix}` });
	return (
		<fieldset
			className="flex min-w-0 flex-col gap-3"
			aria-describedby={a11y.describedBy(Boolean(description))}
			aria-invalid={a11y.invalid || undefined}
			data-invalid={a11y.invalid || undefined}
		>
			<legend className="mb-1 font-medium text-sm">
				<FieldLabelText label={label} optional={optional} />
			</legend>
			{children}
			{footer}
			<FieldMessages
				descriptionId={a11y.descriptionId}
				description={description}
				errorId={a11y.errorId}
				errors={a11y.errors}
			/>
		</fieldset>
	);
}

/** The field's DOM id (as useFieldA11y makes it), without registering it a second time. */
function useFieldId() {
	const field = useFieldContext<unknown>();
	return fieldDomId(useFormMeta().id, field.name);
}

// ---------------------------------------------------------------------------
// SortableListField: any array, each entry rendered by the caller
// ---------------------------------------------------------------------------

export type SortableListFieldProps<T> = FieldBaseProps & {
	/** A new, empty entry for "Add". */
	newItem: () => T;
	addLabel: string;
	/** The entry's name for the handle and announcements (default "Item 2"). */
	getItemLabel?: (item: T, index: number) => string;
	/**
	 * One entry's fields. `name` is its path in the form (`links[2]`): render
	 * `<form.AppField name={`${name}.url`}>` for each of its fields.
	 */
	renderItem: (entry: { item: T; index: number; name: string }) => ReactNode;
	max?: number;
};

export function SortableListField<T>({
	label,
	description,
	optional,
	newItem,
	addLabel,
	getItemLabel,
	renderItem,
	max,
}: SortableListFieldProps<T>) {
	const field = useFieldContext<T[]>();
	const items = field.state.value ?? [];
	const entries = useEntryKeys(items.length);
	const addId = `${useFieldId()}-add`;
	const itemLabel = (item: T, index: number) =>
		getItemLabel?.(item, index) || m.list_field_item({ n: formatNumber(index + 1) });
	return (
		<ArrayShell
			label={label}
			description={description}
			optional={optional}
			footer={
				<AddButton
					id={addId}
					label={addLabel}
					disabled={max !== undefined && items.length >= max}
					onClick={() => field.pushValue(newItem() as never)}
				/>
			}
		>
			{items.length > 0 ? (
				<SortableList
					items={items.map((item, index) => ({ item, key: entries.keys[index] ?? String(index) }))}
					getId={(entry) => entry.key}
					getLabel={(entry, index) => itemLabel(entry.item, index)}
					onMove={(from, to) => {
						entries.move(from, to);
						field.moveValue(from, to);
					}}
					renderItem={(entry, index, handle) => (
						<div className="flex items-start gap-2 rounded-md border bg-card p-2">
							{handle}
							<div className="flex min-w-0 flex-1 flex-col gap-3">
								{renderItem({ item: entry.item, index, name: `${field.name}[${index}]` })}
							</div>
							<RemoveButton
								label={itemLabel(entry.item, index)}
								onClick={() => {
									entries.remove(index);
									field.removeValue(index);
								}}
							/>
						</div>
					)}
				/>
			) : null}
		</ArrayShell>
	);
}

function AddButton({
	id,
	label,
	disabled,
	onClick,
}: {
	id: string;
	label: string;
	disabled?: boolean;
	onClick: () => void;
}) {
	return (
		<Button
			id={id}
			type="button"
			variant="outline"
			size="sm"
			className="self-start"
			disabled={disabled}
			onClick={onClick}
		>
			<PlusIcon aria-hidden />
			{label}
		</Button>
	);
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label={m.list_field_remove({ item: label })}
			className="text-muted-foreground"
			onClick={onClick}
		>
			<Trash2Icon aria-hidden />
		</Button>
	);
}

// ---------------------------------------------------------------------------
// BlocksField: a typed list of content blocks, a subform per block type
// ---------------------------------------------------------------------------

/** A block: a discriminated union on `type`, with a stable `id` (React key, drag id). */
export type Block = { id: string; type: string };

export type BlockType<B extends Block> = {
	label: () => string;
	icon?: ReactNode;
	/** A new block of this type, with its id. */
	create: () => B;
	/** A one-line summary for the collapsed header ("Heading: Why we did it"). */
	summary?: (block: B) => string;
	/** The block's fields; `name` is its path (`body[3]`), as in SortableListField. */
	render: (entry: { block: B; index: number; name: string }) => ReactNode;
};

export type BlocksFieldProps<B extends Block> = FieldBaseProps & {
	/** Every type a block may have, keyed by `type`. */
	types: { [K in B["type"]]: BlockType<Extract<B, { type: K }>> };
	max?: number;
};

export function BlocksField<B extends Block>({ label, description, optional, types, max }: BlocksFieldProps<B>) {
	const field = useFieldContext<B[]>();
	const blocks = field.state.value ?? [];
	const addId = `${useFieldId()}-add`;
	const typeOf = (block: B) => types[block.type as B["type"]] as unknown as BlockType<B>;
	const blockLabel = (block: B, index: number) =>
		m.blocks_field_block({ n: formatNumber(index + 1), type: typeOf(block).label() });
	const full = max !== undefined && blocks.length >= max;
	return (
		<ArrayShell
			label={label}
			description={description}
			optional={optional}
			footer={
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button id={addId} type="button" variant="outline" size="sm" className="self-start" disabled={full}>
							<PlusIcon aria-hidden />
							{m.blocks_field_add()}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{(Object.keys(types) as B["type"][]).map((type) => {
							const blockType = types[type] as unknown as BlockType<B>;
							return (
								<DropdownMenuItem key={type} onSelect={() => field.pushValue(blockType.create() as never)}>
									{blockType.icon}
									{blockType.label()}
								</DropdownMenuItem>
							);
						})}
					</DropdownMenuContent>
				</DropdownMenu>
			}
		>
			{blocks.length === 0 ? <p className="text-caption text-muted-foreground">{m.blocks_field_empty()}</p> : null}
			{blocks.length > 0 ? (
				<SortableList
					items={blocks}
					getId={(block) => block.id}
					getLabel={blockLabel}
					onMove={(from, to) => field.moveValue(from, to)}
					renderItem={(block, index, handle) => {
						const blockType = typeOf(block);
						return (
							<Collapsible defaultOpen className="group/block rounded-md border bg-card">
								<div className="flex items-center gap-1 p-1.5">
									{handle}
									<CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-start text-body outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0">
										{blockType.icon}
										<span className="font-medium">{blockType.label()}</span>
										{blockType.summary ? (
											<span className="truncate text-muted-foreground">{blockType.summary(block)}</span>
										) : null}
										<ChevronDownIcon
											aria-hidden
											className="ms-auto text-muted-foreground transition-transform group-data-[state=closed]/block:-rotate-90"
										/>
									</CollapsibleTrigger>
									<RemoveButton label={blockLabel(block, index)} onClick={() => field.removeValue(index)} />
								</div>
								{/* Kept mounted when collapsed: its fields still validate and appear in the error summary. */}
								<CollapsibleContent forceMount className="border-t p-3 data-[state=closed]:hidden">
									<div className="flex flex-col gap-4">
										{blockType.render({ block, index, name: `${field.name}[${index}]` })}
									</div>
								</CollapsibleContent>
							</Collapsible>
						);
					}}
				/>
			) : null}
		</ArrayShell>
	);
}

// ---------------------------------------------------------------------------
// KeyValueField: name/value pairs (metadata, headers, links)
// ---------------------------------------------------------------------------

export type KeyValue = { key: string; value: string };

export function KeyValueField({
	label,
	description,
	optional,
	keyLabel,
	valueLabel,
	max,
}: FieldBaseProps & { keyLabel: string; valueLabel: string; max?: number }) {
	const field = useFieldContext<KeyValue[]>();
	const pairs = field.state.value ?? [];
	const entries = useEntryKeys(pairs.length);
	const addId = `${useFieldId()}-add`;
	const fieldId = useFieldId();
	const update = (index: number, patch: Partial<KeyValue>) => {
		const current = pairs[index];
		if (current) field.replaceValue(index, { ...current, ...patch });
	};
	const pairLabel = (pair: KeyValue, index: number) => pair.key || m.list_field_item({ n: formatNumber(index + 1) });
	return (
		<ArrayShell
			label={label}
			description={description}
			optional={optional}
			footer={
				<AddButton
					id={addId}
					label={m.key_value_add()}
					disabled={max !== undefined && pairs.length >= max}
					onClick={() => field.pushValue({ key: "", value: "" })}
				/>
			}
		>
			{pairs.length > 0 ? (
				<SortableList
					items={pairs.map((pair, index) => ({ pair, key: entries.keys[index] ?? String(index) }))}
					getId={(entry) => entry.key}
					getLabel={(entry, index) => pairLabel(entry.pair, index)}
					onMove={(from, to) => {
						entries.move(from, to);
						field.moveValue(from, to);
					}}
					renderItem={(entry, index, handle) => {
						const id = `${fieldId}-${entry.key}`;
						const n = formatNumber(index + 1);
						return (
							<div className="flex items-center gap-2">
								{handle}
								<div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
									<Input
										id={`${id}-key`}
										aria-label={`${keyLabel} ${n}`}
										placeholder={keyLabel}
										value={entry.pair.key}
										onChange={(event) => update(index, { key: event.target.value })}
										onBlur={field.handleBlur}
										className={cn("font-mono")}
									/>
									<Input
										id={`${id}-value`}
										aria-label={`${valueLabel} ${n}`}
										placeholder={valueLabel}
										value={entry.pair.value}
										onChange={(event) => update(index, { value: event.target.value })}
										onBlur={field.handleBlur}
									/>
								</div>
								<RemoveButton
									label={pairLabel(entry.pair, index)}
									onClick={() => {
										entries.remove(index);
										field.removeValue(index);
									}}
								/>
							</div>
						);
					}}
				/>
			) : null}
		</ArrayShell>
	);
}
