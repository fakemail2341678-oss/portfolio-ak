import { useEffect, useState } from "react";
import { m } from "@/paraglide/messages";
import { clockParts, formatClock } from "../chess/clock";
import type { Color } from "../chess/rules";
import { sideName } from "../chess/speech";

/** A clock's time in words, for its accessible name: "8 min 15 s", "9.4 s". */
export function spokenClock(ms: number): string {
	const { hours, minutes, seconds, tenths } = clockParts(ms);
	if (hours > 0) return m.ch_clock_hours({ hours, minutes });
	if (minutes > 0) return m.ch_clock_minutes({ minutes, seconds });
	return m.ch_clock_seconds({ seconds: ms < 10_000 ? `${seconds}.${tenths}` : String(seconds) });
}

/**
 * A player's clock (PLAN 13.5, `Clock`): Mukta figures, tabular so they never shift. The
 * side to move is in ink, the other in grey (the comps); under `low` ms the running clock
 * turns to an ink block. It counts down by itself from `ms`, which was the time left at
 * `since` (a `performance.now()` time), so a late render or a reconnect never jumps it.
 * The server renders `ms` as given.
 */
export function Clock({
	ms,
	color,
	running = false,
	since,
	low = 10_000,
	className,
}: {
	ms: number;
	color: Color;
	running?: boolean;
	since?: number;
	low?: number;
	className?: string;
}) {
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		if (!running) {
			setNow(null);
			return;
		}
		setNow(performance.now());
		const timer = setInterval(() => setNow(performance.now()), 100);
		return () => clearInterval(timer);
	}, [running]);
	const left = Math.max(0, running && now !== null && since !== undefined ? ms - (now - since) : ms);
	const isLow = running && left < low;
	return (
		<div
			role="timer"
			aria-label={m.ch_clock_label({ side: sideName(color), time: spokenClock(left) })}
			data-running={running || undefined}
			data-low={isLow || undefined}
			className={`ch-display ch-figures text-ch-clock ${isLow ? "bg-ch-ink px-2 text-ch-on-ink" : running ? "text-ch-ink" : "text-ch-muted"} ${className ?? ""}`}
			dir="ltr"
		>
			<span aria-hidden>{formatClock(left)}</span>
		</div>
	);
}
