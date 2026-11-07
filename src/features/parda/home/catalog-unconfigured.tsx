import { m } from "@/paraglide/messages";

/**
 * What a catalogue page shows without TMDB_READ_TOKEN (PLAN 12.5): an unlit screen
 * between the masks with one line of subtitle, and the owner's next step under it.
 */
export function CatalogUnconfigured() {
	return (
		<div data-testid="parda-unconfigured">
			<div className="relative aspect-2/3 w-full bg-pd-ground-2 md:aspect-[2.39/1]">
				<p className="pd-scrim absolute inset-x-0 bottom-0 flex h-22 items-center justify-center px-6 text-center text-pd-sub text-pd-subtitle">
					{m.pd_catalog_unconfigured()}
				</p>
			</div>
			<div className="bg-pd-mask px-4 pt-6 pb-10 sm:px-6 lg:px-8">
				<p className="max-w-prose text-pd-muted">{m.pd_catalog_unconfigured_detail()}</p>
			</div>
		</div>
	);
}
