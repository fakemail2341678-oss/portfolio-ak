import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { BotIcon, CopyIcon, GlobeIcon, LinkIcon, UserRoundIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { sessionQueryOptions } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { MiniBoard } from "../board/mini-board";
import { formatTimeControl } from "../chess/clock";
import { sideName } from "../chess/speech";
import { canConnect, useConnectLichess } from "../connect/use-connect";
import { chaalKeys } from "../keys";
import { chaalLinks } from "../links";
import type { ChaalEventGame } from "../live/events";
import { orderGames, secondsLeftOf, useLive } from "../live/store";
import { Choice } from "../local/choice";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";
import type { ChaalConnection } from "../schema";
import type { PlaySearch } from "../search";
import { useChaalPreferences } from "../settings/use-preferences";
import { AI_LEVELS, ONLINE_CLOCKS, ONLINE_DAYS, type OnlinePace, paceKey, paceOfKey } from "./controls";
import { challengePace, eventPlayerName } from "./labels";
import { challengesQueryOptions, type PlayCalls, playCalls } from "./queries";
import { QuickPair } from "./quick-pair";
import { type ChallengeColor, DECLINE_REASONS, type DeclineReason, lichessUsername } from "./schema";
import { type SentChallenge, useChallengeStream } from "./use-challenge-stream";

type Opponent = "ai" | "friend" | "link";

/** Whether a connection can play now: not revoked, with play's scopes. */
export const canPlay = (connection: ChaalConnection | null | undefined): connection is ChaalConnection =>
	Boolean(connection && !connection.revoked && !connection.needsScopesFor.includes("play"));

/**
 * The play hub's online part (PLAN Task 77; decision 0266): play the Lichess AI, challenge
 * a player by name, or send a friend a link; and what's live now (games in progress, the
 * challenges to answer and those waiting). Quick pairing (Task 78) comes first, and the
 * games in progress are "My games", the player's move first with the time left. Every state
 * is said: online play off, not connected (connect), a connection to renew (reconnect).
 */
export function OnlinePlay({ calls = playCalls, search = {} }: { calls?: PlayCalls; search?: PlaySearch }) {
	const { data: session } = useQuery(sessionQueryOptions());
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { data: connection } = useQuery({ ...chaalConnectionQueryOptions(), enabled: Boolean(session) });
	let body: ReactNode;
	if (status?.features.play === false) {
		body = (
			<p className="text-ch-muted" data-testid="chaal-online-off">
				{m.ch_online_off_body()}
			</p>
		);
	} else if (!canPlay(connection)) {
		body = <ConnectToPlay connection={connection ?? null} />;
	} else {
		body = (
			<div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
				<div className="flex min-w-0 flex-col gap-8">
					<QuickPair calls={calls} rated={status?.play.rated !== false} />
					<OnlineSetup calls={calls} search={search} />
				</div>
				<LiveNow me={connection.lichessId} calls={calls} />
			</div>
		);
	}
	return (
		<section className="flex flex-col gap-5" aria-labelledby="chaal-online-title" data-testid="chaal-online">
			<div className="flex flex-col gap-1">
				<h2 id="chaal-online-title" className="ch-display text-ch-head">
					{m.ch_online_title()}
				</h2>
				<p className="max-w-prose text-ch-muted text-sm">{m.ch_online_lead()}</p>
			</div>
			{body}
		</section>
	);
}

/** Not connected, or connected without play's permissions: one action, connect or reconnect. */
function ConnectToPlay({ connection }: { connection: ChaalConnection | null }) {
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { connect, pending } = useConnectLichess();
	const reconnect = connection !== null;
	return (
		<div className="ch-rule flex flex-col items-start gap-3 pt-4" data-testid="chaal-online-connect">
			<p className="max-w-prose">
				{reconnect
					? connection.revoked
						? m.ch_online_reconnect_revoked()
						: m.ch_online_reconnect_scopes()
					: m.ch_online_connect_body()}
			</p>
			{canConnect(status) || reconnect ? (
				<Button
					type="button"
					onClick={() => void connect()}
					disabled={pending}
					data-testid="chaal-online-connect-button"
				>
					<GlobeIcon aria-hidden />
					{reconnect ? m.ch_reconnect() : m.ch_connect()}
				</Button>
			) : (
				<p className="text-ch-muted text-sm">{m.ch_online_connect_off()}</p>
			)}
		</div>
	);
}

const clockOptions = () =>
	ONLINE_CLOCKS.map((clock) => ({ value: paceKey({ kind: "clock", clock }), label: formatTimeControl(clock) }));
const dayOptions = () =>
	ONLINE_DAYS.map((days) => ({
		value: paceKey({ kind: "days", days }),
		label: m.ch_online_days_short({ days: String(days) }),
	}));

/** The pace: real time or correspondence, then the clock or the days. */
function PaceChoice({ value, onChange, name }: { value: string; onChange: (value: string) => void; name: string }) {
	const kind = value.startsWith("d") ? "days" : "clock";
	// Switching between the two keeps what was chosen in each.
	const [lastClock, setLastClock] = useState(() => (kind === "clock" ? value : "600+5"));
	const [lastDays, setLastDays] = useState(() => (kind === "days" ? value : "d3"));
	return (
		<>
			<Choice
				legend={m.ch_online_pace()}
				name={`${name}-kind`}
				value={kind}
				onChange={(next) => onChange(next === "days" ? lastDays : lastClock)}
				columns={2}
				options={[
					{ value: "clock", label: m.ch_online_real_time() },
					{ value: "days", label: m.ch_online_correspondence() },
				]}
				testId={`${name}-kind`}
			/>
			{kind === "clock" ? (
				<Choice
					legend={m.ch_play_clock()}
					name={`${name}-clock`}
					value={value}
					onChange={(next) => {
						setLastClock(next);
						onChange(next);
					}}
					columns={4}
					options={clockOptions()}
					testId={`${name}-clock`}
				/>
			) : (
				<Choice
					legend={m.ch_online_days_legend()}
					name={`${name}-days`}
					value={value}
					onChange={(next) => {
						setLastDays(next);
						onChange(next);
					}}
					columns={4}
					options={dayOptions()}
					testId={`${name}-days`}
				/>
			)}
		</>
	);
}

const colorOptions = () => [
	{ value: "white" as const, label: m.ch_white() },
	{ value: "random" as const, label: m.ch_play_side_random() },
	{ value: "black" as const, label: m.ch_black() },
];

/** Rated or casual; without rated play (the admin's switch) the choice isn't offered. */
function RatedChoice({ value, onChange, name }: { value: boolean; onChange: (value: boolean) => void; name: string }) {
	const { data: status } = useQuery(chaalStatusQueryOptions());
	if (status?.play.rated === false) return null;
	return (
		<Choice
			legend={m.ch_online_mode()}
			name={`${name}-rated`}
			value={value ? "rated" : "casual"}
			onChange={(next) => onChange(next === "rated")}
			columns={2}
			options={[
				{ value: "casual", label: m.ch_online_casual() },
				{ value: "rated", label: m.ch_online_rated() },
			]}
			testId={`${name}-rated`}
		/>
	);
}

function OnlineSetup({ calls, search }: { calls: PlayCalls; search: PlaySearch }) {
	const [opponent, setOpponent] = useState<Opponent>(search.with ?? "ai");
	return (
		<div className="ch-rule flex flex-col gap-5 pt-4" data-testid="chaal-online-setup">
			<Choice
				legend={m.ch_online_against()}
				name="opponent"
				value={opponent}
				onChange={setOpponent}
				columns={3}
				options={[
					{ value: "ai", label: m.ch_online_ai() },
					{ value: "friend", label: m.ch_online_friend() },
					{ value: "link", label: m.ch_online_link() },
				]}
				testId="chaal-online-opponent"
			/>
			{opponent === "ai" ? (
				<AiSetup calls={calls} />
			) : opponent === "friend" ? (
				<FriendSetup calls={calls} search={search} />
			) : (
				<LinkSetup calls={calls} />
			)}
		</div>
	);
}

/** The pace from the URL ("Play again"), when it reads and is offered here. */
const initialPace = (key: string | undefined, fallback: string) => (key && paceOfKey(key) ? key : fallback);

function Start({
	onClick,
	busy,
	label,
	testId,
	icon,
}: {
	onClick: () => void;
	busy: boolean;
	label: string;
	testId: string;
	icon: ReactNode;
}) {
	return (
		<Button
			type="button"
			onClick={onClick}
			disabled={busy}
			size="lg"
			className="ch-press self-start px-6"
			data-testid={testId}
		>
			{icon}
			{label}
		</Button>
	);
}

function AiSetup({ calls }: { calls: PlayCalls }) {
	const navigate = useNavigate();
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const max = status?.play.aiMaxLevel ?? 8;
	const [level, setLevel] = useState(String(Math.min(3, max)));
	const [pace, setPace] = useState("600+5");
	const [color, setColor] = useState<ChallengeColor>("random");
	const [busy, setBusy] = useState(false);
	const start = async () => {
		const chosen = paceOfKey(pace);
		if (!chosen) return;
		setBusy(true);
		try {
			const game = await calls.challengeAi({ level: Number(level), pace: chosen, color });
			await navigate(chaalLinks.game(game.id));
		} catch (error) {
			toast.error(errorMessage(error));
			setBusy(false);
		}
	};
	return (
		<div className="flex flex-col gap-5" data-testid="chaal-online-ai">
			<p className="text-ch-muted text-sm">{m.ch_online_ai_body()}</p>
			<Choice
				legend={m.ch_play_level()}
				name="ai-level"
				value={level}
				onChange={setLevel}
				columns={4}
				options={AI_LEVELS.filter((value) => value <= max).map((value) => ({
					value: String(value),
					label: String(value),
				}))}
				testId="chaal-online-ai-level"
			/>
			<PaceChoice value={pace} onChange={setPace} name="chaal-online-ai" />
			<Choice
				legend={m.ch_play_side()}
				name="ai-side"
				value={color}
				onChange={setColor}
				columns={3}
				options={colorOptions()}
				testId="chaal-online-ai-side"
			/>
			<Start
				onClick={() => void start()}
				busy={busy}
				label={m.ch_online_ai_start()}
				testId="chaal-online-ai-start"
				icon={<BotIcon aria-hidden />}
			/>
		</div>
	);
}

/** What a challenge sent from this page says while it waits, and how it ended. */
function sentText(sent: SentChallenge, declinedReason: string | null): string {
	const name = sent.username;
	switch (sent.state) {
		case "sending":
			return m.ch_challenge_sending({ name });
		case "waiting":
			return m.ch_challenge_waiting({ name });
		case "accepted":
			return m.ch_challenge_accepted({ name });
		case "declined":
			return declinedReason
				? `${m.ch_challenge_declined({ name })} ${reasonText(declinedReason)}`
				: m.ch_challenge_declined({ name });
		case "canceled":
			return m.ch_challenge_canceled();
		case "expired":
			return m.ch_challenge_expired({ name });
		default:
			return sent.end?.status === 404 ? m.ch_challenge_no_player({ name }) : m.ch_challenge_failed({ name });
	}
}

/** Lichess's reason keys in Chaal's words (its own translations aren't Chaal's messages). */
export function reasonText(key: string): string {
	const reasons: Readonly<Record<DeclineReason, () => string>> = {
		generic: m.ch_decline_generic,
		later: m.ch_decline_later,
		tooFast: m.ch_decline_too_fast,
		tooSlow: m.ch_decline_too_slow,
		timeControl: m.ch_decline_time_control,
		rated: m.ch_decline_rated,
		casual: m.ch_decline_casual,
	};
	return (reasons[key as DeclineReason] ?? reasons.generic)();
}

function FriendSetup({ calls, search }: { calls: PlayCalls; search: PlaySearch }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const live = useLive();
	const nameId = useId();
	const [username, setUsername] = useState(search.opponent ?? "");
	const [pace, setPace] = useState(initialPace(search.pace, "600+5"));
	const [color, setColor] = useState<ChallengeColor>(search.color ?? "random");
	const [rated, setRated] = useState(search.rated ?? false);
	const [busy, setBusy] = useState(false);
	const [invalid, setInvalid] = useState(false);
	const challenge = useChallengeStream({ onAccepted: (id) => void navigate(chaalLinks.game(id)) });
	const sent = challenge.sent;
	const waiting = sent?.state === "sending" || sent?.state === "waiting";

	const send = async () => {
		const name = lichessUsername.safeParse(username);
		const chosen: OnlinePace | null = paceOfKey(pace);
		setInvalid(!name.success);
		if (!name.success || !chosen) return;
		const input = { username: name.data, pace: chosen, color, rated };
		if (chosen.kind === "clock") {
			void challenge.send(input);
			return;
		}
		setBusy(true);
		try {
			await calls.challengePlayer(input);
			toast.success(m.ch_challenge_sent_days({ name: name.data }));
			void queryClient.invalidateQueries({ queryKey: chaalKeys.challenges() });
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-col gap-5" data-testid="chaal-online-friend">
			<p className="text-ch-muted text-sm">{m.ch_online_friend_body()}</p>
			<div className="flex flex-col gap-1.5">
				<label htmlFor={nameId} className="font-medium text-sm">
					{m.ch_online_username()}
				</label>
				<Input
					id={nameId}
					value={username}
					onChange={(event) => setUsername(event.target.value)}
					autoComplete="off"
					spellCheck={false}
					maxLength={30}
					aria-invalid={invalid || undefined}
					aria-describedby={invalid ? `${nameId}-error` : undefined}
					disabled={waiting}
					data-testid="chaal-online-username"
				/>
				{invalid ? (
					<p id={`${nameId}-error`} className="text-ch-danger text-sm">
						{m.ch_online_username_invalid()}
					</p>
				) : null}
			</div>
			<PaceChoice value={pace} onChange={setPace} name="chaal-online-friend" />
			<Choice
				legend={m.ch_play_side()}
				name="friend-side"
				value={color}
				onChange={setColor}
				columns={3}
				options={colorOptions()}
				testId="chaal-online-friend-side"
			/>
			<RatedChoice value={rated} onChange={setRated} name="chaal-online-friend" />
			{sent ? (
				<output className="ch-hairline block py-2 text-sm" data-testid="chaal-online-sent" data-state={sent.state}>
					{sentText(sent, sent.state === "declined" && sent.id ? (live.declined[sent.id] ?? null) : null)}
				</output>
			) : null}
			{waiting ? (
				<Button
					type="button"
					variant="outline"
					onClick={challenge.cancel}
					className="self-start"
					data-testid="chaal-online-friend-cancel"
				>
					{m.ch_challenge_cancel()}
				</Button>
			) : (
				<Start
					onClick={() => void send()}
					busy={busy}
					label={m.ch_online_friend_start()}
					testId="chaal-online-friend-start"
					icon={<UserRoundIcon aria-hidden />}
				/>
			)}
		</div>
	);
}

function LinkSetup({ calls }: { calls: PlayCalls }) {
	const navigate = useNavigate();
	const live = useLive();
	const [pace, setPace] = useState("600+5");
	const [color, setColor] = useState<ChallengeColor>("random");
	const [rated, setRated] = useState(false);
	const [busy, setBusy] = useState(false);
	const [open, setOpen] = useState<{ id: string; link: string; color: "white" | "black" } | null>(null);

	// The friend joined: the game starts with the link's id.
	const started = open ? live.games.some((game) => game.id === open.id) : false;
	useEffect(() => {
		if (open && started) void navigate(chaalLinks.game(open.id));
	}, [open, started, navigate]);

	const create = async () => {
		const chosen = paceOfKey(pace);
		if (!chosen) return;
		setBusy(true);
		try {
			setOpen(await calls.open({ pace: chosen, color, rated }));
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setBusy(false);
		}
	};
	const cancel = async () => {
		if (!open) return;
		try {
			await calls.cancel(open.id);
			setOpen(null);
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	const copy = async () => {
		if (!open) return;
		try {
			await navigator.clipboard.writeText(open.link);
			toast.success(m.ch_online_link_copied());
		} catch {
			toast.error(m.ch_online_link_copy_failed());
		}
	};

	if (open) {
		return (
			<div className="flex flex-col gap-4" data-testid="chaal-online-link-ready">
				<p className="text-sm">{m.ch_online_link_ready({ side: sideName(open.color) })}</p>
				<div className="flex min-w-0 items-center gap-2">
					<Input
						value={open.link}
						readOnly
						aria-label={m.ch_online_link_label()}
						className="min-w-0"
						data-testid="chaal-online-link-value"
					/>
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={() => void copy()}
						aria-label={m.ch_online_link_copy()}
						title={m.ch_online_link_copy()}
					>
						<CopyIcon aria-hidden />
					</Button>
				</div>
				<output className="block text-ch-muted text-sm">{m.ch_online_link_waiting()}</output>
				<Button
					type="button"
					variant="outline"
					onClick={() => void cancel()}
					className="self-start"
					data-testid="chaal-online-link-cancel"
				>
					{m.ch_challenge_cancel()}
				</Button>
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-5" data-testid="chaal-online-link">
			<p className="text-ch-muted text-sm">{m.ch_online_link_body()}</p>
			<PaceChoice value={pace} onChange={setPace} name="chaal-online-link" />
			<Choice
				legend={m.ch_play_side()}
				name="link-side"
				value={color}
				onChange={setColor}
				columns={3}
				options={colorOptions()}
				testId="chaal-online-link-side"
			/>
			<RatedChoice value={rated} onChange={setRated} name="chaal-online-link" />
			<Start
				onClick={() => void create()}
				busy={busy}
				label={m.ch_online_link_start()}
				testId="chaal-online-link-start"
				icon={<LinkIcon aria-hidden />}
			/>
		</div>
	);
}

/** What's live now: games in progress, challenges to answer, challenges waiting. */
function LiveNow({ me, calls }: { me: string; calls: PlayCalls }) {
	const live = useLive();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const listed = useQuery({ ...challengesQueryOptions(), enabled: live.status !== "open" });
	const fromList = listed.data ? [...listed.data.incoming, ...listed.data.outgoing] : [];
	const challenges = live.status === "open" || !listed.data ? live.challenges : fromList;
	const incoming = challenges.filter((challenge) => challenge.challenger?.id !== me && challenge.destUser !== null);
	const outgoing = challenges.filter((challenge) => challenge.challenger?.id === me && challenge.destUser !== null);
	const [answering, setAnswering] = useState<string | null>(null);

	const refresh = () => void queryClient.invalidateQueries({ queryKey: chaalKeys.challenges() });
	const answer = async (id: string, action: () => Promise<unknown>, after?: () => Promise<void>) => {
		setAnswering(id);
		try {
			await action();
			refresh();
			await after?.();
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setAnswering(null);
		}
	};

	return (
		<div className="flex flex-col gap-5" data-testid="chaal-online-now">
			<MyGames />
			<ChallengeList
				title={m.ch_challenges_incoming()}
				empty={m.ch_challenges_incoming_empty()}
				testId="chaal-challenges-in"
			>
				{incoming.map((challenge) => (
					<li
						key={challenge.id}
						className="ch-hairline flex flex-wrap items-center justify-between gap-2 py-3"
						data-testid="chaal-challenge-in"
					>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-semibold">
								{challenge.challenger?.title ? `${challenge.challenger.title} ` : ""}
								{challenge.challenger?.name ?? "?"}
								{challenge.challenger?.rating ? (
									<span className="ch-figures ms-1.5 font-normal text-ch-muted text-xs">
										{challenge.challenger.rating}
									</span>
								) : null}
							</span>
							<span className="text-ch-muted text-xs">{challengePace(challenge)}</span>
						</div>
						<div className="flex gap-2">
							<Button
								type="button"
								size="sm"
								disabled={answering === challenge.id}
								onClick={() =>
									void answer(
										challenge.id,
										() => calls.accept(challenge.id),
										() => navigate(chaalLinks.game(challenge.id)),
									)
								}
								data-testid="chaal-challenge-accept"
							>
								{m.ch_challenge_accept()}
							</Button>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										size="sm"
										variant="outline"
										disabled={answering === challenge.id}
										data-testid="chaal-challenge-decline"
									>
										{m.ch_challenge_decline()}
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuLabel>{m.ch_challenge_decline_why()}</DropdownMenuLabel>
									{DECLINE_REASONS.map((reason) => (
										<DropdownMenuItem
											key={reason}
											onSelect={() => void answer(challenge.id, () => calls.decline(challenge.id, reason))}
											data-testid={`chaal-decline-${reason}`}
										>
											{reasonText(reason)}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</li>
				))}
			</ChallengeList>
			{outgoing.length > 0 ? (
				<ChallengeList title={m.ch_challenges_outgoing()} empty="" testId="chaal-challenges-out">
					{outgoing.map((challenge) => (
						<li
							key={challenge.id}
							className="ch-hairline flex flex-wrap items-center justify-between gap-2 py-3"
							data-testid="chaal-challenge-out"
						>
							<div className="flex min-w-0 flex-col">
								<span className="truncate font-semibold">{challenge.destUser?.name ?? "?"}</span>
								<span className="text-ch-muted text-xs">{challengePace(challenge)}</span>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={answering === challenge.id}
								onClick={() => void answer(challenge.id, () => calls.cancel(challenge.id))}
								data-testid="chaal-challenge-cancel"
							>
								{m.ch_challenge_cancel()}
							</Button>
						</li>
					))}
				</ChallengeList>
			) : null}
		</div>
	);
}

function ChallengeList({
	title,
	empty,
	testId,
	children,
}: {
	title: string;
	empty: string;
	testId: string;
	children: ReactNode[];
}) {
	return (
		<section className="flex flex-col" aria-label={title} data-testid={testId}>
			<h3 className="ch-rule pt-3 pb-1 font-semibold text-sm">{title}</h3>
			{children.length === 0 ? (
				<p className="py-3 text-ch-muted text-sm">{empty}</p>
			) : (
				<ul className="flex flex-col">{children}</ul>
			)}
		</section>
	);
}

/** Ticks while it's shown: every second when a clock under an hour is running down, else every half minute. */
function useNow(fast: boolean): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), fast ? 1_000 : 30_000);
		return () => clearInterval(timer);
	}, [fast]);
	return now;
}

/** Time left in short words: "2 d 4 h", "5 h 10 min", "12 min", "45 s". */
export function timeLeftText(seconds: number): string {
	const days = Math.floor(seconds / 86_400);
	const hours = Math.floor((seconds % 86_400) / 3_600);
	const minutes = Math.floor((seconds % 3_600) / 60);
	if (days > 0) return m.ch_time_days_hours({ days: String(days), hours: String(hours) });
	if (hours > 0) return m.ch_time_hours_minutes({ hours: String(hours), minutes: String(minutes) });
	if (minutes > 0) return m.ch_time_minutes({ minutes: String(minutes) });
	return m.ch_time_seconds({ seconds: String(Math.max(0, Math.floor(seconds))) });
}

/** A game's pace in a list: "Rapid · Rated", "Correspondence · Casual". */
function gamePace(game: ChaalEventGame): string {
	const speeds: Readonly<Record<string, () => string>> = {
		blitz: m.ch_speed_blitz,
		rapid: m.ch_speed_rapid,
		classical: m.ch_speed_classical,
		correspondence: m.ch_speed_correspondence,
	};
	const speed = speeds[game.speed]?.() ?? game.speed;
	return `${speed} · ${game.rated ? m.ch_online_rated() : m.ch_online_casual()}`;
}

/**
 * "My games" (PLAN Task 78): the player's games in progress on Lichess, their move first and
 * then the least time left, each with its position, whose move it is and the time left.
 * Correspondence turns come from the games' list the tab leader reads (decision 0267).
 */
export function MyGames() {
	const live = useLive();
	const { preferences } = useChaalPreferences();
	const fast = live.games.some((game) => game.isMyTurn && (game.secondsLeft ?? Number.POSITIVE_INFINITY) < 3_600);
	const now = useNow(fast);
	const games = orderGames(live, now);
	return (
		<ChallengeList title={m.ch_online_games()} empty={m.ch_online_games_empty()} testId="chaal-online-games">
			{games.map((game) => {
				const left = secondsLeftOf(game, live.readAt[game.id], now);
				const name = eventPlayerName(game.opponent);
				return (
					<li key={game.id} className="ch-hairline py-2" data-testid="chaal-online-game" data-my-turn={game.isMyTurn}>
						<Link {...chaalLinks.game(game.id)} className="flex items-center gap-3 underline-offset-4 hover:underline">
							<MiniBoard
								fen={game.fen}
								orientation={game.color}
								coordinates={false}
								theme={preferences.board}
								pieces={preferences.pieces}
								className="w-14 shrink-0"
							/>
							<span className="flex min-w-0 flex-1 flex-col">
								<span className="truncate font-semibold">{name}</span>
								<span className="text-ch-muted text-xs">{gamePace(game)}</span>
							</span>
							<span className="flex shrink-0 flex-col items-end text-xs">
								{game.isMyTurn ? (
									<span className="font-semibold">{m.ch_local_your_move()}</span>
								) : (
									<span className="text-ch-muted">{m.ch_online_their_move()}</span>
								)}
								{left !== null ? (
									<span className="ch-figures text-ch-muted" data-testid="chaal-online-game-left">
										{m.ch_games_left({ time: timeLeftText(left) })}
									</span>
								) : null}
							</span>
						</Link>
					</li>
				);
			})}
		</ChallengeList>
	);
}
