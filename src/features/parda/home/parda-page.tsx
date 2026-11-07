import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { PlayIcon, ShuffleIcon } from "lucide-react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { PARDA_NAME } from "../brand";
import { Billboard, type BillboardItem } from "../kit/billboard";
import { tmdbImage } from "../kit/image";
import { ContinueRail } from "../library/continue-rail";
import { ForYouRails } from "../library/for-you-rails";
import { ListButton } from "../library/save-buttons";
import { pardaLinks } from "../links";
import { pardaPageQueryOptions } from "../queries";
import { isPardaHub, type PardaPage } from "../search";
import { CatalogUnconfigured } from "./catalog-unconfigured";
import { hubTitle } from "./head";
import { StreamedRail, TitleRail } from "./title-rails";
import type { BillboardSlide, HubPageData } from "./types";

const toBillboardItem = (slide: BillboardSlide, imageBase: string): BillboardItem => ({
	key: `${slide.media}:${slide.id}`,
	title: slide.title,
	tagline: slide.tagline,
	year: slide.year,
	runtime: slide.runtime,
	seasons: slide.seasons,
	certification: slide.certification,
	rating: slide.rating,
	backdrop: tmdbImage(imageBase, slide.backdrop, "backdrop"),
	poster: tmdbImage(imageBase, slide.poster, "poster"),
});

function PageContent({ data }: { data: Extract<HubPageData, { configured: true }> }) {
	const slides = new Map(data.billboard.map((slide) => [`${slide.media}:${slide.id}`, slide]));
	return (
		<>
			{data.billboard.length ? (
				<Billboard
					items={data.billboard.map((slide) => toBillboardItem(slide, data.imageBase))}
					actions={(item) => {
						const slide = slides.get(item.key);
						if (!slide) return null;
						const ref = { media: slide.media, id: slide.id, title: slide.title };
						// Play when a source can start it (the title page's rule), else the title's page (0244).
						return (
							<>
								{slide.playable ? (
									<Button asChild size="lg">
										<Link {...pardaLinks.watch(slide.media, slide.id, slide.slug)} data-testid="billboard-play">
											<PlayIcon aria-hidden />
											{m.pd_action_play()}
											<span className="sr-only">: {slide.title}</span>
										</Link>
									</Button>
								) : (
									<Button asChild size="lg">
										<Link {...pardaLinks.title(slide.media, slide.id, slide.slug)} data-testid="billboard-details">
											{m.pd_billboard_details()}
											<span className="sr-only">: {slide.title}</span>
										</Link>
									</Button>
								)}
								<ListButton title={ref} />
								{/* A redirect to a random title: never preloaded, or hovering would pick one. */}
								<Button asChild size="lg" variant="ghost">
									<Link {...pardaLinks.surprise(data.page)} preload={false} data-testid="surprise-me">
										<ShuffleIcon aria-hidden />
										{/* Its icon alone on phones, so the slide's actions keep to one row in either language. */}
										<span className="max-sm:sr-only">{m.pd_surprise_me()}</span>
									</Link>
								</Button>
							</>
						);
					}}
				/>
			) : null}
			<div className="flex flex-col gap-10 pt-8 pb-12">
				{data.page === "home" ? <ContinueRail imageBase={data.imageBase} /> : null}
				{data.page === "home" ? <ForYouRails /> : null}
				{data.rails.map((rail) =>
					rail.titles === undefined ? (
						<StreamedRail key={rail.id} page={data.page} head={rail} />
					) : (
						<TitleRail key={rail.id} head={rail} titles={rail.titles} imageBase={data.imageBase} />
					),
				)}
			</div>
		</>
	);
}

/**
 * The home and each hub (PLAN Task 62): the billboard and the rails. The billboard and
 * the first two rails come with the page; the rest stream in behind skeletons of
 * their size, so nothing moves (CLS 0).
 */
function PardaPageView({ page }: { page: PardaPage }) {
	const { data } = useSuspenseQuery(pardaPageQueryOptions(getLocale(), page));
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid={`parda-page-${page}`}>
			{page === "home" ? (
				<h1 lang="en" className="sr-only">
					{PARDA_NAME}
				</h1>
			) : (
				<h1 className="sr-only">{hubTitle(page)}</h1>
			)}
			{data.configured ? <PageContent data={data} /> : <CatalogUnconfigured />}
		</main>
	);
}

export function PardaHome() {
	return <PardaPageView page="home" />;
}

const hubRoute = getRouteApi("/_parda/app/parda/$hub");

export function PardaHubPage() {
	// The loader has already turned anything but a hub into a 404.
	const { hub } = hubRoute.useParams();
	return <PardaPageView page={isPardaHub(hub) ? hub : "home"} />;
}
