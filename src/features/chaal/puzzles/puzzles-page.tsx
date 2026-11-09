import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowRightIcon, RotateCcwIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@/features/auth/queries";
import { isAppError } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { canConnect, useConnectLichess } from "../connect/use-connect";
import { chaalLinks } from "../links";
import { chaalStatusQueryOptions } from "../queries";
import type { PuzzleAngle } from "./angles";
import { DEFAULT_PUZZLE_LIMITS } from "./limits";
import { progressOf } from "./progress";
import { PuzzleChoicesPanel, PuzzleModes, type PuzzlePageMode, TrainingChoices } from "./puzzle-choices";
import { PuzzleProgress } from "./puzzle-progress";
import { PuzzlePlace, PuzzleSolver } from "./puzzle-solver";
import {
	angleOf,
	dailyPuzzleQueryOptions,
	puzzleBatchQueryOptions,
	puzzleProgressQueryOptions,
	puzzleQueryOptions,
	puzzleReplayQueryOptions,
	STREAK_FIRST,
	trainingInput,
} from "./queries";
import type { ChaalPuzzle, PuzzleAttempt, PuzzleMode } from "./schema";
import { THEME_NAMES } from "./themes";
import { STREAK_TIER, streakDifficulty } from "./trainer";
import { useBrowserAttempts, useRecordAttempt } from "./use-attempts";
import { type QueueChoice, usePuzzleQueue } from "./use-queue";
import type { TrainerResult } from "./use-trainer";

const listRoute = getRouteApi("/_chaal/app/chaal/puzzles/");
const oneRoute = getRouteApi("/_chaal/app/chaal/puzzles/$id");

/** A finished puzzle as it's stored (decision 0269). */
const attemptOf = (
	puzzle: ChaalPuzzle,
	result: TrainerResult,
	how: { mode: PuzzleMode; angle: PuzzleAngle; streak: number | null },
): PuzzleAttempt => ({
	id: crypto.randomUUID(),
	puzzleId: puzzle.id,
	won: result.won,
	ms: result.ms,
	rating: puzzle.rating,
	themes: puzzle.themes.filter((theme) => /^[A-Za-z0-9]{1,40}$/.test(theme)).slice(0, 20),
	mode: how.mode,
	angle: how.angle,
	streak: how.streak,
	at: new Date().toISOString(),
});

/** What a failed read means, in words. */
function errorText(error: unknown): string {
	if (isAppError(error) && error.code === "RATE_LIMITED") return m.ch_error_lichess_wait();
	if (isAppError(error) && error.code === "NOT_FOUND") return m.ch_puzzle_not_found();
	if (isAppError(error) && error.code === "FORBIDDEN") return m.ch_puzzle_off();
	return m.ch_puzzle_failed_load();
}

function Heading({ title, aside }: { title: string; aside?: ReactNode }) {
	return (
		<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
			<h1 id="chaal-puzzle-heading" className="ch-display text-ch-title" data-testid="chaal-puzzle-title">
				{title}
			</h1>
			{aside}
		</div>
	);
}

/** What every mode shares: the switches, the session, the progress panel and recording. */
function usePuzzleShell() {
	const { data: session } = useQuery(sessionQueryOptions());
	const signedIn = Boolean(session);
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const on = status?.features.puzzles !== false;
	const progress = useQuery({ ...puzzleProgressQueryOptions(), enabled: signedIn && on });
	const browser = useBrowserAttempts();
	const record = useRecordAttempt();
	const { connect } = useConnectLichess();
	const stats = signedIn ? (progress.data?.stats ?? progressOf([], Date.now())) : progressOf(browser, Date.now());
	const progressPanel = on ? (
		<PuzzleProgress
			stats={stats}
			lichess={signedIn ? (progress.data?.lichess ?? null) : null}
			pending={progress.data?.pending ?? 0}
			canConnect={canConnect(status)}
			onConnect={() => void connect()}
		/>
	) : null;
	return {
		on,
		signedIn,
		limits: status?.puzzles ?? DEFAULT_PUZZLE_LIMITS,
		stats,
		record,
		progressPanel,
		connect,
		canConnect: canConnect(status),
	};
}

