import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";
import {
	CommunityHeader,
	CommunityOff,
	LichessPrompt,
	ListPager,
	ListWaiting,
	useAreaOn,
	useLichessFor,
} from "../community/header";
import { CHAAL_PATHS, chaalLinks } from "../links";
import type { TeamsSearch } from "../search";
import { myTeamsQueryOptions, teamSearchQueryOptions, teamsQueryOptions } from "./queries";
import type { TeamSummary } from "./schema";

const route = getRouteApi("/_chaal/app/chaal/teams/");

/**
 * /app/chaal/teams (Task 83, decision 0273; noindex: people's words): Lichess's teams, the
 * most popular a page at a time, a search by name (`?q=`), or the player's own
 * (`?view=mine`, with their token). Each opens its page here.
 */
export function ChaalTeamsPage() {
	const search = route.useSearch();
	const on = useAreaOn("teams");
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-teams">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-12">
				<CommunityHeader current="teams" title={m.ch_teams_title()} intro={m.ch_teams_intro()} />
				{on ? (
					<>
						<Toolbar search={search} />
						{search.q ? (
							<Results q={search.q} page={search.page ?? 1} />
						) : search.view === "mine" ? (
							<Mine />
						) : (
							<Popular page={search.page ?? 1} />
						)}
					</>
				) : (
					<CommunityOff area="teams" />
				)}
			</div>
		</main>
	);
}

function Toolbar({ search }: { search: TeamsSearch }) {
	const navigate = useNavigate();
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
		void navigate(chaalLinks.teams(q.length >= 2 ? { q } : {}));
	};
	const views = [
		{ key: "popular", search: {}, label: m.ch_teams_popular(), current: !search.q && search.view !== "mine" },
		{
			key: "mine",
			search: { view: "mine" as const },
			label: m.ch_teams_mine(),
			current: !search.q && search.view === "mine",
		},
	];
	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<ul className="flex gap-1" aria-label={m.ch_teams_views()}>
				{views.map((view) => (
					<li key={view.key}>
						<Button asChild variant={view.current ? "default" : "ghost"} size="sm">
							<Link
								{...chaalLinks.teams(view.search)}
								aria-current={view.current ? "page" : undefined}
								data-testid={`chaal-teams-${view.key}`}
							>
								{view.label}
							</Link>
						</Button>
					</li>
				))}
			</ul>
			<search>
				<form
					method="get"
					action={localizeHref(CHAAL_PATHS.teams)}
					onSubmit={submit}
					className="flex items-center gap-2"
				>
					<label htmlFor="chaal-team-q" className="sr-only">
						{m.ch_teams_search_label()}
					</label>
					<Input
						id="chaal-team-q"
						name="q"
						type="search"
						defaultValue={search.q ?? ""}
						minLength={2}
						maxLength={60}
						placeholder={m.ch_teams_search_placeholder()}
						className="sm:w-64"
						data-testid="chaal-teams-q"
					/>
					<Button type="submit" variant="outline" size="icon" aria-label={m.ch_teams_search()}>
						<SearchIcon aria-hidden />
					</Button>
				</form>
			</search>
		</div>
	);
}

function Popular({ page }: { page: number }) {
	const list = useQuery(teamsQueryOptions(page));
	if (!list.data)
		return (
			<ListWaiting
				error={list.isError ? list.error : null}
				retry={() => void list.refetch()}
				testId="chaal-teams-error"
			/>
		);
	const { next } = list.data;
	return (
		<TeamSection
			id="chaal-teams-popular"
			title={m.ch_teams_popular()}
			teams={list.data.teams}
			empty={m.ch_teams_none()}
		>
			<ListPager
				previous={page > 1 ? chaalLinks.teams(page > 2 ? { page: page - 1 } : {}) : null}
				next={next !== null && next <= 20 ? chaalLinks.teams({ page: next }) : null}
				testId="chaal-teams-pages"
			/>
		</TeamSection>
	);
}

function Results({ q, page }: { q: string; page: number }) {
	const list = useQuery(teamSearchQueryOptions(q, page));
	if (!list.data)
		return (
			<ListWaiting
				error={list.isError ? list.error : null}
				retry={() => void list.refetch()}
				testId="chaal-teams-error"
			/>
		);
	const { next } = list.data;
	return (
		<TeamSection
			id="chaal-teams-results"
			title={m.ch_teams_results({ q })}
			teams={list.data.teams}
			empty={m.ch_teams_results_none()}
		>
			<ListPager
				previous={page > 1 ? chaalLinks.teams(page > 2 ? { q, page: page - 1 } : { q }) : null}
				next={next !== null && next <= 20 ? chaalLinks.teams({ q, page: next }) : null}
				testId="chaal-teams-pages"
			/>
		</TeamSection>
	);
}

function Mine() {
	const use = useLichessFor("teams");
	const list = useQuery({ ...myTeamsQueryOptions(), enabled: use === "ok" });
	if (use !== "ok") return <LichessPrompt use={use} text={m.ch_teams_mine_connect()} testId="chaal-teams-connect" />;
	if (!list.data)
		return (
			<ListWaiting
				error={list.isError ? list.error : null}
				retry={() => void list.refetch()}
				testId="chaal-teams-error"
			/>
		);
	return (
		<TeamSection id="chaal-teams-mine" title={m.ch_teams_mine()} teams={list.data} empty={m.ch_teams_mine_none()} />
	);
}

function TeamSection({
	id,
	title,
	teams,
	empty,
	children,
}: {
	id: string;
	title: string;
	teams: ReadonlyArray<TeamSummary>;
	empty: string;
	children?: ReactNode;
}) {
	return (
		<section aria-labelledby={id} className="flex flex-col gap-2" data-testid={id}>
			<h2 id={id} className="ch-rule pt-3 font-semibold">
				{title}
			</h2>
			{teams.length === 0 ? (
				<p className="text-ch-muted text-sm">{empty}</p>
			) : (
				<ul className="flex flex-col">
					{teams.map((team) => (
						<TeamRow key={team.id} team={team} />
					))}
				</ul>
			)}
			{children}
		</section>
	);
}

function TeamRow({ team }: { team: TeamSummary }) {
	return (
		<li className="ch-hairline" data-testid="chaal-team-row" data-team={team.id}>
			<Link {...chaalLinks.team(team.id)} className="flex flex-col gap-0.5 py-3 hover:bg-ch-plate">
				<span className="font-semibold">{team.name}</span>
				<span className="flex flex-wrap gap-x-3 text-ch-muted text-sm">
					<span>{m.ch_team_members_count({ count: formatNumber(team.nbMembers) })}</span>
					<span>{team.open ? m.ch_team_open() : m.ch_team_closed()}</span>
					{team.leader ? <span>{m.ch_team_led_by({ name: team.leader.name })}</span> : null}
				</span>
				{team.description ? <span className="line-clamp-2 text-ch-muted text-xs">{team.description}</span> : null}
			</Link>
		</li>
	);
}
