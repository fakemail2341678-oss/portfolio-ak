import { keepPreviousData, type QueryKey, useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useFieldContext } from "../contexts";
import { type FieldBaseProps, FieldShell } from "../field-shell";
import type { FieldOption } from "./choice-fields";

/**
 * Search on the server as you type: options come from `search(query)` (a server
 * function), debounced and cached by TanStack Query under `queryKey` + the query, so
 * reopening or typing a query again is instant. The list isn't filtered in the
 * browser (cmdk's filter is off): the server decides what matches.
 *
 * The value is the chosen option's `value` (an id). Its label comes from the options
 * seen so far, or from `selected` for a value the form starts with.
 */
export type AsyncSearch = {
	/** Cache key of this search, e.g. ["test-crud", "options"]. */
	queryKey: QueryKey;
	search: (query: string) => Promise<ReadonlyArray<FieldOption>>;
	/** Wait this long after the last keystroke (default 250 ms). */
	debounceMs?: number;
};

type AsyncProps = FieldBaseProps &
	AsyncSearch & {
		/** The options the form's initial value(s) refer to, so their labels show before any search. */
		selected?: ReadonlyArray<FieldOption>;
		placeholder?: string;
		searchPlaceholder?: string;
	};

/** The search results for what's typed, and a memory of every option's label seen so far. */
export function useAsyncOptions(
	{ queryKey, search, debounceMs = 250, selected = [] }: AsyncSearch & { selected?: ReadonlyArray<FieldOption> },
	open: boolean,
) {
	const [query, setQuery] = useState("");
	const debounced = useDebouncedValue(query.trim(), debounceMs);
	const results = useQuery({
		queryKey: [...queryKey, "search", debounced],
		queryFn: () => search(debounced),
		enabled: open,
		placeholderData: keepPreviousData,
		staleTime: 30_000,
	});
	const known = useRef(new Map<string, FieldOption>());
	for (const option of [...selected, ...(results.data ?? [])]) known.current.set(option.value, option);
	return {
		query,
		setQuery,
		options: results.data ?? [],
		// Typing ahead of the debounce counts as loading too, so "no results" never flashes.
		loading: results.isFetching || query.trim() !== debounced,
		labelOf: (value: string) => known.current.get(value)?.label ?? value,
	};
}

