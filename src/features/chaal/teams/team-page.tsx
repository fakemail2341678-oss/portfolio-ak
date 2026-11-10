import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { type FormEvent, useId } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { CommunityOff, LichessPrompt, ListWaiting, useAreaOn, useLichessFor } from "../community/header";
import { tourKind, tourWhen } from "../events/labels";
import type { SwissSummary } from "../events/schema";
import { ArenaRow } from "../events/tournaments-page";
import { chaalLinks } from "../links";
import { chaalStatusQueryOptions } from "../queries";
import { teamCalls, teamQueryOptions } from "./queries";
import type { ChaalTeam, ChaalTeamPage as TeamPageData, TeamPerson } from "./schema";

const route = getRouteApi("/_chaal/app/chaal/teams/$id");

/**
 * /app/chaal/teams/$id (Task 83, decision 0273; noindex: people's names and words): a team,
 * what it says about itself (as text), its leaders, its newest members, its arenas and Swiss
 * tournaments, and joining (or asking to: a closed team's leaders read a message; a private
 * one wants its password) or leaving.
 */
export function ChaalTeamPage() {
	const { id } = route.useParams();
	const on = useAreaOn("teams");
	const read = useQuery(teamQueryOptions(id));
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-team">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-12">
				<Link {...chaalLinks.teams()} className="text-ch-muted text-sm hover:text-ch-ink">
					{m.ch_team_back()}
				</Link>
				{!on ? (
					<CommunityOff area="teams" />
				) : read.data ? (
					<TeamView page={read.data} />
				) : (
					<ListWaiting
						error={read.isError ? read.error : null}
						retry={() => void read.refetch()}
						testId="chaal-team-error"
					/>
				)}
			</div>
		</main>
	);
}

