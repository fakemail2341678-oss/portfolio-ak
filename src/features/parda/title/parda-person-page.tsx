import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { UserRoundIcon } from "lucide-react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { CatalogUnconfigured } from "../home/catalog-unconfigured";
import { formatYear } from "../kit/cards";
import { tmdbImage } from "../kit/image";
import { TmdbImage } from "../kit/tmdb-image";
import { PersonHeartButton } from "../library/save-buttons";
import { pardaLinks } from "../links";
import { pardaPersonQueryOptions } from "../queries";
import { useRememberViewed } from "../search/recent";
import { departmentLabel } from "./labels";
import { formatTmdbDate } from "./title-hero";
import { ExternalLinks, INSET, PosterRail, roleOf } from "./title-sections";
import type { FilmographyEntry, PersonPageData } from "./types";

const route = getRouteApi("/_parda/app/parda/person/$id");

/** A filmography row: the year, the title (a link) and the part or job. Undated ones are still to come. */
function FilmographyRow({ entry }: { entry: FilmographyEntry }) {
	const role = roleOf({
		id: entry.id,
		name: entry.title,
		profile: null,
		role: entry.role,
		...(entry.episodes ? { episodes: entry.episodes } : {}),
	});
	return (
		<li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 border-pd-ground-2 border-b py-2 last:border-b-0">
			<span className="text-pd-muted text-sm tabular-nums">{entry.year ? formatYear(entry.year) : "—"}</span>
			<span className="flex min-w-0 flex-col">
				<Link
					{...pardaLinks.title(entry.media, entry.id, entry.slug)}
					className="w-fit font-medium text-sm underline-offset-4 hover:underline"
				>
					{entry.title}
				</Link>
				{role ? <span className="text-pd-muted text-xs">{role}</span> : null}
			</span>
		</li>
	);
}

function PersonContent({ data }: { data: Extract<PersonPageData, { configured: true }> }) {
	const { person, imageBase } = data;
	useRememberViewed({
		media: "person",
		id: person.id,
		slug: "",
		name: person.name,
		picture: person.profile,
		imageBase,
	});
	const facts = [
		person.knownFor ? m.pd_person_known_for_department({ department: departmentLabel(person.knownFor) }) : null,
		person.birthday
			? person.placeOfBirth
				? m.pd_person_born_in({ date: formatTmdbDate(person.birthday, "long"), place: person.placeOfBirth })
				: m.pd_person_born({ date: formatTmdbDate(person.birthday, "long") })
			: null,
		person.deathday ? m.pd_person_died({ date: formatTmdbDate(person.deathday, "long") }) : null,
	].filter((fact) => fact !== null);
	return (
		<>
			<header className={cn(INSET, "flex flex-col gap-5 bg-pd-mask pt-6 pb-6 sm:flex-row sm:items-end")}>
				<span className="w-32 shrink-0 sm:w-40">
					<TmdbImage
						image={tmdbImage(imageBase, person.profile, "profile")}
						alt=""
						aspect="poster"
						sizes="10rem"
						priority
						fallback={<UserRoundIcon aria-hidden className="size-12" />}
					/>
				</span>
				<div className="flex min-w-0 flex-col gap-2">
					<h1 className="pd-display text-balance text-pd-title leading-none [&:lang(ne)]:leading-[1.2]">
						{person.name}
					</h1>
					{facts.length ? (
						<ul className="flex flex-col gap-0.5 text-pd-muted text-sm" data-testid="person-facts">
							{facts.map((fact) => (
								<li key={fact}>{fact}</li>
							))}
						</ul>
					) : null}
					<PersonHeartButton id={person.id} name={person.name} />
				</div>
			</header>
			<div className="flex flex-col gap-12 pt-8 pb-12">
				<section aria-labelledby="person-biography" className={cn(INSET, "flex flex-col gap-3")}>
					<h2 id="person-biography" className="pd-display text-pd-head font-bold">
						{m.pd_person_biography()}
					</h2>
					<p className="max-w-prose whitespace-pre-line text-base leading-relaxed" data-testid="person-biography">
						{person.biography || m.pd_person_no_biography()}
					</p>
				</section>
				<PosterRail
					title={m.pd_person_known_for()}
					titles={data.knownFor}
					imageBase={imageBase}
					testId="person-known-for"
				/>
				{data.filmography.length ? (
					<section
						aria-labelledby="person-filmography"
						className={cn(INSET, "flex flex-col gap-6")}
						data-testid="person-filmography"
					>
						<h2 id="person-filmography" className="pd-display text-pd-head font-bold">
							{m.pd_person_filmography()}
						</h2>
						{data.filmography.map((group, index) => (
							<section
								key={group.department}
								aria-labelledby={`filmography-${index}`}
								className="flex max-w-3xl flex-col gap-1"
							>
								<h3 id={`filmography-${index}`} className="font-medium">
									{departmentLabel(group.department)}{" "}
									<span className="font-normal text-pd-muted text-sm">{formatNumber(group.entries.length)}</span>
								</h3>
								<ol>
									{group.entries.map((entry) => (
										<FilmographyRow key={`${entry.media}:${entry.id}`} entry={entry} />
									))}
								</ol>
							</section>
						))}
					</section>
				) : null}
				<ExternalLinks links={person.links} />
			</div>
		</>
	);
}

/** A person (PLAN Task 63): the biography, what they're known for, the filmography by department and year, links. */
export function PardaPersonPage() {
	const { id } = route.useParams();
	const { data } = useSuspenseQuery(pardaPersonQueryOptions(getLocale(), Number(id)));
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="parda-person">
			{data.configured ? (
				<PersonContent data={data} />
			) : (
				<>
					<h1 className="sr-only">{m.pd_catalog_unconfigured()}</h1>
					<CatalogUnconfigured />
				</>
			)}
		</main>
	);
}