type Shell = ReturnType<typeof usePuzzleShell>;

const ToTraining = () => (
	<Button asChild data-testid="chaal-puzzle-next">
		<Link {...chaalLinks.puzzles({ mode: "train" })}>
			{m.ch_puzzle_next()}
			<ArrowRightIcon aria-hidden />
		</Link>
	</Button>
);

function NextButton({ onClick, children }: { onClick: () => void; children?: ReactNode }) {
	return (
		<Button type="button" onClick={onClick} data-testid="chaal-puzzle-next">
			{children ?? (
				<>
					{m.ch_puzzle_next()}
					<ArrowRightIcon aria-hidden />
				</>
			)}
		</Button>
	);
}

function Extra({ shell, mode, choices }: { shell: Shell; mode: PuzzlePageMode; choices?: ReactNode }) {
	return (
		<>
			<PuzzleChoicesPanel>
				<PuzzleModes current={mode} streak={shell.limits.streak} />
				{choices}
			</PuzzleChoicesPanel>
			{shell.progressPanel}
		</>
	);
}

/** One puzzle read by a query: the daily one or one by its id. */
function OnePuzzle({
	shell,
	title,
	read,
	mode,
}: {
	shell: Shell;
	title: string;
	read: { data: ChaalPuzzle | undefined; error: unknown; isPending: boolean };
	mode: "daily" | "single";
}) {
	const extra = <Extra shell={shell} mode="daily" />;
	if (!read.data) {
		return (
			<PuzzlePlace
				heading={<Heading title={title} />}
				busy={read.isPending}
				message={read.isPending ? undefined : errorText(read.error)}
				action={
					read.isPending ? null : (
						<Button asChild variant="outline">
							<Link {...chaalLinks.puzzles({ mode: "train" })}>{m.ch_puzzle_to_training()}</Link>
						</Button>
					)
				}
				extra={extra}
			/>
		);
	}
	const puzzle = read.data;
	return (
		<PuzzleSolver
			key={puzzle.id}
			puzzle={puzzle}
			heading={<Heading title={title} />}
			onResult={(result) => void shell.record(attemptOf(puzzle, result, { mode, angle: "mix", streak: null }))}
			next={<ToTraining />}
			extra={extra}
		/>
	);
}

function DailyPuzzle({ shell }: { shell: Shell }) {
	const read = useQuery(dailyPuzzleQueryOptions());
	return <OnePuzzle shell={shell} title={m.ch_puzzle_daily()} read={read} mode="daily" />;
}

/** The queue's states in the board's place. */
function QueuePlace({
	heading,
	queue,
	extra,
}: {
	heading: ReactNode;
	queue: ReturnType<typeof usePuzzleQueue>;
	extra: ReactNode;
}) {
	const message = queue.error
		? queue.error === "wait"
			? m.ch_error_lichess_wait()
			: m.ch_puzzle_failed_load()
		: queue.exhausted
			? m.ch_puzzle_none_left()
			: undefined;
	return (
		<PuzzlePlace
			heading={heading}
			busy={!message}
			message={message}
			action={
				queue.error ? (
					<Button type="button" variant="outline" onClick={queue.retry} data-testid="chaal-puzzle-retry">
						<RotateCcwIcon aria-hidden />
						{m.ch_puzzle_try_again()}
					</Button>
				) : null
			}
			extra={extra}
		/>
	);
}

const ratingAside = (rating: number | null) =>
	rating === null ? null : (
		<p className="text-ch-muted text-sm" data-testid="chaal-puzzle-my-rating">
			{m.ch_puzzle_my_rating({ rating: formatNumber(rating) })}
		</p>
	);

