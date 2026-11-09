import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages";
import { formatTimeControl, speedOf } from "../chess/clock";
import { chaalLinks } from "../links";
import type { KeepOptions } from "../live/reader";
import { type LiveStore, liveStore, useLive } from "../live/store";
import { Choice } from "../local/choice";
import {
	type OnlinePace,
	paceKey,
	QUICK_PAIRS,
	RATING_RANGES,
	type RatingRange,
	SEEK_MAX_INCREMENT,
	SEEK_MAX_MINUTES,
	seekLegal,
} from "./controls";
import type { PlayCalls } from "./queries";
import { type SeekState, useSeek } from "./use-seek";

/** A pace as a tile shows it: the clock ("10+5") or the days ("3 days"), and its speed's name. */
function tileOf(pace: OnlinePace): { main: string; speed: string } {
	if (pace.kind === "days") {
		return { main: m.ch_online_days_short({ days: String(pace.days) }), speed: m.ch_speed_correspondence() };
	}
	return {
		main: formatTimeControl(pace.clock),
		speed: speedOf(pace.clock) === "classical" ? m.ch_speed_classical() : m.ch_speed_rapid(),
	};
}

const rangeLabel = (range: RatingRange) => (range === "any" ? m.ch_quick_range_any() : `±${range}`);

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
	stream,
	store = liveStore,
}: {
	calls: Pick<PlayCalls, "seekDays">;
	/** The admin's switch: without rated play, seeks are casual and the choice isn't offered. */
	rated: boolean;
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
					{m.ch_quick_title()}
				</h3>
				<p className="max-w-prose text-ch-muted text-sm">{m.ch_quick_body()}</p>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				{ratedAllowed ? (
					<Choice
						legend={m.ch_online_mode()}
						name="quick-rated"
						value={rated ? "rated" : "casual"}
						onChange={(next) => setRated(next === "rated")}
						columns={2}
						options={[
							{ value: "casual", label: m.ch_online_casual() },
							{ value: "rated", label: m.ch_online_rated() },
						]}
						testId="chaal-quick-rated"
					/>
				) : null}
				<Choice
					legend={m.ch_quick_range()}
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
				aria-label={m.ch_quick_tiles()}
				data-testid="chaal-quick-tiles"
			>
				{QUICK_PAIRS.map((pace) => {
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
				<li className="flex">
					<button
						type="button"
						onClick={() => setCustom((open) => !open)}
						disabled={!ready || seeking}
						aria-expanded={custom}
						className="ch-press flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 bg-ch-ground px-2 py-2 text-center outline-none focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:text-ch-muted"
						data-testid="chaal-quick-custom"
					>
						<span className="font-semibold">{m.ch_quick_custom()}</span>
						<span className="text-xs opacity-75">{m.ch_quick_custom_hint()}</span>
					</button>
				</li>
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
					{m.ch_quick_minutes()}
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
					{m.ch_quick_increment()}
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
				{m.ch_quick_seek()}
			</Button>
			<p id={`${id}-hint`} className={`basis-full text-sm ${valid ? "text-ch-muted" : "text-destructive"}`}>
				{m.ch_quick_custom_rule()}
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
		text = m.ch_quick_seeking({ pace: paceLabel(seek.key), time: elapsed((now ?? seek.since) - seek.since) });
	} else if (seek.state === "posted") text = m.ch_quick_posted({ pace: paceLabel(seek.key) });
	else if (seek.state === "ended") text = m.ch_quick_ended();
	else if (seek.state === "failed") text = seek.status === 429 ? m.ch_error_lichess_wait() : m.ch_quick_failed();
	else if (refused) text = m.ch_quick_stream_refused();
	else if (!ready) text = m.ch_quick_waiting_stream();

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
					{m.ch_challenge_cancel()}
				</Button>
			) : null}
		</div>
	);
}

/** A pace key as words: "10+5" or "3 days". */
function paceLabel(key: string): string {
	const days = /^d(\d+)$/.exec(key);
	if (days) return m.ch_online_days_short({ days: days[1] ?? "" });
	const [initial, increment] = key.split("+").map(Number);
	return formatTimeControl({ initial: initial ?? 0, increment: increment ?? 0 });
}
