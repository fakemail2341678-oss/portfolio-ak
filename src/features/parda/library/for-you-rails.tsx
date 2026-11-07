import { useQuery } from "@tanstack/react-query";
import { Rail, RailItem } from "@/components/data-display/rail";
import { sessionQueryOptions } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { HEADING, POSTER_ITEM, POSTER_SIZES, toPosterItem } from "../home/title-rails";
import { BackdropCard, PosterCard } from "../kit/cards";
import { tmdbImage } from "../kit/image";
import { pardaLinks } from "../links";
import { episodeRangeLabel } from "../schedule/labels";
import type { NewEpisodeItem } from "../schedule/types";
import { pardaForYouQueryOptions } from "./queries";
import { CardListToggle } from "./save-buttons";
import type { LibraryTitle } from "./types";

/**
 * The home's personal rails (PLAN Task 67, decision 0240): New episodes (Task 68, decision
 * 0241), "Because you liked …" and "New from people you love". The loader awaited them for
 * a session, so they render with the page; without a session, or with nothing to show,
 * there are none.
 */

function PersonalRail({
	title,
	titles,
	imageBase,
	testId,
}: {
	title: string;
	titles: ReadonlyArray<LibraryTitle>;
	imageBase: string;
	testId: string;
}) {
	return (
		<Rail title={title} titleClassName={HEADING} data-testid={testId}>
			{titles.map((each) => (
				<RailItem key={`${each.media}:${each.id}`} className={POSTER_ITEM}>
					<PosterCard
						item={toPosterItem(each, imageBase)}
						link={pardaLinks.title(each.media, each.id, each.slug)}
						sizes={POSTER_SIZES}
						action={<CardListToggle title={{ media: each.media, id: each.id, title: each.title }} />}
					/>
				</RailItem>
			))}
		</Rail>
	);
}

/** New episodes of followed series (decision 0241): each opens the watch page at the first new one. */
function NewEpisodesRail({ items, imageBase }: { items: ReadonlyArray<NewEpisodeItem>; imageBase: string }) {
	return (
		<Rail title={m.pd_rail_new_episodes()} titleClassName={HEADING} data-testid="new-episodes-rail">
			{items.map((item) => (
				<RailItem key={item.id} className="w-64 lg:w-80">
					<BackdropCard
						title={item.title}
						detail={m.pd_inbox_new({ episodes: episodeRangeLabel(item) })}
						backdrop={tmdbImage(imageBase, item.backdrop, "backdrop")}
						link={pardaLinks.watch("tv", item.id, item.slug, { season: item.season, episode: item.episode })}
					/>
				</RailItem>
			))}
		</Rail>
	);
}

export function ForYouRails() {
	const { data: session } = useQuery(sessionQueryOptions());
	const { data } = useQuery({ ...pardaForYouQueryOptions(getLocale()), enabled: Boolean(session) });
	if (!session || !data) return null;
	return (
		<>
			{data.episodes ? <NewEpisodesRail items={data.episodes} imageBase={data.imageBase} /> : null}
			{data.because ? (
				<PersonalRail
					title={m.pd_rail_because({ title: data.because.title })}
					titles={data.because.titles}
					imageBase={data.imageBase}
					testId="because-rail"
				/>
			) : null}
			{data.people ? (
				<PersonalRail title={m.pd_rail_people()} titles={data.people} imageBase={data.imageBase} testId="people-rail" />
			) : null}
		</>
	);
}
