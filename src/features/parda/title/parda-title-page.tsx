import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { CatalogUnconfigured } from "../home/catalog-unconfigured";
import { useTitleProgress } from "../library/title-progress";
import { pardaLinks } from "../links";
import { pardaTitleQueryOptions } from "../queries";
import { titleRouteParams } from "../search";
import { useRememberViewed } from "../search/recent";
import { Episodes, NewEpisodeBanner } from "./episodes";
import { Gallery } from "./gallery";
import { TitleHero } from "./title-hero";
import {
	CastRail,
	ExternalLinks,
	FranchiseBanner,
	INSET,
	KeyCrew,
	PosterRail,
	Reviews,
	TitleDetails,
	Videos,
	WhereToWatch,
} from "./title-sections";
import type { TitlePageData } from "./types";

const route = getRouteApi("/_parda/app/parda/$type/$id/");

function TitleContent({ data }: { data: Extract<TitlePageData, { configured: true }> }) {
	const { title, imageBase } = data;
	useRememberViewed({
		media: title.media,
		id: title.id,
		slug: title.slug,
		name: title.title,
		picture: title.poster,
		imageBase,
	});
	const progress = useTitleProgress(
		{ media: title.media, id: title.id, slug: title.slug },
		title.media === "tv"
			? {
					seasons: data.seasons.map((season) => ({ number: season.number, episodes: season.episodes })),
					latest: title.latest ? { season: title.latest.season, episode: title.latest.episode } : null,
				}
			: undefined,
	);
	return (
		<>
			<TitleHero
				title={title}
				imageBase={imageBase}
				playable={data.playable}
				progress={progress}
				videos={data.videos}
			/>
			<div className="flex flex-col gap-12 pt-8 pb-12">
				<section aria-label={m.pd_overview_heading()} className={INSET}>
					{title.overview ? (
						<p className="max-w-prose text-base leading-relaxed" data-testid="title-overview">
							{title.overview}
						</p>
					) : (
						<p className="text-pd-muted">{m.pd_title_no_overview()}</p>
					)}
				</section>
				{title.media === "tv" && data.seasons.length ? (
					<div className="flex flex-col gap-4">
						<NewEpisodeBanner latest={title.latest} today={data.today} />
						<Episodes
							title={{ media: title.media, id: title.id, slug: title.slug }}
							seasons={data.seasons}
							imageBase={imageBase}
							progress={progress.episodes}
							playable={data.playable}
						/>
					</div>
				) : null}
				<CastRail
					cast={data.cast}
					imageBase={imageBase}
					credits={pardaLinks.credits(title.media, title.id, title.slug)}
				/>
				<KeyCrew crew={data.crew} />
				<TitleDetails title={title} />
				<WhereToWatch providers={data.providers} imageBase={imageBase} />
				<Videos videos={data.videos} title={title.title} />
				<Gallery
					backdrops={data.gallery.backdrops}
					posters={data.gallery.posters}
					imageBase={imageBase}
					title={title.title}
					heading={m.pd_gallery_heading()}
				/>
				<FranchiseBanner collection={title.collection} imageBase={imageBase} />
				<PosterRail
					title={m.pd_more_like_this()}
					titles={data.recommendations}
					imageBase={imageBase}
					testId="title-recommendations"
				/>
				<PosterRail title={m.pd_similar()} titles={data.similar} imageBase={imageBase} testId="title-similar" />
				<Reviews reviews={data.reviews} />
				<ExternalLinks links={title.links} />
			</div>
		</>
	);
}

/**
 * A title's page (PLAN Task 63, decision 0235), in the plan's order: the hero and its
 * actions, the overview, a series' episodes, the cast and key crew, the details, where
 * to watch legally, videos and the gallery, the franchise, more like this and similar,
 * reviews and links. Progress and marks are Task 64's; My List, ♥ and Like arrive with Task 67.
 */
export function PardaTitlePage() {
	// The loader has already turned anything else into a 404.
	const params = titleRouteParams(route.useParams());
	const { data } = useSuspenseQuery(pardaTitleQueryOptions(getLocale(), params?.type ?? "movie", params?.id ?? 0));
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="parda-title">
			{data.configured ? (
				<TitleContent data={data} />
			) : (
				<>
					<h1 className="sr-only">{m.pd_catalog_unconfigured()}</h1>
					<CatalogUnconfigured />
				</>
			)}
		</main>
	);
}
