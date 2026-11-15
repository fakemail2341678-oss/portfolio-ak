import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages";
import { formatTimeControl, speedOf } from "../../chess/lib/clock";
import { chaalLinks } from "../../links";
import { useLive } from "../../live/hooks/use-live";
import type { KeepOptions } from "../../live/lib/reader";
import { type LiveStore, liveStore } from "../../live/store";
import { Choice } from "../../local/components/choice-picker";
import { type SeekState, useSeek } from "../hooks/use-seek";
import {
	type OnlinePace,
	paceKey,
	QUICK_PAIRS,
	type QuickPairMode,
	quickPairAllows,
	RATING_RANGES,
	type RatingRange,
	SEEK_MAX_INCREMENT,
	SEEK_MAX_MINUTES,
	seekLegal,
} from "../lib/controls";
import type { PlayCalls } from "../queries";

/** A pace as a tile shows it: the clock ("10+5") or the days ("3 days"), and its speed's name. */
function tileOf(pace: OnlinePace): { main: string; speed: string } {
	if (pace.kind === "days") {
		return { main: m.chaal_online_days_short({ days: String(pace.days) }), speed: m.chaal_speed_correspondence() };
	}
	return {
		main: formatTimeControl(pace.clock),
		speed: speedOf(pace.clock) === "classical" ? m.chaal_speed_classical() : m.chaal_speed_rapid(),
	};
}

const rangeLabel = (range: RatingRange) => (range === "any" ? m.chaal_quick_range_any() : `±${range}`);

/** "0:42" since the seek started. */
const elapsed = (ms: number) => {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * Quick pairing (PLAN Task 78, decision 0267): a tile per pace the Board API may seek on
 * (rapid, classical, correspondence) and a custom clock, with rated or casual and how far
 * from the player's rating an opponent may be. A clock's seek waits here, with the time it
 * has waited and Cancel; the game opens when someone accepts. A correspondence seek waits in
 * Lichess's lobby. The tiles wait for the event stream (Lichess: open it first).
 */
export function QuickPair({
	calls,
	rated: ratedAllowed,
	mode = "all",
	stream,
	store = liveStore,
}: {
	calls: Pick<PlayCalls, "seekDays">;
	/** The admin's switch: without rated play, seeks are casual and the choice isn't offered. */
	rated: boolean;
	/** The admin's choice of paces (Task 79): every tile, only clocks or only correspondence. */
	mode?: QuickPairMode;
	/** Stories and tests pass their own. */
	stream?: (url: string, options: KeepOptions) => { stop: () => void };
	store?: LiveStore;
}) {
	const navigate = useNavigate();
	const live = useLive(store);
	const [rated, setRated] = useState(false);
	const [range, setRange] = useState<RatingRange>("any");
	const [custom, setCustom] = useState(false);
	const { seek, start, cancel } = useSeek({
		onGame: (id) => void navigate(chaalLinks.game(id)),
		seekDays: calls.seekDays,
		store,
		...(stream ? { stream } : {}),
	});
	const ready = live.status === "open";
	const seeking = seek.state === "seeking";
	const go = (pace: OnlinePace) => void start({ pace, rated: ratedAllowed && rated, range });

	return (
		<section className="ch-rule flex flex-col gap-4 pt-4" aria-labelledby="chaal-quick-title" data-testid="chaal-quick">
			<div className="flex flex-col gap-1">
				<h3 id="chaal-quick-title" className="ch-display text-xl">
					{m.chaal_quick_title()}
				</h3>
				<p className="max-w-prose text-ch-muted text-sm">{m.chaal_quick_body()}</p>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				{ratedAllowed ? (
					<Choice
						legend={m.chaal_online_mode()}
						name="quick-rated"
						value={rated ? "rated" : "casual"}
						onChange={(next) => setRated(next === "rated")}
						columns={2}
						options={[
							{ value: "casual", label: m.chaal_online_casual() },
							{ value: "rated", label: m.chaal_online_rated() },
						]}
						testId="chaal-quick-rated"
					/>
				) : null}
				<Choice
					legend={m.chaal_quick_range()}
					name="quick-range"
					value={range}
					onChange={setRange}
					columns={4}
					options={RATING_RANGES.map((value) => ({ value, label: rangeLabel(value) }))}
					testId="chaal-quick-range"
				/>
			</div>
			<ul
				className="grid grid-cols-3 gap-px border border-ch-ink bg-ch-ink sm:grid-cols-5"
				aria-label={m.chaal_quick_tiles()}
				data-testid="chaal-quick-tiles"
			>
				{QUICK_PAIRS.filter((pace) => quickPairAllows(mode, pace.kind)).map((pace) => {
					const key = paceKey(pace);
					const tile = tileOf(pace);
					const mine = seek.state !== "idle" && seek.key === key;
					return (
						<li key={key} className="flex">
							<button
								type="button"
								onClick={() => go(pace)}
								disabled={!ready || seeking}
								aria-pressed={mine && seeking}
								className="ch-press flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 bg-ch-ground px-2 py-2 text-center outline-none focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed aria-pressed:bg-ch-ink aria-pressed:text-ch-on-ink [&:disabled:not([aria-pressed=true])]:text-ch-muted"
								data-testid="chaal-quick-tile"
								data-pace={key}
							>
								<span className="ch-figures font-semibold text-lg">{tile.main}</span>
								<span className="text-xs opacity-75">{tile.speed}</span>
							</button>
						</li>
					);
				})}
				{quickPairAllows(mode, "clock") ? (
					<li className="flex">
						<button
							type="button"
							onClick={() => setCustom((open) => !open)}
							disabled={!ready || seeking}
							aria-expanded={custom}
							className="ch-press flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 bg-ch-ground px-2 py-2 text-center outline-none focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:text-ch-muted"
							data-testid="chaal-quick-custom"
						>
							<span className="font-semibold">{m.chaal_quick_custom()}</span>
							<span className="text-xs opacity-75">{m.chaal_quick_custom_hint()}</span>
						</button>
					</li>
				) : null}
			</ul>
			{custom && !seeking ? <CustomSeek onSeek={go} disabled={!ready} /> : null}
			<SeekStatus seek={seek} ready={ready} refused={live.status === "refused"} onCancel={cancel} />
		</section>
	);
}

/** A clock of the player's own: whole minutes and an increment, rapid or slower. */
function CustomSeek({ onSeek, disabled }: { onSeek: (pace: OnlinePace) => void; disabled: boolean }) {
	const id = useId();
	const [minutes, setMinutes] = useState("20");
	const [increment, setIncrement] = useState("10");
	const clock = { initial: Number(minutes) * 60, increment: Number(increment) };
	const valid = minutes.trim() !== "" && increment.trim() !== "" && seekLegal(clock);
	return (
		<form
			method="post"
			className="flex flex-wrap items-end gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				if (valid) onSeek({ kind: "clock", clock });
			}}
			data-testid="chaal-quick-custom-form"
		>
			<div className="flex flex-col gap-1.5">
				<label htmlFor={`${id}-minutes`} className="font-medium text-sm">
					{m.chaal_quick_minutes()}
				</label>
				<Input
					id={`${id}-minutes`}
					type="number"
					inputMode="numeric"
					min={0}
					max={SEEK_MAX_MINUTES}
					value={minutes}
					onChange={(event) => setMinutes(event.target.value)}
					aria-invalid={!valid || undefined}
					aria-describedby={`${id}-hint`}
					className="w-24"
					data-testid="chaal-quick-minutes"
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<label htmlFor={`${id}-increment`} className="font-medium text-sm">
					{m.chaal_quick_increment()}
				</label>
				<Input
					id={`${id}-increment`}
					type="number"
					inputMode="numeric"
					min={0}
					max={SEEK_MAX_INCREMENT}
					value={increment}
					onChange={(event) => setIncrement(event.target.value)}
					aria-invalid={!valid || undefined}
					aria-describedby={`${id}-hint`}
					className="w-24"
					data-testid="chaal-quick-increment"
				/>
			</div>
			<Button type="submit" disabled={disabled || !valid} data-testid="chaal-quick-custom-seek">
				{m.chaal_quick_seek()}
			</Button>
			<p id={`${id}-hint`} className={`basis-full text-sm ${valid ? "text-ch-muted" : "text-destructive"}`}>
				{m.chaal_quick_custom_rule()}
			</p>
		</form>
	);
}