export function TeamView({ page }: { page: TeamPageData }) {
	const { team } = page;
	return (
		<div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
			<div className="flex min-w-0 flex-col gap-6">
				<header className="flex flex-col gap-2">
					<h1 className="ch-display text-ch-title" data-testid="chaal-team-name">
						{team.name}
					</h1>
					<p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ch-muted text-sm">
						<span>{m.ch_team_members_count({ count: formatNumber(team.nbMembers) })}</span>
						<span>{team.open ? m.ch_team_open() : m.ch_team_closed()}</span>
						<a
							href={team.url}
							rel="noopener"
							target="_blank"
							className="inline-flex items-center gap-1 hover:text-ch-ink"
						>
							<ExternalLinkIcon aria-hidden className="size-3.5" />
							{m.ch_community_on_lichess()}
						</a>
					</p>
				</header>
				{team.description ? (
					<p className="whitespace-pre-line break-words text-sm" data-testid="chaal-team-description">
						{team.description}
					</p>
				) : null}
				<Tournaments team={team} />
			</div>
			<div className="flex min-w-0 flex-col gap-6">
				<Membership page={page} />
				<People id="chaal-team-leaders" title={m.ch_team_leaders()} people={team.leaders} />
				<section aria-labelledby="chaal-team-members" className="flex flex-col gap-2">
					<h2 id="chaal-team-members" className="ch-rule pt-3 font-semibold text-sm">
						{m.ch_team_newest_members()}
					</h2>
					{team.members.length === 0 ? (
						<p className="text-ch-muted text-sm">{m.ch_team_members_none()}</p>
					) : (
						<ul className="flex flex-col text-sm" data-testid="chaal-team-members">
							{team.members.map((member) => (
								<li
									key={member.id}
									className="flex items-baseline justify-between gap-2 border-ch-hair border-t py-1.5"
								>
									<PersonLink person={member} />
									{member.joinedAt ? (
										<span className="shrink-0 text-ch-muted text-xs">{formatDate(member.joinedAt)}</span>
									) : null}
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</div>
	);
}

function PersonLink({ person }: { person: TeamPerson }) {
	return (
		<Link {...chaalLinks.player(person.name)} className="min-w-0 truncate hover:underline">
			{person.title ? <span className="me-1 font-semibold">{person.title}</span> : null}
			{person.name}
		</Link>
	);
}

function People({ id, title, people }: { id: string; title: string; people: ReadonlyArray<TeamPerson> }) {
	if (people.length === 0) return null;
	return (
		<section aria-labelledby={id} className="flex flex-col gap-2">
			<h2 id={id} className="ch-rule pt-3 font-semibold text-sm">
				{title}
			</h2>
			<ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
				{people.map((person) => (
					<li key={person.id}>
						<PersonLink person={person} />
					</li>
				))}
			</ul>
		</section>
	);
}

/** In the team or not: leave, join, ask to join, or what acting needs. */
function Membership({ page }: { page: TeamPageData }) {
	const { team, viewer } = page;
	const use = useLichessFor("teams");
	const { data: status } = useQuery(chaalStatusQueryOptions());
	if (status?.community.joinTeams === false) return <p className="text-ch-muted text-sm">{m.ch_team_join_off()}</p>;
	if (use !== "ok" || !viewer)
		return (
			<LichessPrompt use={use === "ok" ? "reconnect" : use} text={m.ch_team_connect()} testId="chaal-team-connect" />
		);
	return (
		<section
			aria-labelledby="chaal-team-membership"
			className="flex flex-col gap-3"
			data-testid="chaal-team-membership"
		>
			<h2 id="chaal-team-membership" className="ch-rule pt-3 font-semibold text-sm">
				{m.ch_team_membership()}
			</h2>
			{viewer.joined ? (
				<>
					<p className="text-sm" data-testid="chaal-team-joined">
						{m.ch_team_you_are_in()}
					</p>
					<Leave id={team.id} />
				</>
			) : viewer.requested ? (
				<p className="text-sm" data-testid="chaal-team-requested">
					{m.ch_team_requested()}
				</p>
			) : (
				<JoinTeam team={team} />
			)}
		</section>
	);
}

function useRefresh(id: string) {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: teamQueryOptions(id).queryKey });
}

function JoinTeam({ team }: { team: ChaalTeam }) {
	const field = useId();
	const refresh = useRefresh(team.id);
	const join = useMutation({
		mutationFn: (input: { message?: string; password?: string }) => teamCalls.join({ id: team.id, ...input }),
		onSuccess: async () => {
			toast.success(team.open ? m.ch_team_joined() : m.ch_team_request_sent());
			await refresh();
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const message = String(data.get("message") ?? "").trim();
		const password = String(data.get("password") ?? "").trim();
		join.mutate({ ...(message ? { message } : {}), ...(password ? { password } : {}) });
	};
	return (
		<form method="post" onSubmit={submit} className="flex flex-col gap-3" data-testid="chaal-team-join-form">
			{team.open ? null : (
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={`${field}-message`}>{m.ch_team_message()}</Label>
					<Textarea id={`${field}-message`} name="message" maxLength={2000} rows={3} data-testid="chaal-team-message" />
					<p className="text-ch-muted text-xs">{m.ch_team_message_hint()}</p>
				</div>
			)}
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${field}-password`}>{m.ch_team_password()}</Label>
				<Input
					id={`${field}-password`}
					name="password"
					type="password"
					autoComplete="off"
					maxLength={100}
					data-testid="chaal-team-password"
				/>
				<p className="text-ch-muted text-xs">{m.ch_team_password_hint()}</p>
			</div>
			<Button type="submit" disabled={join.isPending} data-testid="chaal-team-join">
				{team.open ? m.ch_team_join() : m.ch_team_ask()}
			</Button>
		</form>
	);
}

function Leave({ id }: { id: string }) {
	const refresh = useRefresh(id);
	const leave = useMutation({
		mutationFn: () => teamCalls.leave(id),
		onSuccess: async () => {
			toast.success(m.ch_team_left());
			await refresh();
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	return (
		<Button
			type="button"
			variant="outline"
			disabled={leave.isPending}
			onClick={() => leave.mutate()}
			data-testid="chaal-team-leave"
		>
			{m.ch_team_leave()}
		</Button>
	);
}

/** The team's arenas and Swiss tournaments (each opens its page here). */
function Tournaments({ team }: { team: ChaalTeam }) {
	const tournamentsOn = useAreaOn("tournaments");
	if (!tournamentsOn) return null;
	return (
		<section aria-labelledby="chaal-team-tournaments" className="flex flex-col gap-2">
			<h2 id="chaal-team-tournaments" className="ch-rule pt-3 font-semibold">
				{m.ch_team_tournaments()}
			</h2>
			{team.swiss.length === 0 && team.arenas.length === 0 ? (
				<p className="text-ch-muted text-sm">{m.ch_team_tournaments_none()}</p>
			) : (
				<ul className="flex flex-col" data-testid="chaal-team-tournaments">
					{team.swiss.map((swiss) => (
						<SwissRow key={swiss.id} swiss={swiss} />
					))}
					{team.arenas.map((arena) => (
						<ArenaRow key={arena.id} arena={arena} />
					))}
				</ul>
			)}
		</section>
	);
}

function SwissRow({ swiss }: { swiss: SwissSummary }) {
	return (
		<li className="ch-hairline" data-testid="chaal-swiss-row" data-tournament={swiss.id}>
			<Link
				{...chaalLinks.tournament(swiss.id, { kind: "swiss" })}
				className="flex flex-col gap-0.5 py-3 hover:bg-ch-plate"
			>
				<span className="flex min-w-0 items-baseline gap-2">
					{swiss.status === "started" ? (
						<span aria-hidden className="inline-block size-2 shrink-0 rounded-full bg-ch-ink" />
					) : null}
					<span className="font-semibold">{swiss.name}</span>
				</span>
				<span className="text-ch-muted text-sm">
					{m.ch_swiss_kind()} · {tourKind(swiss)} ·{" "}
					{m.ch_swiss_round({ round: String(swiss.round), rounds: String(swiss.nbRounds) })}
				</span>
				<span className="flex flex-wrap gap-x-3 text-ch-muted text-xs">
					<span>
						{swiss.nextRoundAt
							? m.ch_swiss_next_round({ date: formatDateTime(swiss.nextRoundAt) })
							: tourWhen({ status: swiss.status, startsAt: swiss.startsAt })}
					</span>
					<span>{m.ch_tournament_players({ count: formatNumber(swiss.nbPlayers) })}</span>
				</span>
			</Link>
		</li>
	);
}
