import { cn } from "@/lib/utils";
import { toPosterItem } from "../home/title-rails";
import { PersonCard, PosterCard } from "../kit/cards";
import { tmdbImage } from "../kit/image";
import { CardListToggle } from "../library/save-buttons";
import { pardaLinks } from "../links";
import { departmentLabel } from "../title/labels";
import type { SearchHit } from "./types";

/** The grid's columns, and the widths its pictures are chosen for. */
const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";
const SIZES = "(min-width: 1024px) 15vw, (min-width: 768px) 22vw, (min-width: 640px) 30vw, 45vw";

/** Search's and Discover's results (Task 66): posters for titles, portraits for people, one grid. */
export function HitGrid({
	hits,
	imageBase,
	className,
	"data-testid": testId,
}: {
	hits: ReadonlyArray<SearchHit>;
	imageBase: string;
	className?: string;
	"data-testid"?: string;
}) {
	return (
		<ul className={cn(GRID, className)} data-testid={testId}>
			{hits.map((hit) => (
				<li key={`${hit.media}:${hit.id}`}>
					{hit.media === "person" ? (
						<PersonCard
							name={hit.name}
							role={hit.department ? departmentLabel(hit.department) : null}
							profile={tmdbImage(imageBase, hit.profile, "profile")}
							link={pardaLinks.person(hit.id)}
							sizes={SIZES}
						/>
					) : (
						<PosterCard
							item={toPosterItem(hit, imageBase)}
							link={pardaLinks.title(hit.media, hit.id, hit.slug)}
							sizes={SIZES}
							action={<CardListToggle title={{ media: hit.media, id: hit.id, title: hit.title }} />}
						/>
					)}
				</li>
			))}
		</ul>
	);
}
