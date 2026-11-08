import { useEffect, useRef, useState } from "react";
import type { Score } from "../chess/eval";
import type { Engine } from "./engine";
import type { EngineLimits } from "./limits";
import type { EngineInfo } from "./uci";

/**
 * The engine on a page (PLAN 13.5, "Lifecycle"; decision 0263): one per page, started on
 * demand (the first `start()` downloads it, with progress), analysing the position shown
 * while it's on, paused while the tab is hidden, and ended when the page goes. The client
 * is a lazy import, so a page that never starts it never loads it.
 *
 * `skip` holds the local search back (a cloud eval already answers this position, or
 * fair play locks the engine); `limits` come from `ch_settings` (getChaalStatus).
 */
export type EngineLine = { multipv: number; depth: number; score: Score; pv: string[] };

export type EngineStatus = "off" | "loading" | "running" | "done" | "paused" | "failed";

export type EngineView = {
	status: EngineStatus;
	/** The download, 0–1, while loading. */
	progress: number;
	/** The position's lines, best first, for `fen` only. */
	lines: EngineLine[];
	depth: number;
	/** The finished search's best score (for the graph), with the FEN it belongs to. */
	settled: { fen: string; score: Score; depth: number } | null;
	start: () => void;
	stop: () => void;
};

/** How often lines reach React while the engine deepens: enough to read, not a render per line. */
const FLUSH_MS = 120;

export function useEngine({
	fen,
	limits,
	skip = false,
	createEngine: makeEngine,
}: {
	fen: string;
	limits: EngineLimits;
	skip?: boolean;
	/** Tests and stories pass their own; pages load the real one. */
	createEngine?: (onProgress: (loaded: number, total: number) => void) => Engine;
}): EngineView {
	const [on, setOn] = useState(false);
	const [status, setStatus] = useState<EngineStatus>("off");
	const [progress, setProgress] = useState(0);
	const [lines, setLines] = useState<{ fen: string; lines: EngineLine[] }>({ fen, lines: [] });
	const [settled, setSettled] = useState<EngineView["settled"]>(null);
	const [hidden, setHidden] = useState(false);
	const engine = useRef<Engine | null>(null);
	const [loaded, setLoaded] = useState(false);

	// Ends the worker when the page goes.
	useEffect(
		() => () => {
			engine.current?.quit();
			engine.current = null;
		},
		[],
	);

	// Paused while the tab is hidden: a phone in a pocket shouldn't search.
	useEffect(() => {
		const update = () => setHidden(document.visibilityState === "hidden");
		update();
		document.addEventListener("visibilitychange", update);
		return () => document.removeEventListener("visibilitychange", update);
	}, []);

	// Loads the engine the first time it's turned on.
	useEffect(() => {
		if (!on || engine.current) return;
		let cancelled = false;
		setStatus("loading");
		setProgress(0);
		const onProgress = (done: number, total: number) => setProgress(total > 0 ? Math.min(1, done / total) : 0);
		const load = makeEngine
			? Promise.resolve(makeEngine(onProgress))
			: import("./engine").then(({ createEngine }) =>
					createEngine({
						hashMb: limits.hashMb,
						onProgress: ({ loaded: done, total }) => onProgress(done, total),
					}),
				);
		load
			.then(async (created) => {
				if (cancelled) {
					created.quit();
					return;
				}
				engine.current = created;
				await created.ready;
				if (!cancelled) {
					setProgress(1);
					setLoaded(true);
				}
			})
			.catch(() => {
				if (!cancelled) setStatus("failed");
			});
		return () => {
			cancelled = true;
		};
	}, [on, makeEngine, limits.hashMb]);

	// Analyses the position shown while the engine is on, ready, visible and not held back.
	useEffect(() => {
		const current = engine.current;
		if (!on || !loaded || !current) return;
		if (hidden || skip) {
			current.stop();
			setStatus(hidden ? "paused" : "done");
			return;
		}
		const latest: EngineLine[] = [];
		let timer: ReturnType<typeof setTimeout> | null = null;
		const flush = () => {
			timer = null;
			setLines({ fen, lines: [...latest] });
		};
		setStatus("running");
		setLines({ fen, lines: [] });
		const searched = fen;
		void current
			.analyse(fen, { multiPv: limits.multiPv, depth: limits.maxDepth }, (info: EngineInfo) => {
				// Each line is replaced as its next depth arrives (the others keep theirs meanwhile).
				latest[info.multipv - 1] = { multipv: info.multipv, depth: info.depth, score: info.score, pv: info.pv };
				if (!timer) timer = setTimeout(flush, FLUSH_MS);
			})
			.then((result) => {
				if (timer) clearTimeout(timer);
				timer = null;
				if (result.stopped) return;
				setLines({ fen: searched, lines: [...latest] });
				const best = latest[0];
				if (best) setSettled({ fen: searched, score: best.score, depth: best.depth });
				setStatus("done");
			});
		return () => {
			if (timer) clearTimeout(timer);
		};
	}, [on, loaded, fen, hidden, skip, limits.multiPv, limits.maxDepth]);

	const shown = lines.fen === fen ? lines.lines.filter(Boolean) : [];
	return {
		status: on ? status : "off",
		progress,
		lines: shown,
		depth: shown[0]?.depth ?? 0,
		settled,
		start: () => setOn(true),
		stop: () => {
			setOn(false);
			engine.current?.stop();
			setStatus("off");
		},
	};
}
