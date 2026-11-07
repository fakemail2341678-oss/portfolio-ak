import { SearchFilter, SelectFilter } from "@/components/filters/filters";
import { choiceChip, defineFilters, textChip } from "@/lib/crud/filters";
import { m } from "@/paraglide/messages";
import { MEDIA_KINDS, MEDIA_USAGE_FILTERS, type MediaKind, type MediaUsageFilter } from "./constants";
import type { MediaSearch } from "./search";

/** Localized names of the media library's filter values, called at render time. */
export const KIND_LABELS: Record<MediaKind, () => string> = {
	all: m.media_kind_all,
	image: m.media_kind_image,
	document: m.media_kind_document,
};

export const USAGE_LABELS: Record<MediaUsageFilter, () => string> = {
	all: m.media_usage_all,
	used: m.media_usage_used,
	unused: m.media_usage_unused,
};

/** The library's filter controls (inside <FilterBar>). Names match mediaList's params. */
export function MediaFilterControls({ search }: { search: MediaSearch }) {
	return (
		<>
			<SearchFilter label={m.crud_search()} value={search.q} placeholder={m.media_search_placeholder()} />
			<SelectFilter
				name="kind"
				label={m.media_filter_kind()}
				value={search.kind}
				options={MEDIA_KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind]() }))}
			/>
			<SelectFilter
				name="usage"
				label={m.media_filter_usage()}
				value={search.usage}
				options={MEDIA_USAGE_FILTERS.map((usage) => ({ value: usage, label: USAGE_LABELS[usage]() }))}
			/>
		</>
	);
}

export const mediaFilters = defineFilters<MediaSearch>([
	textChip("q", m.crud_search),
	choiceChip("kind", m.media_filter_kind, (kind: MediaKind) => KIND_LABELS[kind]()),
	choiceChip("usage", m.media_filter_usage, (usage: MediaUsageFilter) => USAGE_LABELS[usage]()),
]);
