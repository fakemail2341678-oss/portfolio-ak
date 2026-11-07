import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { CatalogUnconfigured } from "../home/catalog-unconfigured";
import { POSTER_SIZES, toPosterItem } from "../home/title-rails";
import type { HubTitle } from "../home/types";
import { PosterCard } from "../kit/cards";
import { tmdbImage } from "../kit/image";
import { TmdbImage } from "../kit/tmdb-image";
import { CardListToggle } from "../library/save-buttons";
import { pardaLinks } from "../links";
import { pardaCollectionQueryOptions, pardaCuratedQueryOptions } from "../queries";
import { INSET } from "./title-sections";

const route = getRouteApi("/_parda/app/parda/collection/$id");
const curatedRoute = getRouteApi("/_parda/app/parda/c/$slug");

function CollectionContent({
	name,
	overview,
	backdrop,
	imageBase,
	parts,
	count,
	heading,
	numbered,
}: {
	name: string;
	overview: string;
	backdrop: string | null;
	imageBase: string;
	parts: ReadonlyArray<HubTitle>;
	count: string;
	heading: string;
	/** A franchise's films are parts; a curated list's titles are only in the admin's order. */
	numbered: boolean;
}) {
	return (
		<>
			<div className="bg-pd-mask">
				<div className="relative mx-auto w-full max-w-[max(24rem,calc((100dvh-16rem)*16/9))]">
					<TmdbImage
						image={tmdbImage(imageBase, backdrop, "backdrop")}
						alt=""
						label={name}
						aspect="backdrop"
						sizes="100vw"
						priority
					/>
				</div>
			</div>
			<header className={cn(INSET, "flex flex-col gap-2 bg-pd-mask pt-4 pb-6")}>
				<h1 className="pd-display text-balance text-pd-title leading-none [&:lang(ne)]:leading-[1.2]">{name}</h1>
				<p className="text-pd-muted text-sm">{count}</p>
			</header>
			<div className="flex flex-col gap-8 pt-8 pb-12">
				{overview ? <p className={cn(INSET, "max-w-prose text-base leading-relaxed")}>{overview}</p> : null}
				<section aria-labelledby="collection-parts" className={cn(INSET, "flex flex-col gap-4")}>
					<h2 id="collection-parts" className="pd-display text-pd-head font-bold">
						{heading}
					</h2>
					<ol
						className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
						data-testid="collection-parts"
					>
						{parts.map((part, index) => (
							<li key={`${part.media}:${part.id}`} className="flex flex-col gap-1">
								{numbered ? (
									<span className="text-pd-muted text-xs tabular-nums">
										{m.pd_collection_part({ number: formatNumber(index + 1) })}
									</span>
								) : null}
								<PosterCard
									item={toPosterItem(part, imageBase)}
									link={pardaLinks.title(part.media, part.id, part.slug)}
									sizes={POSTER_SIZES}
									action={<CardListToggle title={{ media: part.media, id: part.id, title: part.title }} />}
								/>
							</li>
						))}
					</ol>
				</section>
			</div>
		</>
	);
}

/** A franchise (PLAN Task 63): its titles in release order, the ones still to come last. */
export function PardaCollectionPage() {
	const { id } = route.useParams();
	const { data } = useSuspenseQuery(pardaCollectionQueryOptions(getLocale(), Number(id)));
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="parda-collection">
			{data.configured ? (
				<CollectionContent
					name={data.collection.name}
					overview={data.collection.overview}
					backdrop={data.collection.backdrop}
					imageBase={data.imageBase}
					parts={data.parts}
					count={m.pd_collection_count({ count: formatNumber(data.parts.length) })}
					heading={m.pd_collection_in_order()}
					numbered
				/>
			) : (
				<>
					<h1 className="sr-only">{m.pd_catalog_unconfigured()}</h1>
					<CatalogUnconfigured />
				</>
			)}
		</main>
	);
}

/** A collection the admin put together (decision 0242): its titles in the admin's order. */
export function PardaCuratedPage() {
	const { slug } = curatedRoute.useParams();
	const { data } = useSuspenseQuery(pardaCuratedQueryOptions(getLocale(), slug));
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="parda-curated">
			{data.configured ? (
				<CollectionContent
					name={data.collection.name}
					overview={data.collection.description}
					backdrop={data.collection.backdrop}
					imageBase={data.imageBase}
					parts={data.parts}
					count={m.pd_curated_count({ count: formatNumber(data.parts.length) })}
					heading={m.pd_curated_titles()}
					numbered={false}
				/>
			) : (
				<>
					<h1 className="sr-only">{m.pd_catalog_unconfigured()}</h1>
					<CatalogUnconfigured />
				</>
			)}
		</main>
	);
}
