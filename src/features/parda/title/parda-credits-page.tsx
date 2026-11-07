import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { CatalogUnconfigured } from "../home/catalog-unconfigured";
import { formatYear } from "../kit/cards";
import { tmdbImage } from "../kit/image";
import { TmdbImage } from "../kit/tmdb-image";
import { pardaLinks } from "../links";
import { pardaCreditsQueryOptions } from "../queries";
import { titleRouteParams } from "../search";
import { departmentLabel } from "./labels";
import { INSET, roleOf } from "./title-sections";
import type { CreditPerson, CreditsPageData } from "./types";

const route = getRouteApi("/_parda/app/parda/$type/$id/credits");

/** One person on the list: a small portrait, the name (a link) and the part or jobs. */
function PersonRow({ person, imageBase }: { person: CreditPerson; imageBase: string }) {
	const role = roleOf(person);
	return (
		<li>
			<Link
				{...pardaLinks.person(person.id)}
				className="group flex items-center gap-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-pd-ground"
			>
				<span className="w-12 shrink-0">
					<TmdbImage
						image={tmdbImage(imageBase, person.profile, "profile")}
						alt=""
						aspect="poster"
						sizes="3rem"
						fallback={
							<span aria-hidden className="text-xs">
								{person.name.slice(0, 1)}
							</span>
						}
					/>
				</span>
				<span className="flex min-w-0 flex-col">
					<span className="truncate font-medium text-sm group-hover:underline group-hover:underline-offset-4">
						{person.name}
					</span>
					{role ? <span className="line-clamp-2 text-pd-muted text-xs">{role}</span> : null}
				</span>
			</Link>
		</li>
	);
}

const LIST = "grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3";

function CreditsContent({ data }: { data: Extract<CreditsPageData, { configured: true }> }) {
	const { title, imageBase } = data;
	return (
		<>
			<header className={cn(INSET, "flex items-end gap-4 bg-pd-mask pt-6 pb-6")}>
				<span className="w-16 shrink-0 sm:w-20">
					<TmdbImage
						image={tmdbImage(imageBase, title.poster, "poster")}
						alt=""
						label={title.title}
						aspect="poster"
						sizes="5rem"
					/>
				</span>
				<div className="flex min-w-0 flex-col gap-1">
					<Link
						{...pardaLinks.title(title.media, title.id, title.slug)}
						className="inline-flex w-fit items-center gap-1 text-pd-muted text-sm underline-offset-4 hover:underline"
						data-testid="credits-back"
					>
						<ArrowLeftIcon aria-hidden className="size-4 rtl:rotate-180" />
						{title.year ? `${title.title} (${formatYear(title.year)})` : title.title}
					</Link>
					<h1 className="pd-display text-balance text-pd-title leading-none [&:lang(ne)]:leading-[1.2]">
						{m.pd_credits_heading()}
					</h1>
				</div>
			</header>
			<div className="flex flex-col gap-10 pt-8 pb-12">
				{data.cast.length ? (
					<section
						aria-labelledby="credits-cast"
						className={cn(INSET, "flex flex-col gap-4")}
						data-testid="credits-cast"
					>
						<h2 id="credits-cast" className="pd-display text-pd-head font-bold">
							{m.pd_cast_heading()}{" "}
							<span className="font-normal text-base text-pd-muted">{formatNumber(data.cast.length)}</span>
						</h2>
						<ul className={LIST}>
							{data.cast.map((person) => (
								<PersonRow key={person.id} person={person} imageBase={imageBase} />
							))}
						</ul>
					</section>
				) : null}
				{data.crew.map((department, index) => (
					<section
						key={department.department}
						aria-labelledby={`credits-department-${index}`}
						className={cn(INSET, "flex flex-col gap-4")}
						data-testid="credits-department"
					>
						<h2 id={`credits-department-${index}`} className="pd-display text-pd-head font-bold">
							{departmentLabel(department.department)}{" "}
							<span className="font-normal text-base text-pd-muted">{formatNumber(department.people.length)}</span>
						</h2>
						<ul className={LIST}>
							{department.people.map((person) => (
								<PersonRow key={person.id} person={person} imageBase={imageBase} />
							))}
						</ul>
					</section>
				))}
				{data.cast.length === 0 && data.crew.length === 0 ? (
					<p className={cn(INSET, "text-pd-muted")}>{m.pd_credits_none()}</p>
				) : null}
			</div>
		</>
	);
}

/** A title's full cast and crew, by department (PLAN Task 63). */
export function PardaCreditsPage() {
	const params = titleRouteParams(route.useParams());
	const { data } = useSuspenseQuery(pardaCreditsQueryOptions(getLocale(), params?.type ?? "movie", params?.id ?? 0));
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="parda-credits">
			{data.configured ? (
				<CreditsContent data={data} />
			) : (
				<>
					<h1 className="sr-only">{m.pd_catalog_unconfigured()}</h1>
					<CatalogUnconfigured />
				</>
			)}
		</main>
	);
}
