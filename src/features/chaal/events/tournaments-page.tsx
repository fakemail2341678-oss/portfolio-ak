import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { CommunityHeader, CommunityOff, ListWaiting, useAreaOn } from "../community/header";
import { chaalLinks } from "../links";
import type { TournamentsSearch } from "../search";
import { tourKind, tourWhen } from "./labels";
import { tournamentsQueryOptions } from "./queries";
import type { ArenaSummary } from "./schema";

const route = getRouteApi("/_chaal/app/chaal/tournaments/");

type View = "created" | "started" | "finished";

/**
 * /app/chaal/tournaments (Task 83, decision 0273; indexable): Lichess's arenas of standard
 * chess, coming up (the default), being played (`?view=started`) and just finished
 * (`?view=finished`). Each opens its page here. Swiss tournaments are reached through
 * their teams.
 */
export function ChaalTournamentsPage() {
	const search = route.useSearch();
	const on = useAreaOn("tournaments");
	const view: View = search.view ?? "created";
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-tournaments">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-12">
				<CommunityHeader current="tournaments" title={m.ch_tournaments_title()} intro={m.ch_tournaments_intro()} />
				{on ? (
					<>
						<Views view={view} />
						<Arenas view={view} />
					</>
				) : (
					<CommunityOff area="tournaments" />
				)}
			</div>
		</main>
	);
}

function Views({ view }: { view: View }) {
	const views: ReadonlyArray<{ key: View; search: TournamentsSearch; label: string }> = [
		{ key: "created", search: {}, label: m.ch_tournaments_upcoming() },
		{ key: "started", search: { view: "started" }, label: m.ch_tournaments_started() },
		{ key: "finished", search: { view: "finished" }, label: m.ch_tournaments_finished() },
	];
	return (
		<ul className="flex flex-wrap gap-1" aria-label={m.ch_tournaments_views()}>
			{views.map((each) => (
				<li key={each.key}>
					<Button asChild variant={each.key === view ? "default" : "ghost"} size="sm">
						<Link
							{...chaalLinks.tournaments(each.search)}
							aria-current={each.key === view ? "page" : undefined}
							data-testid={`chaal-tournaments-${each.key}`}
						>
							{each.label}
						</Link>
					</Button>
				</li>
			))}
		</ul>
	);
}

/** Standard chess only: Chaal's boards don't play variants. */
const standard = (arena: ArenaSummary) => arena.variant === "standard";

function Arenas({ view }: { view: View }) {
	const list = useQuery(tournamentsQueryOptions());
	if (!list.data)
		return (
			<ListWaiting
				error={list.isError ? list.error : null}
				retry={() => void list.refetch()}
				testId="chaal-tournaments-error"
			/>
		);
	const arenas = list.data[view].filter(standard);
	// Coming up soonest first; being played ending soonest first; finished newest first.
	const ordered = view === "finished" ? [...arenas].sort((a, b) => b.finishesAt - a.finishesAt) : arenas;
	return (
		<section aria-labelledby="chaal-tournaments-list" className="flex flex-col gap-2">
			<h2 id="chaal-tournaments-list" className="ch-rule pt-3 font-semibold">
				{view === "created"
					? m.ch_tournaments_upcoming()
					: view === "started"
						? m.ch_tournaments_started()
						: m.ch_tournaments_finished()}
			</h2>
			{ordered.length === 0 ? (
				<p className="text-ch-muted text-sm">{m.ch_tournaments_none()}</p>
			) : (
				<ul className="flex flex-col">
					{ordered.map((arena) => (
						<ArenaRow key={arena.id} arena={arena} />
					))}
				</ul>
			)}
		</section>
	);
}

/** An arena in a list: its name, kind, when, and how many play (shared with a team's page). */
export function ArenaRow({ arena }: { arena: ArenaSummary }) {
	return (
		<li className="ch-hairline" data-testid="chaal-arena-row" data-tournament={arena.id}>
			<Link {...chaalLinks.tournament(arena.id)} className="flex flex-col gap-0.5 py-3 hover:bg-ch-plate">
				<span className="flex min-w-0 items-baseline gap-2">
					{arena.status === "started" ? (
						<span aria-hidden className="inline-block size-2 shrink-0 rounded-full bg-ch-ink" />
					) : null}
					<span className="font-semibold">{arena.name}</span>
				</span>
				<span className="text-ch-muted text-sm">
					{tourKind(arena)} · {m.ch_tournament_minutes({ minutes: String(arena.minutes) })}
				</span>
				<span className="flex flex-wrap gap-x-3 text-ch-muted text-xs">
					<span>{tourWhen(arena)}</span>
					<span>{m.ch_tournament_players({ count: String(arena.nbPlayers) })}</span>
					{arena.winner ? <span>{m.ch_tournament_winner({ name: arena.winner })}</span> : null}
				</span>
			</Link>
		</li>
	);
}
