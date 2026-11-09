import { Link } from "@tanstack/react-router";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { chaalLinks } from "../links";
import { isPuzzleAngle } from "./angles";
import { weakestThemes } from "./progress";
import type { ChaalPuzzleProgress, PuzzleStats } from "./schema";
import { THEME_NAMES } from "./themes";

const RECENT_SHOWN = 5;
const LICHESS_THEMES_SHOWN = 5;

const signed = (value: number) => (value > 0 ? `+${formatNumber(value)}` : formatNumber(value));

function LichessPart({
	lichess,
	pending,
	canConnect,
	onConnect,
}: {
	lichess: ChaalPuzzleProgress["lichess"] | null;
	pending: number;
	canConnect: boolean;
	onConnect: () => void;
}) {
	if (!lichess || lichess.state === "connect") {
		return canConnect ? (
			<div className="flex flex-col items-start gap-2">
				<p className="text-ch-muted text-sm">{m.ch_puzzle_connect_hint()}</p>
				<Button type="button" variant="outline" size="sm" onClick={onConnect} data-testid="chaal-puzzle-connect">
					{m.ch_connect()}
				</Button>
			</div>
		) : null;
	}
	if (lichess.state === "reconnect") {
		return canConnect ? (
			<div className="flex flex-col items-start gap-2">
				<p className="text-ch-muted text-sm">{m.ch_puzzle_reconnect_hint()}</p>
				<Button type="button" variant="outline" size="sm" onClick={onConnect} data-testid="chaal-puzzle-reconnect">
					{m.ch_reconnect()}
				</Button>
			</div>
		) : null;
	}
	if (lichess.state !== "ok") {
		return (
			<p className="text-ch-muted text-sm">
				{lichess.state === "wait" ? m.ch_error_lichess_wait() : m.ch_puzzle_lichess_unavailable()}
			</p>
		);
	}
	const { dashboard } = lichess;
	return (
		<div className="flex flex-col gap-2" data-testid="chaal-puzzle-lichess">
			<h3 className="font-medium text-sm">{m.ch_puzzle_on_lichess({ days: formatNumber(dashboard.days) })}</h3>
			<p className="text-sm">
				{m.ch_puzzle_lichess_summary({
					nb: formatNumber(dashboard.nb),
					firstWins: formatNumber(dashboard.firstWins),
					performance: formatNumber(dashboard.performance),
				})}
			</p>
			{pending > 0 ? (
				<p className="text-ch-muted text-xs">{m.ch_puzzle_pending({ count: formatNumber(pending) })}</p>
			) : null}
			<ul className="flex flex-col">
				{dashboard.themes
					.filter((theme) => isPuzzleAngle(theme.key))
					.slice(0, LICHESS_THEMES_SHOWN)
					.map((theme) => (
						<li key={theme.key} className="ch-hairline flex items-center justify-between gap-3 py-1.5 text-sm">
							<span className="min-w-0 truncate">
								{isPuzzleAngle(theme.key) ? THEME_NAMES[theme.key]() : theme.key}
							</span>
							<span className="flex shrink-0 items-center gap-3">
								<span className="ch-figures text-ch-muted text-xs">
									{m.ch_puzzle_first_wins({ won: formatNumber(theme.firstWins), nb: formatNumber(theme.nb) })}
								</span>
								{theme.firstWins < theme.nb && isPuzzleAngle(theme.key) ? (
									<Link
										{...chaalLinks.puzzles({ mode: "replay", theme: theme.key })}
										className="text-xs underline underline-offset-2"
										data-testid={`chaal-puzzle-replay-${theme.key}`}
									>
										{m.ch_puzzle_replay_misses()}
									</Link>
								) : null}
							</span>
						</li>
					))}
			</ul>
		</div>
	);
}

/**
 * The progress panel (PLAN Task 80: "a local dashboard", and Lichess's for a connected
 * player): the last 30 days' puzzles, the best streak, themes to work on, the latest
 * attempts, then Lichess's own figures with its misses to replay. Its height is kept, so a
 * visitor's figures (read from this browser after hydration) move nothing.
 */