function Training({ shell, choice, theme }: { shell: Shell; choice: QueueChoice; theme: PuzzleAngle }) {
	const first = useQuery(puzzleBatchQueryOptions({ ...choice, round: 0 }));
	const queue = usePuzzleQueue({ choice, first: first.data ?? null });
	const title = theme === "mix" ? m.ch_puzzle_training() : m.ch_puzzle_training_theme({ theme: THEME_NAMES[theme]() });
	const heading = <Heading title={title} aside={ratingAside(queue.glicko?.rating ?? null)} />;
	const extra = (
		<Extra
			shell={shell}
			mode="train"
			choices={
				<TrainingChoices theme={theme} difficulty={choice.difficulty ?? "normal"} color={choice.color ?? null} />
			}
		/>
	);
	const puzzle = queue.current;
	if (!puzzle) return <QueuePlace heading={heading} queue={queue} extra={extra} />;
	return (
		<PuzzleSolver
			key={puzzle.id}
			puzzle={puzzle}
			heading={heading}
			onResult={(result) => void shell.record(attemptOf(puzzle, result, { mode: "train", angle: theme, streak: null }))}
			next={<NextButton onClick={queue.next} />}
			extra={extra}
		/>
	);
}

/**
 * The streak (our own, PLAN Task 80): puzzles one after another, harder every STREAK_TIER
 * solved; one miss ends it. No hints. The next difficulty's puzzles are read two puzzles
 * before they're needed. The best streak is the player's (the account's or this browser's).
 */
function Streak({ shell }: { shell: Shell }) {
	const [count, setCount] = useState(0);
	const [over, setOver] = useState(false);
	const first = useQuery(puzzleBatchQueryOptions(STREAK_FIRST));
	const choice: QueueChoice = { angle: "mix", difficulty: streakDifficulty(count), streak: true };
	const nextTier = streakDifficulty(count + STREAK_TIER - (count % STREAK_TIER));
	const upcoming =
		count % STREAK_TIER >= STREAK_TIER - 2 && nextTier !== choice.difficulty
			? { ...choice, difficulty: nextTier }
			: null;
	const queue = usePuzzleQueue({ choice, first: first.data ?? null, upcoming });
	const best = Math.max(shell.stats.bestStreak, count);
	const heading = (
		<Heading
			title={m.ch_puzzle_streak()}
			aside={
				<p className="flex items-baseline gap-3 text-sm" data-testid="chaal-puzzle-streak">
					<span className="ch-display ch-figures text-ch-head" data-testid="chaal-puzzle-streak-count">
						{formatNumber(count)}
					</span>
					<span className="text-ch-muted">{m.ch_puzzle_streak_best({ best: formatNumber(best) })}</span>
				</p>
			}
		/>
	);
	const extra = <Extra shell={shell} mode="streak" />;
	if (!shell.limits.streak) {
		return <PuzzlePlace heading={heading} message={m.ch_puzzle_streak_off()} extra={extra} />;
	}
	const puzzle = queue.current;
	if (!puzzle) return <QueuePlace heading={heading} queue={queue} extra={extra} />;
	return (
		<PuzzleSolver
			key={puzzle.id}
			puzzle={puzzle}
			heading={heading}
			streak
			onResult={(result) => {
				const length = result.won ? count + 1 : count;
				void shell.record(attemptOf(puzzle, result, { mode: "streak", angle: "mix", streak: length }));
				if (result.won) setCount(length);
				else setOver(true);
			}}
			next={
				over ? (
					<NextButton
						onClick={() => {
							setCount(0);
							setOver(false);
							queue.next();
						}}
					>
						<RotateCcwIcon aria-hidden />
						{m.ch_puzzle_streak_again()}
					</NextButton>
				) : (
					<NextButton onClick={queue.next} />
				)
			}
			extra={extra}
		/>
	);
}

