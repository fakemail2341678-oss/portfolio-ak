import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { CheckIcon, ExternalLinkIcon, FlameIcon, XIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { MiniBoard } from "../board/mini-board";
import { CommunityOff, LichessPrompt, ListPager, ListWaiting, useAreaOn, useLichessFor } from "../community/header";
import { chaalKeys } from "../keys";
import { chaalLinks } from "../links";
import { chaalStatusQueryOptions } from "../queries";
import { useChaalPreferences } from "../settings/use-preferences";
import { STATUS_NAMES, tourKind, tourWhen } from "./labels";
import { arenaQueryOptions, swissQueryOptions, tournamentCalls } from "./queries";
import type {
	ArenaFeatured,
	ArenaPodium,
	ArenaStanding,
	ChaalArena,
	ChaalArenaPage,
	ChaalSwiss,
	ChaalSwissPage,
	TournamentCondition,
	TournamentKind,
	TournamentStats,
} from "./schema";

const route = getRouteApi("/_chaal/app/chaal/tournaments/$id");

/**
 * /app/chaal/tournaments/$id (Task 83, decision 0273; noindex: people's names): an arena,
 * or with `?kind=swiss` a Swiss tournament. What it is and when, its conditions, joining
 * and withdrawing (a password, a team for a team battle, "pair me ASAP"), its top game, the
 * podium once it's over, and its standings (an arena's a page at a time, `?page=`). Read
 * again every 10 s while it's played.
 */
export function ChaalTournamentPage() {
	const { id } = route.useParams();
	const search = route.useSearch();
	const on = useAreaOn("tournaments");
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-tournament">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-12">
				<Link {...chaalLinks.tournaments()} className="text-ch-muted text-sm hover:text-ch-ink">
					{m.ch_tournament_back()}
				</Link>
				{!on ? (
					<CommunityOff area="tournaments" />
				) : search.kind === "swiss" ? (
					<SwissView id={id} />
				) : (
					<ArenaView id={id} page={search.page ?? 1} />
				)}
			</div>
		</main>
	);
}

export function ArenaView({ id, page }: { id: string; page: number }) {
	const read = useQuery(arenaQueryOptions(id, page));
	if (!read.data)
		return (
			<ListWaiting
				error={read.isError ? read.error : null}
				retry={() => void read.refetch()}
				testId="chaal-tournament-error"
			/>
		);
	const { arena } = read.data;
	return (
		<div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]" data-status={arena.status}>
			<div className="flex min-w-0 flex-col gap-6">
				<TourHeading
					name={arena.name}
					kind={`${tourKind(arena)} · ${m.ch_tournament_minutes({ minutes: String(arena.minutes) })}`}
					status={arena.status}
					when={tourWhen(arena)}
					players={arena.nbPlayers}
					by={arena.createdBy}
					url={arena.url}
				/>
				{arena.description ? (
					<p className="whitespace-pre-line text-sm" data-testid="chaal-tournament-description">
						{arena.description}
					</p>
				) : null}
				{arena.podium ? <Podium players={arena.podium} /> : null}
				<ArenaStandings arena={arena} page={page} />
			</div>
			<div className="flex min-w-0 flex-col gap-6">
				<ArenaEntry page={read.data} />
				<Conditions conditions={arena.conditions} />
				{arena.featured && arena.status === "started" && arena.variant === "standard" ? (
					<TopGame game={arena.featured} />
				) : null}
				{arena.stats ? <Stats stats={arena.stats} /> : null}
			</div>
		</div>
	);
}

function TourHeading({
	name,
	kind,
	status,
	when,
	players,
	by,
	url,
}: {
	name: string;
	kind: string;
	status: ChaalArena["status"];
	when: string;
	players: number;
	by: string;
	url: string;
}) {
	return (
		<header className="flex flex-col gap-2">
			<p className="text-ch-muted text-xs uppercase tracking-wide" data-testid="chaal-tournament-status">
				{STATUS_NAMES[status]()}
			</p>
			<h1 className="ch-display text-ch-title" data-testid="chaal-tournament-name">
				{name}
			</h1>
			<p className="text-ch-muted">{kind}</p>
			<p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ch-muted text-sm">
				<span>{when}</span>
				<span>{m.ch_tournament_players({ count: formatNumber(players) })}</span>
				{by ? <span>{m.ch_tournament_by({ name: by })}</span> : null}
				<a href={url} rel="noopener" target="_blank" className="inline-flex items-center gap-1 hover:text-ch-ink">
					<ExternalLinkIcon aria-hidden className="size-3.5" />
					{m.ch_community_on_lichess()}
				</a>
			</p>
		</header>
	);
}

