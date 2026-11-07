import { XIcon } from "lucide-react";
import { SearchLink, type SearchPatch } from "@/components/navigation/search-link";
import { Button } from "@/components/ui/button";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";

/** One applied filter: its readable label ("Status: Draft") and the search change that removes it. */
export type FilterChip = { id: string; label: string; remove: SearchPatch };

/** A chip's text: "Price: 100 – 500", "Price: from 100", "Published: up to 1 Sep 2026". */
export const chipLabel = (label: string, value: string) => m.filters_chip({ label, value });

/** The value part for a range; undefined when neither end is set. */
export function rangeValue(from: string | undefined, to: string | undefined): string | undefined {
	if (from !== undefined && to !== undefined) return m.filters_range_between({ from, to });
	if (from !== undefined) return m.filters_range_from({ value: from });
	if (to !== undefined) return m.filters_range_to({ value: to });
	return undefined;
}

/** A calendar day from the URL ("2026-09-01") as a chip shows it ("1 Sep 2026"); undefined when unset. */
export const dayValue = (value: string | undefined) =>
	value === undefined ? undefined : formatDate(isoDateInstant(value), { dateStyle: "medium" });

const chipClass =
	"inline-flex h-7 items-center gap-1 rounded-full border bg-muted/50 ps-3 pe-2 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * "Clear filters" as a button, for a list's empty state when filters hid every
 * row. A link (works without JavaScript); returns to page 1.
 *
 *   empty={<EmptyState description={…} primaryAction={filtered ? <ClearFiltersButton clearAll={CLEAR} /> : <NewButton />} />}
 */
export function ClearFiltersButton({ clearAll }: { clearAll: SearchPatch }) {
	return (
		<Button variant="outline" asChild>
			<SearchLink patch={{ ...clearAll, page: undefined }}>{m.filters_clear()}</SearchLink>
		</Button>
	);
}

/**
 * The filters currently applied, each removable, plus "Clear all". They are
 * links (SearchLink), so they work before hydration and without JavaScript.
 * Removing a filter also returns to page 1.
 */
export function ActiveFilters({ chips, clearAll }: { chips: ReadonlyArray<FilterChip>; clearAll: SearchPatch }) {
	if (chips.length === 0) return null;
	return (
		<div className="flex flex-wrap items-center gap-2" data-testid="active-filters">
			<span className="text-muted-foreground text-sm">{m.filters_active()}</span>
			<ul className="flex flex-wrap items-center gap-2">
				{chips.map((chip) => (
					<li key={chip.id}>
						<SearchLink
							patch={{ ...chip.remove, page: undefined }}
							className={chipClass}
							aria-label={m.filters_remove({ label: chip.label })}
						>
							{chip.label}
							<XIcon className="size-3.5 opacity-70" aria-hidden />
						</SearchLink>
					</li>
				))}
			</ul>
			<SearchLink
				patch={{ ...clearAll, page: undefined }}
				className="rounded-sm text-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				{m.filters_clear_all()}
			</SearchLink>
		</div>
	);
}