/** Lichess's misses in a theme, one after another (a session connected with the puzzle scopes). */
function Replay({ shell, theme }: { shell: Shell; theme: PuzzleAngle }) {
	const queryClient = useQueryClient();
	const replay = useQuery({ ...puzzleReplayQueryOptions(theme), enabled: shell.signedIn });
	const [index, setIndex] = useState(0);
	const ids = replay.data?.remaining ?? [];
	const id = ids[index];
	const read = useQuery({ ...puzzleQueryOptions(id ?? ""), enabled: Boolean(id) });
	const upcoming = ids[index + 1];
	useEffect(() => {
		if (upcoming) void queryClient.prefetchQuery(puzzleQueryOptions(upcoming));
	}, [upcoming, queryClient]);
	const heading = (
		<Heading
			title={m.ch_puzzle_replay_theme({ theme: THEME_NAMES[theme]() })}
			aside={
				ids.length > 0 ? (
					<p className="ch-figures text-ch-muted text-sm">
						{m.ch_puzzle_replay_count({
							index: formatNumber(Math.min(index + 1, ids.length)),
							count: formatNumber(ids.length),
						})}
					</p>
				) : null
			}
		/>
	);
	const extra = <Extra shell={shell} mode="replay" />;
	const toTraining = (
		<Button asChild variant="outline">
			<Link {...chaalLinks.puzzles({ mode: "train", theme: theme === "mix" ? undefined : theme })}>
				{m.ch_puzzle_to_training()}
			</Link>
		</Button>
	);
	if (!shell.signedIn) {
		return (
			<PuzzlePlace
				heading={heading}
				message={m.ch_puzzle_replay_connect()}
				action={
					shell.canConnect ? (
						<Button type="button" onClick={() => void shell.connect()}>
							{m.ch_connect()}
						</Button>
					) : null
				}
				extra={extra}
			/>
		);
	}
	if (replay.isPending || (id && read.isPending)) return <PuzzlePlace heading={heading} busy extra={extra} />;
	if (replay.error) {
		const reconnect = isAppError(replay.error) && replay.error.reason === "lichess-reconnect";
		return (
			<PuzzlePlace
				heading={heading}
				message={reconnect ? m.ch_puzzle_replay_connect() : errorText(replay.error)}
				action={
					reconnect && shell.canConnect ? (
						<Button type="button" onClick={() => void shell.connect()}>
							{m.ch_connect()}
						</Button>
					) : (
						toTraining
					)
				}
				extra={extra}
			/>
		);
	}
	if (!id || !read.data) {
		return (
			<PuzzlePlace
				heading={heading}
				message={id ? errorText(read.error) : m.ch_puzzle_replay_none()}
				action={toTraining}
				extra={extra}
			/>
		);
	}
	const puzzle = read.data;
	return (
		<PuzzleSolver
			key={puzzle.id}
			puzzle={puzzle}
			heading={heading}
			onResult={(result) =>
				void shell.record(attemptOf(puzzle, result, { mode: "replay", angle: theme, streak: null }))
			}
			next={index + 1 < ids.length ? <NextButton onClick={() => setIndex(index + 1)} /> : toTraining}
			extra={extra}
		/>
	);
}

function PuzzlesOff({ shell }: { shell: Shell }) {
	return (
		<PuzzlePlace
			heading={<Heading title={m.ch_puzzles_title()} />}
			message={m.ch_puzzle_off()}
			extra={shell.progressPanel}
		/>
	);
}

/**
 * /app/chaal/puzzles (PLAN Task 80, decision 0269): the daily puzzle (drawn on the server),
 * training by theme, difficulty and side, the streak, and replaying Lichess's misses. The
 * board first, the panel beside it (under it on a phone), then the modes, the choices and
 * the progress panel.
 */
export function ChaalPuzzlesPage() {
	const search = listRoute.useSearch();
	const shell = usePuzzleShell();
	const theme = angleOf(search.theme);
	let body: ReactNode;
	if (!shell.on) body = <PuzzlesOff shell={shell} />;
	else if (search.mode === "train") {
		const choice: QueueChoice = trainingInput(search);
		body = <Training key={JSON.stringify(choice)} shell={shell} choice={choice} theme={theme} />;
	} else if (search.mode === "streak") body = <Streak shell={shell} />;
	else if (search.mode === "replay") body = <Replay key={theme} shell={shell} theme={theme} />;
	else body = <DailyPuzzle shell={shell} />;
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-puzzles">
			{body}
		</main>
	);
}

/** /app/chaal/puzzles/$id (noindex): one puzzle by its Lichess id, then training. */
export function ChaalPuzzlePage() {
	const { id } = oneRoute.useParams();
	const shell = usePuzzleShell();
	const read = useQuery({ ...puzzleQueryOptions(id), enabled: shell.on });
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-puzzles">
			{shell.on ? (
				<OnePuzzle shell={shell} title={m.ch_puzzle_number({ id })} read={read} mode="single" />
			) : (
				<PuzzlesOff shell={shell} />
			)}
		</main>
	);
}