/** What the seek is doing: waiting with its time and Cancel, posted, expired or refused. */
function SeekStatus({
	seek,
	ready,
	refused,
	onCancel,
}: {
	seek: SeekState;
	ready: boolean;
	refused: boolean;
	onCancel: () => void;
}) {
	const [now, setNow] = useState<number | null>(null);
	const since = seek.state === "seeking" ? seek.since : null;
	useEffect(() => {
		if (since === null) return;
		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), 1_000);
		return () => clearInterval(timer);
	}, [since]);

	let text: string | null = null;
	if (seek.state === "seeking") {
		text = m.chaal_quick_seeking({ pace: paceLabel(seek.key), time: elapsed((now ?? seek.since) - seek.since) });
	} else if (seek.state === "posted") text = m.chaal_quick_posted({ pace: paceLabel(seek.key) });
	else if (seek.state === "ended") text = m.chaal_quick_ended();
	else if (seek.state === "failed") text = seek.status === 429 ? m.chaal_error_lichess_wait() : m.chaal_quick_failed();
	else if (refused) text = m.chaal_quick_stream_refused();
	else if (!ready) text = m.chaal_quick_waiting_stream();

	return (
		<div className="flex flex-wrap items-center gap-3">
			<output
				className="min-h-5 text-sm"
				aria-live="polite"
				data-testid="chaal-quick-status"
				data-state={seek.state === "idle" ? (ready ? "ready" : "waiting") : seek.state}
			>
				{text}
			</output>
			{seek.state === "seeking" ? (
				<Button type="button" variant="outline" size="sm" onClick={onCancel} data-testid="chaal-quick-cancel">
					{m.chaal_challenge_cancel()}
				</Button>
			) : null}
		</div>
	);
}

/** A pace key as words: "10+5" or "3 days". */
function paceLabel(key: string): string {
	const days = /^d(\d+)$/.exec(key);
	if (days) return m.chaal_online_days_short({ days: days[1] ?? "" });
	const [initial, increment] = key.split("+").map(Number);
	return formatTimeControl({ initial: initial ?? 0, increment: increment ?? 0 });
}