/** Who may join and whether Lichess would let the viewer in: each condition with its verdict. */
function Conditions({ conditions }: { conditions: ReadonlyArray<TournamentCondition> }) {
	if (conditions.length === 0) return null;
	return (
		<section aria-labelledby="chaal-tournament-conditions" className="flex flex-col gap-2">
			<h2 id="chaal-tournament-conditions" className="ch-rule pt-3 font-semibold text-sm">
				{m.ch_tournament_conditions()}
			</h2>
			<ul className="flex flex-col gap-1 text-sm">
				{conditions.map((each) => (
					<li key={each.condition} className="flex items-start gap-2">
						{each.ok ? (
							<CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
						) : (
							<XIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-ch-mark" />
						)}
						<span>
							{each.condition}
							<span className="sr-only">
								{" "}
								({each.ok ? m.ch_tournament_condition_met() : m.ch_tournament_condition_unmet()})
							</span>
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}

/** Joining, withdrawing, or what joining needs. */
function ArenaEntry({ page }: { page: ChaalArenaPage }) {
	const { arena } = page;
	const use = useLichessFor("tournaments");
	const { data: status } = useQuery(chaalStatusQueryOptions());
	if (arena.status === "finished" || arena.variant !== "standard") return null;
	if (status?.community.joinTournaments === false)
		return <p className="text-ch-muted text-sm">{m.ch_tournament_join_off()}</p>;
	if (use !== "ok")
		return <LichessPrompt use={use} text={m.ch_tournament_connect()} testId="chaal-tournament-connect" />;
	const joined = Boolean(arena.me && !arena.me.withdraw);
	return (
		<section
			aria-labelledby="chaal-tournament-entry"
			className="flex flex-col gap-3"
			data-testid="chaal-tournament-entry"
		>
			<h2 id="chaal-tournament-entry" className="ch-rule pt-3 font-semibold text-sm">
				{joined ? m.ch_tournament_you_play() : m.ch_tournament_join_title()}
			</h2>
			{joined && arena.me ? (
				<>
					<p className="text-sm" data-testid="chaal-tournament-joined">
						{arena.me.rank ? m.ch_tournament_your_rank({ rank: String(arena.me.rank) }) : m.ch_tournament_joined()}
					</p>
					{arena.me.gameId ? (
						<Button asChild>
							<Link {...chaalLinks.game(arena.me.gameId)} data-testid="chaal-tournament-your-game">
								{m.ch_tournament_your_game()}
							</Link>
						</Button>
					) : null}
					<Withdraw kind="arena" id={arena.id} />
				</>
			) : (
				<JoinForm
					kind="arena"
					id={arena.id}
					teams={arena.teams}
					asap={arena.status === "started"}
					again={Boolean(arena.me?.withdraw)}
				/>
			)}
		</section>
	);
}

/** After joining or withdrawing: the tournament is read again (with the viewer's token: where they stand). */
function useEntry(kind: TournamentKind, id: string) {
	const queryClient = useQueryClient();
	return () =>
		queryClient.invalidateQueries({ queryKey: kind === "arena" ? chaalKeys.arenaAll(id) : chaalKeys.swiss(id) });
}

function JoinForm({
	kind,
	id,
	teams,
	asap,
	again = false,
	onJoined,
}: {
	kind: TournamentKind;
	id: string;
	teams: ReadonlyArray<{ id: string; name: string }> | null;
	asap: boolean;
	again?: boolean;
	onJoined?: () => void;
}) {
	const field = useId();
	const refresh = useEntry(kind, id);
	const [pairMeAsap, setPairMeAsap] = useState(false);
	const join = useMutation({
		mutationFn: (input: { password?: string; team?: string }) =>
			tournamentCalls.join({ kind, id, ...input, ...(kind === "arena" && pairMeAsap ? { pairMeAsap: true } : {}) }),
		onSuccess: async () => {
			toast.success(m.ch_tournament_joined());
			onJoined?.();
			await refresh();
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const password = String(data.get("password") ?? "").trim();
		const team = String(data.get("team") ?? "");
		join.mutate({ ...(password ? { password } : {}), ...(team ? { team } : {}) });
	};
	return (
		<form onSubmit={submit} className="flex flex-col gap-3" data-testid="chaal-tournament-join-form">
			{teams && teams.length > 0 ? (
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={`${field}-team`}>{m.ch_tournament_team()}</Label>
					<NativeSelect id={`${field}-team`} name="team" required data-testid="chaal-tournament-team">
						{teams.map((team) => (
							<option key={team.id} value={team.id}>
								{team.name}
							</option>
						))}
					</NativeSelect>
				</div>
			) : null}
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${field}-password`}>{m.ch_tournament_password()}</Label>
				<Input
					id={`${field}-password`}
					name="password"
					type="password"
					autoComplete="off"
					maxLength={100}
					data-testid="chaal-tournament-password"
				/>
				<p className="text-ch-muted text-xs">{m.ch_tournament_password_hint()}</p>
			</div>
			{kind === "arena" && asap ? (
				<div className="flex items-center gap-2">
					<Checkbox
						id={`${field}-asap`}
						checked={pairMeAsap}
						onCheckedChange={(value) => setPairMeAsap(value === true)}
						data-testid="chaal-tournament-asap"
					/>
					<Label htmlFor={`${field}-asap`} className="font-normal">
						{m.ch_tournament_pair_asap()}
					</Label>
				</div>
			) : null}
			<Button type="submit" disabled={join.isPending} data-testid="chaal-tournament-join">
				{again ? m.ch_tournament_rejoin() : m.ch_tournament_join()}
			</Button>
		</form>
	);
}

function Withdraw({ kind, id, onDone }: { kind: TournamentKind; id: string; onDone?: () => void }) {
	const refresh = useEntry(kind, id);
	const withdraw = useMutation({
		mutationFn: () => tournamentCalls.withdraw(kind, id),
		onSuccess: async () => {
			toast.success(m.ch_tournament_withdrawn());
			onDone?.();
			await refresh();
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	return (
		<Button
			type="button"
			variant="outline"
			disabled={withdraw.isPending}
			onClick={() => withdraw.mutate()}
			data-testid="chaal-tournament-withdraw"
		>
			{kind === "arena" ? m.ch_tournament_pause() : m.ch_tournament_withdraw()}
		</Button>
	);
}

/** The arena's top game now: a diagram that opens it (followed live there). */
function TopGame({ game }: { game: ArenaFeatured }) {
	const { preferences } = useChaalPreferences();
	const side = (player: ArenaFeatured["white"]) =>
		[player.rank ? `#${player.rank}` : null, player.name, player.rating ? `(${player.rating})` : null]
			.filter(Boolean)
			.join(" ");
	return (
		<section aria-labelledby="chaal-tournament-top" className="flex flex-col gap-2">
			<h2 id="chaal-tournament-top" className="ch-rule pt-3 font-semibold text-sm">
				{m.ch_tournament_top_game()}
			</h2>
			<Link {...chaalLinks.game(game.id)} className="flex flex-col gap-1.5" data-testid="chaal-tournament-top-game">
				<span className="truncate text-sm">{side(game.orientation === "white" ? game.black : game.white)}</span>
				<MiniBoard
					fen={game.fen}
					orientation={game.orientation}
					marks={[]}
					theme={preferences.board}
					pieces={preferences.pieces}
					coordinates={false}
					label={m.ch_tournament_top_game_label({ white: game.white.name, black: game.black.name })}
				/>
				<span className="truncate text-sm">{side(game.orientation === "white" ? game.white : game.black)}</span>
			</Link>
		</section>
	);
}

function Podium({ players }: { players: ReadonlyArray<ArenaPodium> }) {
	return (
		<section aria-labelledby="chaal-tournament-podium" className="flex flex-col gap-2">
			<h2 id="chaal-tournament-podium" className="ch-rule pt-3 font-semibold">
				{m.ch_tournament_podium()}
			</h2>
			<ol className="grid gap-3 sm:grid-cols-3" data-testid="chaal-tournament-podium">
				{players.map((player) => (
					<li key={player.rank} className="flex flex-col gap-1 border-ch-hair border-t pt-2">
						<span className="ch-display text-ch-head">
							{player.rank}. <PlayerName name={player.name} title={player.title} />
						</span>
						<span className="text-ch-muted text-sm">
							{m.ch_tournament_podium_line({
								score: String(player.score),
								games: String(player.games),
								wins: String(player.wins),
							})}
						</span>
						{player.performance ? (
							<span className="text-ch-muted text-xs">
								{m.ch_tournament_performance({ rating: String(player.performance) })}
							</span>
						) : null}
					</li>
				))}
			</ol>
		</section>
	);
}

function PlayerName({ name, title }: { name: string; title: string | null }) {
	return (
		<Link {...chaalLinks.player(name)} className="hover:underline">
			{title ? <span className="me-1 font-semibold text-ch-mark">{title}</span> : null}
			{name}
		</Link>
	);
}

function ArenaStandings({ arena, page }: { arena: ChaalArena; page: number }) {
	const players = arena.standing.players;
	return (
		<section aria-labelledby="chaal-tournament-standings" className="flex flex-col gap-2">
			<h2 id="chaal-tournament-standings" className="ch-rule pt-3 font-semibold">
				{m.ch_tournament_standings()}
			</h2>
			{players.length === 0 ? (
				<p className="text-ch-muted text-sm">{m.ch_tournament_standings_none()}</p>
			) : (
				<table className="w-full text-sm" data-testid="chaal-tournament-standings">
					<thead>
						<tr className="text-ch-muted text-xs">
							<th scope="col" className="w-10 py-1 text-start font-normal">
								{m.ch_tournament_rank()}
							</th>
							<th scope="col" className="py-1 text-start font-normal">
								{m.ch_tournament_player()}
							</th>
							<th scope="col" className="py-1 text-end font-normal max-sm:hidden">
								{m.ch_tournament_sheet()}
							</th>
							<th scope="col" className="w-14 py-1 text-end font-normal">
								{m.ch_tournament_score()}
							</th>
						</tr>
					</thead>
					<tbody>
						{players.map((player) => (
							<StandingRow key={`${player.rank}-${player.name}`} player={player} />
						))}
					</tbody>
				</table>
			)}
			<ListPager
				previous={page > 1 ? chaalLinks.tournament(arena.id, page > 2 ? { page: page - 1 } : {}) : null}
				next={page < arena.pages ? chaalLinks.tournament(arena.id, { page: page + 1 }) : null}
				testId="chaal-tournament-pages"
			/>
		</section>
	);
}

function StandingRow({ player }: { player: ArenaStanding }) {
	return (
		<tr className="border-ch-hair border-t" data-testid="chaal-standing" data-withdrawn={player.withdraw || undefined}>
			<td className="ch-figures py-1.5">{player.rank}</td>
			<td className="py-1.5">
				<span className={player.withdraw ? "text-ch-muted" : undefined}>
					<PlayerName name={player.name} title={player.title} />
				</span>{" "}
				<span className="ch-figures text-ch-muted text-xs">{player.rating}</span>
				{player.team ? <span className="ms-2 text-ch-muted text-xs">{player.team}</span> : null}
			</td>
			<td className="ch-figures py-1.5 text-end text-ch-muted text-xs tracking-wider max-sm:hidden">
				{player.sheet.slice(-16)}
			</td>
			<td className="ch-figures py-1.5 text-end font-semibold">
				{player.fire ? (
					<FlameIcon aria-label={m.ch_tournament_fire()} className="me-1 inline size-3.5 text-ch-mark" />
				) : null}
				{player.score}
			</td>
		</tr>
	);
}

function Stats({ stats }: { stats: TournamentStats }) {
	const rows: Array<[string, number | null]> = [
		[m.ch_tournament_stats_games(), stats.games],
		[m.ch_tournament_stats_white(), stats.whiteWins],
		[m.ch_tournament_stats_black(), stats.blackWins],
		[m.ch_tournament_stats_draws(), stats.draws],
		[m.ch_tournament_stats_berserks(), stats.berserks],
		[m.ch_tournament_stats_rating(), stats.averageRating],
	];
	return (
		<section aria-labelledby="chaal-tournament-stats" className="flex flex-col gap-2">
			<h2 id="chaal-tournament-stats" className="ch-rule pt-3 font-semibold text-sm">
				{m.ch_tournament_stats()}
			</h2>
			<dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
				{rows
					.filter((row): row is [string, number] => row[1] !== null)
					.map(([label, value]) => (
						<div key={label} className="contents">
							<dt className="text-ch-muted">{label}</dt>
							<dd className="ch-figures text-end">{formatNumber(value)}</dd>
						</div>
					))}
			</dl>
		</section>
	);
}

// --- Swiss -------------------------------------------------------------------------------

export function SwissView({ id }: { id: string }) {
	const read = useQuery(swissQueryOptions(id));
	if (!read.data)
		return (
			<ListWaiting
				error={read.isError ? read.error : null}
				retry={() => void read.refetch()}
				testId="chaal-tournament-error"
			/>
		);
	const { swiss } = read.data;
	const rounds = m.ch_swiss_round({ round: String(swiss.round), rounds: String(swiss.nbRounds) });
	return (
		<div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]" data-status={swiss.status}>
			<div className="flex min-w-0 flex-col gap-6">
				<TourHeading
					name={swiss.name}
					kind={`${m.ch_swiss_kind()} · ${tourKind(swiss)} · ${rounds}`}
					status={swiss.status}
					when={
						swiss.nextRoundAt
							? m.ch_swiss_next_round({ date: formatDateTime(swiss.nextRoundAt) })
							: tourWhen({ status: swiss.status, startsAt: swiss.startsAt })
					}
					players={swiss.nbPlayers}
					by={swiss.createdBy}
					url={swiss.url}
				/>
				<SwissStandings swiss={swiss} />
			</div>
			<div className="flex min-w-0 flex-col gap-6">
				<SwissEntry page={read.data} />
				<Conditions conditions={swiss.conditions} />
				{swiss.stats ? <Stats stats={swiss.stats} /> : null}
			</div>
		</div>
	);
}

function SwissEntry({ page }: { page: ChaalSwissPage }) {
	const { swiss, viewer } = page;
	const use = useLichessFor("tournaments");
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const [joinedHere, setJoinedHere] = useState<boolean | null>(null);
	if (swiss.status === "finished" || swiss.variant !== "standard") return null;
	if (status?.community.joinTournaments === false)
		return <p className="text-ch-muted text-sm">{m.ch_tournament_join_off()}</p>;
	if (use !== "ok")
		return <LichessPrompt use={use} text={m.ch_tournament_connect()} testId="chaal-tournament-connect" />;
	const joined = joinedHere ?? viewer?.joined === true;
	return (
		<section
			aria-labelledby="chaal-tournament-entry"
			className="flex flex-col gap-3"
			data-testid="chaal-tournament-entry"
		>
			<h2 id="chaal-tournament-entry" className="ch-rule pt-3 font-semibold text-sm">
				{joined ? m.ch_tournament_you_play() : m.ch_tournament_join_title()}
			</h2>
			{joined ? (
				<>
					<p className="text-sm" data-testid="chaal-tournament-joined">
						{m.ch_tournament_joined()}
					</p>
					<Withdraw kind="swiss" id={swiss.id} onDone={() => setJoinedHere(false)} />
				</>
			) : (
				<JoinForm kind="swiss" id={swiss.id} teams={null} asap={false} onJoined={() => setJoinedHere(true)} />
			)}
		</section>
	);
}

function SwissStandings({ swiss }: { swiss: ChaalSwiss }) {
	return (
		<section aria-labelledby="chaal-tournament-standings" className="flex flex-col gap-2">
			<h2 id="chaal-tournament-standings" className="ch-rule pt-3 font-semibold">
				{m.ch_tournament_standings()}
			</h2>
			{swiss.standings.length === 0 ? (
				<p className="text-ch-muted text-sm">{m.ch_tournament_standings_none()}</p>
			) : (
				<table className="w-full text-sm" data-testid="chaal-tournament-standings">
					<thead>
						<tr className="text-ch-muted text-xs">
							<th scope="col" className="w-10 py-1 text-start font-normal">
								{m.ch_tournament_rank()}
							</th>
							<th scope="col" className="py-1 text-start font-normal">
								{m.ch_tournament_player()}
							</th>
							<th scope="col" className="py-1 text-end font-normal max-sm:hidden">
								{m.ch_swiss_tie_break()}
							</th>
							<th scope="col" className="w-14 py-1 text-end font-normal">
								{m.ch_swiss_points()}
							</th>
						</tr>
					</thead>
					<tbody>
						{swiss.standings.map((player) => (
							<tr
								key={`${player.rank}-${player.name}`}
								className="border-ch-hair border-t"
								data-testid="chaal-standing"
							>
								<td className="ch-figures py-1.5">{player.rank}</td>
								<td className="py-1.5">
									<PlayerName name={player.name} title={player.title} />{" "}
									<span className="ch-figures text-ch-muted text-xs">{player.rating}</span>
								</td>
								<td className="ch-figures py-1.5 text-end text-ch-muted max-sm:hidden">{player.tieBreak}</td>
								<td className="ch-figures py-1.5 text-end font-semibold">{player.points}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			{swiss.nbPlayers > swiss.standings.length ? (
				<p className="text-ch-muted text-xs">
					{m.ch_swiss_more({ count: formatNumber(swiss.nbPlayers - swiss.standings.length) })}
				</p>
			) : null}
		</section>
	);
}
