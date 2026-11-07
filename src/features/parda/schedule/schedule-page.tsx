import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDaysIcon } from "lucide-react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { EmptyState } from "@/components/page/empty-state";
import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@/features/auth/queries";
import { addDays } from "@/lib/i18n/date-only";
import { formatDate } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { CatalogUnconfigured } from "../home/catalog-unconfigured";
import { tmdbImage } from "../kit/image";
import { TmdbImage } from "../kit/tmdb-image";
import { PARDA_PATHS, pardaLinks } from "../links";
import { INSET } from "../title/title-sections";
import { scheduleDays } from "./days";
import { episodeRangeLabel } from "./labels";
import { pardaAnimeWeekQueryOptions, pardaFollowingQueryOptions } from "./queries";
import type { ScheduleDay, ScheduleEntry } from "./types";

/**
 * The schedule (PLAN Task 68, decision 0241) at /app/parda/schedule: the next 14 days of
 * the series the profile follows, and anime airing this week, by day from today in the
 * viewer's zone. Noindex. Dates are the airing country's, as TMDB gives them.
 */

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function dayHeading(day: string, today: string): string {
	if (day === today) return m.pd_schedule_today();
	if (day === addDays(today, 1)) return m.pd_schedule_tomorrow();
	return formatDate(`${day}T12:00:00Z`, { dateStyle: "full" });
}

function Entry({ entry, imageBase }: { entry: ScheduleEntry; imageBase: string }) {
	const code = episodeRangeLabel({ ...entry, lastEpisode: entry.episode });
	return (
		<li>
			<Link
				{...pardaLinks.title("tv", entry.id, entry.slug)}
				className={cn("group pd-press flex items-center gap-3 py-2", focusRing)}
				data-testid="schedule-entry"
				data-kind={entry.kind}
			>
				<span className="block w-12 shrink-0">
					<TmdbImage
						image={tmdbImage(imageBase, entry.poster, "poster")}
						alt=""
						label={entry.title}
						aspect="poster"
						sizes="3rem"
					/>
				</span>
				<span className="flex min-w-0 flex-col gap-0.5">
					<span className="truncate font-medium text-sm group-hover:underline group-hover:underline-offset-4">
						{entry.title}
					</span>
					<span className="truncate text-pd-muted text-xs">{[code, entry.name].filter(Boolean).join(" · ")}</span>
					<span className="text-pd-muted text-xs">
						{entry.kind === "following" ? m.pd_schedule_following() : m.pd_schedule_anime()}
					</span>
				</span>
			</Link>
		</li>
	);
}

function Day({ day, today, imageBase }: { day: ScheduleDay; today: string; imageBase: string }) {
	const id = `schedule-${day.day}`;
	return (
		<section aria-labelledby={id} className="flex flex-col gap-2" data-testid="schedule-day">
			<h2 id={id} className="pd-display font-bold text-pd-head">
				{dayHeading(day.day, today)}
			</h2>
			<ul className="grid gap-x-6 md:grid-cols-2 xl:grid-cols-3">
				{day.entries.map((entry) => (
					<Entry
						key={`${entry.kind}:${entry.id}:${entry.season}:${entry.episode}`}
						entry={entry}
						imageBase={imageBase}
					/>
				))}
			</ul>
		</section>
	);
}

function Schedule() {
	const locale = getLocale();
	const { data: anime } = useSuspenseQuery(pardaAnimeWeekQueryOptions(locale));
	const { data: session } = useQuery(sessionQueryOptions());
	const { data: following } = useQuery({ ...pardaFollowingQueryOptions(locale), enabled: Boolean(session) });
	if (!anime.configured) return <CatalogUnconfigured />;
	const days = scheduleDays(anime.today, following?.entries ?? [], anime.entries, locale);
	const followed = following?.entries.length ?? 0;
	return (
		<div className={cn(INSET, "flex flex-col gap-8 pt-6 pb-12")}>
			{session ? (
				following && followed === 0 && days.length > 0 ? (
					<p className="max-w-prose text-pd-muted text-sm" data-testid="schedule-none-followed">
						{m.pd_schedule_none_followed()}
					</p>
				) : null
			) : (
				<div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center" data-testid="schedule-signed-out">
					<p className="max-w-prose text-pd-muted text-sm">{m.pd_schedule_signed_out()}</p>
					<Button asChild variant="secondary" size="sm">
						<Link {...pardaLinks.signIn(PARDA_PATHS.schedule)}>{m.pd_sign_in()}</Link>
					</Button>
				</div>
			)}
			{anime.failed ? (
				<p className="text-pd-muted text-sm" data-testid="schedule-anime-failed">
					{m.pd_schedule_anime_failed()}
				</p>
			) : null}
			{days.length ? (
				days.map((day) => (
					<Day key={day.day} day={day} today={anime.today} imageBase={following?.imageBase || anime.imageBase} />
				))
			) : (
				<EmptyState
					icon={CalendarDaysIcon}
					title={m.pd_schedule_empty_title()}
					description={m.pd_schedule_empty()}
					primaryAction={
						<Button asChild>
							<Link {...pardaLinks.hub("series")}>{m.pd_hub_series()}</Link>
						</Button>
					}
					data-testid="schedule-empty"
				/>
			)}
		</div>
	);
}

export function PardaSchedulePage() {
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="parda-schedule">
			<header className={cn(INSET, "flex flex-col gap-3 bg-pd-mask pt-8 pb-6")}>
				<h1 className="pd-display text-pd-title leading-none [&:lang(ne)]:leading-[1.2]">{m.pd_schedule_title()}</h1>
				<p className="max-w-prose text-pd-muted text-sm">{m.pd_schedule_intro()}</p>
			</header>
			<Schedule />
		</main>
	);
}
