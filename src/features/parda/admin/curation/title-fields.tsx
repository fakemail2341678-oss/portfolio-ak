import { useStore } from "@tanstack/react-form";
import { ChevronsUpDownIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useFieldContext } from "@/components/forms/contexts";
import { type FieldBaseProps, FieldShell } from "@/components/forms/field-shell";
import { AsyncOptionList, useAsyncOptions } from "@/components/forms/fields/async-combobox-field";
import type { FieldOption } from "@/components/forms/fields/choice-fields";
import { moveItem, SortableList } from "@/components/forms/fields/sortable-list";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatNumber } from "@/lib/i18n/intl";
import { type Localized, localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { pardaAdminKeys } from "../keys";
import { MEDIA_LABELS } from "../labels";
import { searchTitleOptions } from "../queries";
import { COLLECTION_MAX_TITLES, type PardaAdminMedia, parseTitleRef, type TitleOption } from "../schema";

/** A title as the picker lists it: its name and year, and under it its type and TMDB id. */
const toOption = (title: TitleOption): FieldOption => ({
	value: title.ref,
	label: title.year ? `${title.title} (${formatNumberPlain(title.year)})` : title.title,
	description: `${MEDIA_LABELS[title.media]()} · TMDB ${title.id}`,
});

const formatNumberPlain = (value: number) => formatNumber(value, { useGrouping: false });

/** A title the form starts with: named from the snapshot. */
export const savedOption = (saved: {
	media: PardaAdminMedia;
	tmdbId: number;
	title: Localized | null;
}): FieldOption => ({
	value: `${saved.media}:${saved.tmdbId}`,
	label: saved.title ? localizedValue(saved.title) : `${MEDIA_LABELS[saved.media]()} ${saved.tmdbId}`,
	description: `${MEDIA_LABELS[saved.media]()} · TMDB ${saved.tmdbId}`,
});

/** The picker's search: TMDB through the admin's function, takedowns gone. */
export const titleSearch = {
	queryKey: [...pardaAdminKeys.all, "title-picker"],
	search: async (query: string) => (query ? (await searchTitleOptions(query)).map(toOption) : []),
} as const;

/**
 * A collection's titles (PLAN Task 69): found with the picker, ordered by drag or the
 * keyboard, taken off with their button. Stores their refs ("movie:550") in order.
 */
export function TitleListField({
	label,
	description,
	selected,
}: Pick<FieldBaseProps, "label" | "description"> & { selected: ReadonlyArray<FieldOption> }) {
	const field = useFieldContext<string[]>();
	const [open, setOpen] = useState(false);
	const state = useAsyncOptions({ ...titleSearch, selected }, open);
	const values = useStore(field.store, (store) => store.value) ?? [];
	const full = values.length >= COLLECTION_MAX_TITLES;
	const named = (ref: string) => {
		const label = state.labelOf(ref);
		return label === ref ? `${MEDIA_LABELS[parseTitleRef(ref).media]()} ${parseTitleRef(ref).id}` : label;
	};
	const toggle = (ref: string) => {
		if (values.includes(ref)) field.handleChange(values.filter((item) => item !== ref));
		else if (!full) field.handleChange([...values, ref]);
		field.handleBlur();
	};
	return (
		<FieldShell
			label={label}
			description={description}
			after={
				values.length > 0 ? (
					<SortableList
						items={values}
						getId={(ref) => ref}
						getLabel={named}
						onMove={(from, to) => field.handleChange(moveItem(values, from, to))}
						renderItem={(ref, index, handle) => (
							<div className="flex items-center gap-3 rounded-md border bg-card p-2" data-testid="collection-title">
								{handle}
								<span className="w-6 text-end text-muted-foreground text-sm tabular-nums">
									{formatNumber(index + 1)}
								</span>
								<span className="min-w-0 flex-1 truncate font-medium">{named(ref)}</span>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={m.pd_admin_collection_remove_title({ title: named(ref) })}
									onClick={() => toggle(ref)}
								>
									<XIcon aria-hidden />
								</Button>
							</div>
						)}
						className="mt-1"
					/>
				) : null
			}
		>
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
							disabled={full}
							className="w-full justify-between font-normal"
						>
							<span className="flex items-center gap-2 text-muted-foreground">
								<PlusIcon className="size-4" aria-hidden />
								{full
									? m.pd_admin_collection_full({ max: formatNumber(COLLECTION_MAX_TITLES) })
									: m.pd_admin_collection_add_title()}
							</span>
							<ChevronsUpDownIcon className="opacity-50" aria-hidden />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start" aria-label={label}>
						<AsyncOptionList
							listId={`${control.id}-listbox`}
							state={state}
							searchPlaceholder={m.pd_admin_title_search()}
							isSelected={(ref) => values.includes(ref)}
							onSelect={toggle}
						/>
					</PopoverContent>
				</Popover>
			)}
		</FieldShell>
	);
}