export function PuzzleProgress({
	stats,
	lichess,
	pending,
	canConnect,
	onConnect,
}: {
	stats: PuzzleStats;
	lichess: ChaalPuzzleProgress["lichess"] | null;
	pending: number;
	canConnect: boolean;
	onConnect: () => void;
}) {
	const weak = weakestThemes(stats);
	return (
		<section
			className="ch-rule flex min-h-[16rem] flex-col gap-3 pt-3"
			aria-labelledby="chaal-puzzle-progress"
			data-testid="chaal-puzzle-progress"
		>
			<h2 id="chaal-puzzle-progress" className="ch-display text-ch-head">
				{m.ch_puzzle_progress()}
			</h2>
			{stats.nb === 0 && stats.bestStreak === 0 ? (
				<p className="text-ch-muted text-sm">{m.ch_puzzle_progress_empty()}</p>
			) : (
				<>
					<dl className="grid grid-cols-3 gap-2 text-center">
						<div>
							<dt className="text-ch-muted text-xs">
								{m.ch_puzzle_progress_solved({ days: formatNumber(stats.days) })}
							</dt>
							<dd className="ch-figures text-lg" data-testid="chaal-puzzle-solved">
								{m.ch_puzzle_progress_of({ won: formatNumber(stats.won), nb: formatNumber(stats.nb) })}
							</dd>
						</div>
						<div>
							<dt className="text-ch-muted text-xs">{m.ch_puzzle_progress_rate()}</dt>
							<dd className="ch-figures text-lg">
								{stats.nb > 0 ? formatNumber(stats.won / stats.nb, { style: "percent" }) : "—"}
							</dd>
						</div>
						<div>
							<dt className="text-ch-muted text-xs">{m.ch_puzzle_best_streak()}</dt>
							<dd className="ch-figures text-lg" data-testid="chaal-puzzle-best-streak">
								{formatNumber(stats.bestStreak)}
							</dd>
						</div>
					</dl>
					{weak.length > 0 ? (
						<p className="text-sm">
							{m.ch_puzzle_work_on()}{" "}
							{weak.map((theme, index) => (
								<span key={theme.key}>
									{index > 0 ? ", " : null}
									<Link
										{...chaalLinks.puzzles({ mode: "train", theme: theme.key })}
										className="underline underline-offset-2"
									>
										{isPuzzleAngle(theme.key) ? THEME_NAMES[theme.key]() : theme.key}
									</Link>
								</span>
							))}
						</p>
					) : null}
					{stats.recent.length > 0 ? (
						<ul className="flex flex-col" aria-label={m.ch_puzzle_recent()} data-testid="chaal-puzzle-recent">
							{stats.recent.slice(0, RECENT_SHOWN).map((attempt) => (
								<li key={attempt.id} className="ch-hairline flex items-center gap-3 py-1.5 text-sm">
									{attempt.won ? (
										<CheckIcon aria-hidden className="size-4" />
									) : (
										<XIcon aria-hidden className="size-4 text-ch-muted" />
									)}
									<span className="sr-only">{attempt.won ? m.ch_puzzle_won() : m.ch_puzzle_lost()}</span>
									<Link {...chaalLinks.puzzle(attempt.puzzleId)} className="underline-offset-2 hover:underline">
										{m.ch_puzzle_number({ id: attempt.puzzleId })}
									</Link>
									<span className="ch-figures ms-auto text-ch-muted">{formatNumber(attempt.rating)}</span>
									{attempt.ratingDiff !== null ? (
										<span className="ch-figures w-10 text-end text-xs">{signed(attempt.ratingDiff)}</span>
									) : null}
								</li>
							))}
						</ul>
					) : null}
				</>
			)}
			<LichessPart lichess={lichess} pending={pending} canConnect={canConnect} onConnect={onConnect} />
		</section>
	);
}