export function AsyncOptionList({
	listId,
	state,
	isSelected,
	onSelect,
	searchPlaceholder,
}: {
	listId: string;
	state: ReturnType<typeof useAsyncOptions>;
	isSelected: (value: string) => boolean;
	onSelect: (value: string) => void;
	searchPlaceholder?: string | undefined;
}) {
	const label = searchPlaceholder ?? m.combobox_search();
	return (
		<Command label={label} shouldFilter={false}>
			<CommandInput placeholder={label} value={state.query} onValueChange={state.setQuery} />
			<CommandList id={listId} aria-busy={state.loading || undefined}>
				{state.loading && state.options.length === 0 ? (
					<div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
						<Spinner aria-hidden />
						{m.combobox_searching()}
					</div>
				) : (
					<CommandEmpty>{m.combobox_empty()}</CommandEmpty>
				)}
				<CommandGroup>
					{state.options.map((option) => (
						<CommandItem
							key={option.value}
							value={option.value}
							disabled={option.disabled}
							onSelect={() => onSelect(option.value)}
						>
							<CheckIcon className={cn("size-4", isSelected(option.value) ? "opacity-100" : "opacity-0")} aria-hidden />
							<span className="flex min-w-0 flex-col">
								<span className="truncate">{option.label}</span>
								{option.description ? (
									<span className="truncate text-caption text-muted-foreground">{option.description}</span>
								) : null}
							</span>
						</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
		</Command>
	);
}

/** One choice from a server search. Stores the option's value ("" when empty). */
export function AsyncComboboxField({
	label,
	description,
	optional,
	placeholder,
	searchPlaceholder,
	...source
}: AsyncProps) {
	const field = useFieldContext<string>();
	const [open, setOpen] = useState(false);
	const state = useAsyncOptions(source, open);
	const value = field.state.value ?? "";
	return (
		<FieldShell label={label} description={description} optional={optional}>
			{(control) => (
				<Popover
					open={open}
					onOpenChange={(next) => {
						setOpen(next);
						if (!next) field.handleBlur();
					}}
				>
					<PopoverTrigger asChild>
						<Button
							{...control}
							type="button"
							variant="outline"
							role="combobox"
							aria-expanded={open}
							aria-controls={`${control.id}-listbox`}
							className="w-full justify-between font-normal"
						>
							<span className={cn("truncate", !value && "text-muted-foreground")}>
								{value ? state.labelOf(value) : (placeholder ?? m.select_placeholder())}
							</span>
							<ChevronsUpDownIcon className="opacity-50" aria-hidden />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start" aria-label={label}>
						<AsyncOptionList
							listId={`${control.id}-listbox`}
							state={state}
							searchPlaceholder={searchPlaceholder}
							isSelected={(option) => option === value}
							onSelect={(option) => {
								field.handleChange(option === value ? "" : option);
								field.handleBlur();
								setOpen(false);
							}}
						/>
					</PopoverContent>
				</Popover>
			)}
		</FieldShell>
	);
}

/**
 * Records of another feature, picked by searching them: a relation. `relation` says
 * how to search that feature (usually its own list server function, which checks its
 * read permission). `multiple` keeps several, as removable chips (string[]);
 * otherwise it is AsyncComboboxField (string).
 *
 *   const relatedTasks: Relation = { queryKey: ["tasks", "options"], search: (q) => searchTasks({ data: { q } }) };
 *   <form.AppField name="taskIds">{() => <RelationField label={…} relation={relatedTasks} multiple />}</form.AppField>
 */
export type Relation = AsyncSearch;

export function RelationField({
	relation,
	multiple = false,
	max,
	...props
}: Omit<AsyncProps, keyof AsyncSearch> & { relation: Relation; multiple?: boolean; max?: number }) {
	if (!multiple) return <AsyncComboboxField {...props} {...relation} />;
	return <MultiRelation {...props} {...relation} max={max} />;
}

function MultiRelation({
	label,
	description,
	optional,
	placeholder,
	searchPlaceholder,
	max,
	...source
}: AsyncProps & { max?: number | undefined }) {
	const field = useFieldContext<string[]>();
	const [open, setOpen] = useState(false);
	const state = useAsyncOptions(source, open);
	const values = field.state.value ?? [];
	const full = max !== undefined && values.length >= max;
	const toggle = (value: string) => {
		if (values.includes(value)) field.handleChange(values.filter((item) => item !== value));
		else if (!full) field.handleChange([...values, value]);
	};
	const chips =
		values.length > 0 ? (
			<ul className="flex flex-wrap gap-1.5" data-testid="relation-chips">
				{values.map((value) => (
					<li key={value}>
						<Badge variant="secondary" className="gap-1 pe-1">
							{state.labelOf(value)}
							<button
								type="button"
								className="rounded-sm p-0.5 outline-none hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring"
								aria-label={m.multiselect_remove({ label: state.labelOf(value) })}
								onClick={() => {
									toggle(value);
									field.handleBlur();
								}}
							>
								<XIcon className="size-3" aria-hidden />
							</button>
						</Badge>
					</li>
				))}
			</ul>
		) : null;
	return (
		<FieldShell label={label} description={description} optional={optional} after={chips}>
			{(control) => (
				<Popover
					open={open}
					onOpenChange={(next) => {
						setOpen(next);
						if (!next) field.handleBlur();
					}}
				>
					<PopoverTrigger asChild>
						<Button
							{...control}
							type="button"
							variant="outline"
							role="combobox"
							aria-expanded={open}
							aria-controls={`${control.id}-listbox`}
							className="w-full justify-between font-normal"
						>
							<span className={cn(values.length === 0 && "text-muted-foreground")}>
								{values.length > 0
									? m.multiselect_selected({ count: formatNumber(values.length) })
									: (placeholder ?? m.select_placeholder())}
							</span>
							<ChevronsUpDownIcon className="opacity-50" aria-hidden />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start" aria-label={label}>
						<AsyncOptionList
							listId={`${control.id}-listbox`}
							state={state}
							searchPlaceholder={searchPlaceholder}
							isSelected={(value) => values.includes(value)}
							onSelect={toggle}
						/>
					</PopoverContent>
				</Popover>
			)}
		</FieldShell>
	);
}
