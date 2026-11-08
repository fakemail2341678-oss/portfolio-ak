import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { type ClockState, remaining } from "../chess/clock";
import { type Color, type GameResult, opposite, type PlayedMove, play, turnOf } from "../chess/rules";
import type { Engine } from "../engine/engine";
import { chaalKeys } from "../keys";
import { writeBrowserGame } from "./browser";
import {
	addLocalMove,
	canTakeBack,
	computerToMove,
	endLocalGame,
	fenOf,
	flagResult,
	isOver,
	resignResult,
	stateOf,
	takeBack,
	toRecord,
} from "./game";
import type { LocalEndReason, LocalGame, LocalGameRecord } from "./types";

/**
 * A local game being played (PLAN Task 76, decision 0265): the game, its two clocks on a
 * monotonic time, the computer's moves, and saving as it goes. Pages render from it and
 * call its actions; the board's moves come in already played (`onMove`).
 *
 * - **Clocks** run from the first move (the side that moved gets its increment), stop
 *   when the game ends or is paused, and a flag ends it (`flagResult`). A game opened
 *   again with a clock starts paused: "Continue" starts the side to move.
 * - **The computer** (engine games) is Stockfish in a worker, loaded when the page opens
 *   (`await import()`), asked for a move at the game's level whenever it's its turn, and
 *   held while paused or while fair play locks the engine. It never shows a score.
 * - **Saving:** without a session, to this browser at once; with one, to the account
 *   after the moves settle (and at once when the game ends or the page goes), falling back
 *   to this browser when the server can't be reached (the frame imports it later).
 */

/** The computer's move shows no sooner than this after the player's, so it reads as a reply. */
const COMPUTER_MIN_MS = 350;
/** How long moves settle before a session's game is written. */
const SAVE_DEBOUNCE_MS = 700;

export type ComputerStatus = "off" | "loading" | "thinking" | "waiting" | "failed";

export type LocalGameView = {
	game: LocalGame;
	fen: string;
	clock: ClockState | null;
	/** Paused with a clock: the board waits for "Continue". */
	paused: boolean;
	computer: { status: ComputerStatus; progress: number };
	/** A draw the side to move may claim now. */
	claim: "threefold" | "fifty" | null;
	canTakeBack: boolean;
	/** Whose move the screen waits for: a person's (the board takes it) or nobody's. */
	movable: Color | null;
	move: (played: PlayedMove) => void;
	takeBack: () => void;
	resign: (side: Color) => void;
	agreeDraw: () => void;
	claimDraw: () => void;
	pause: () => void;
	resume: () => void;
};

const now = () => performance.now();

/** The clocks as the game left them; none running until a move or "Continue". */
const clockOf = (game: LocalGame): ClockState | null =>
	game.clocks ? { white: game.clocks.white, black: game.clocks.black, running: null, since: 0 } : null;

/** The clocks stopped at `at`, with the running side's time taken off. */
const stopped = (state: ClockState, at: number): ClockState =>
	state.running ? { ...state, [state.running]: remaining(state, state.running, at), running: null, since: at } : state;

const clocksOf = (state: ClockState | null) => (state ? { white: state.white, black: state.black } : null);

export function useLocalGame({
	initial,
	signedIn,
	locked = false,
	createEngine: makeEngine,
}: {
	initial: LocalGame;
	signedIn: boolean;
	/** Fair play: the computer waits while a real-time game on Lichess runs. */
	locked?: boolean;
	/** Tests and stories pass their own; pages load the real one. */
	createEngine?: () => Engine;
}): LocalGameView {
	const [game, setGame] = useState(initial);
	const [clock, setClock] = useState<ClockState | null>(() => clockOf(initial));
	const fen = fenOf(game);
	const turn = turnOf(fen);
	const over = isOver(game);
	const paused = Boolean(clock && clock.running === null && game.moves.length > 0 && !over);

	// The latest state for what outlives a render (the computer's reply, the flag's timer):
	// written by every change at once, so a callback never acts on an older position.
	const latest = useRef({ game, clock });
	const engine = useRef<Engine | null>(null);
	const [actions] = useState(() => createActions(latest, setGame, setClock, engine));

	// A flag falls: checked every 100 ms while a clock runs.
	useEffect(() => {
		if (!clock?.running || over) return;
		const timer = setInterval(() => {
			const state = latest.current.clock;
			if (!state?.running) return;
			const at = now();
			if (remaining(state, state.running, at) > 0) return;
			const flagged = state.running;
			const { result, reason } = flagResult(fenOf(latest.current.game), flagged);
			const frozen = { ...stopped(state, at), [flagged]: 0 };
			actions.apply(endLocalGame(latest.current.game, result, reason, new Date(), clocksOf(frozen)), frozen);
		}, 100);
		return () => clearInterval(timer);
	}, [clock?.running, over, actions]);

	// The computer: loaded when an engine game opens, quit when the page goes.
	const [computer, setComputer] = useState<{ status: ComputerStatus; progress: number }>({
		status: initial.mode === "engine" ? "loading" : "off",
		progress: 0,
	});
	const [ready, setReady] = useState(false);
	const isEngineGame = initial.mode === "engine";
	// The first one given is the one used: a new function each render mustn't restart the engine.
	const [factory] = useState(() => makeEngine);
	useEffect(() => {
		if (!isEngineGame) return;
		let cancelled = false;
		const load = factory
			? Promise.resolve(factory())
			: import("../engine/engine").then(({ createEngine }) =>
					createEngine({
						onProgress: ({ loaded, total }) =>
							setComputer((value) => ({ ...value, progress: total > 0 ? Math.min(1, loaded / total) : 0 })),
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
				if (!cancelled) setReady(true);
			})
			.catch(() => {
				if (!cancelled) setComputer({ status: "failed", progress: 0 });
			});
		return () => {
			cancelled = true;
			engine.current?.quit();
			engine.current = null;
		};
	}, [isEngineGame, factory]);

	const computerTurn = computerToMove(game);
	useEffect(() => {
		const current = engine.current;
		if (!isEngineGame || !ready || !current) return;
		if (!computerTurn) {
			setComputer({ status: "waiting", progress: 1 });
			return;
		}
		if (paused || locked) {
			setComputer({ status: "waiting", progress: 1 });
			return;
		}
		let cancelled = false;
		const asked = fen;
		const started = now();
		setComputer({ status: "thinking", progress: 1 });
		void current.bestMove(asked, { level: latest.current.game.level ?? 1 }).then(async (result) => {
			if (cancelled || result.stopped || !result.bestMove) return;
			const wait = COMPUTER_MIN_MS - (now() - started);
			if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
			if (cancelled || fenOf(latest.current.game) !== asked) return;
			const played = play(asked, result.bestMove);
			if (played) actions.move(played);
		});
		return () => {
			cancelled = true;
			current.stop();
		};
	}, [isEngineGame, ready, computerTurn, fen, paused, locked, actions]);

	// Saving: each change after the first render.
	const save = useGameSaver(signedIn);
	const first = useRef(true);
	useEffect(() => {
		if (first.current) {
			first.current = false;
			return;
		}
		save.queue(toRecord(game), isOver(game));
	}, [game, save.queue]);
	useEffect(() => save.flush, [save.flush]);

	const state = stateOf(game);
	const humans: Color | null = over || paused ? null : game.mode === "board" ? turn : turn === game.color ? turn : null;
	return {
		game,
		fen,
		clock,
		paused,
		computer: isEngineGame ? computer : { status: "off", progress: 0 },
		claim: humans ? state.claim : null,
		canTakeBack: canTakeBack(game) && !paused,
		movable: humans,
		move: actions.move,
		takeBack: actions.takeBack,
		resign: actions.resign,
		agreeDraw: actions.agreeDraw,
		claimDraw: actions.claimDraw,
		pause: actions.pause,
		resume: actions.resume,
	};
}

type Latest = { current: { game: LocalGame; clock: ClockState | null } };

/** The game's actions, made once: they read and write through `latest`, never a render's copy. */
function createActions(
	latest: Latest,
	setGame: (game: LocalGame) => void,
	setClock: (clock: ClockState | null) => void,
	engine: { current: Engine | null },
) {
	const apply = (next: LocalGame, nextClock: ClockState | null) => {
		latest.current = { game: next, clock: nextClock };
		setGame(next);
		setClock(nextClock);
	};
	const end = (result: GameResult, reason: LocalEndReason) => {
		const { game: current, clock: running } = latest.current;
		const frozen = running ? stopped(running, now()) : null;
		apply(endLocalGame(current, result, reason, new Date(), clocksOf(frozen)), frozen);
	};
	return {
		apply,
		move: (played: PlayedMove) => {
			const { game: current, clock: running } = latest.current;
			if (isOver(current) || played.fen === fenOf(current)) return;
			const at = now();
			let nextClock = running;
			if (current.clock && running) {
				const mover = turnOf(fenOf(current));
				const left =
					(running.running === mover ? remaining(running, mover, at) : running[mover]) + current.clock.increment * 1000;
				nextClock = { ...running, [mover]: left, running: opposite(mover), since: at };
			}
			const next = addLocalMove(current, played, clocksOf(nextClock), new Date());
			apply(next, isOver(next) && nextClock ? stopped(nextClock, at) : nextClock);
		},
		takeBack: () => {
			const { game: current, clock: running } = latest.current;
			if (!canTakeBack(current)) return;
			engine.current?.stop();
			const next = takeBack(current, new Date());
			const nextClock =
				running && next.clocks
					? {
							white: next.clocks.white,
							black: next.clocks.black,
							running: running.running ? turnOf(fenOf(next)) : null,
							since: now(),
						}
					: running;
			apply(next, nextClock);
		},
		resign: (side: Color) => end(resignResult(side), "resign"),
		agreeDraw: () => end("1/2-1/2", "agreement"),
		claimDraw: () => {
			const claim = stateOf(latest.current.game).claim;
			if (claim) end("1/2-1/2", claim);
		},
		pause: () => {
			const running = latest.current.clock;
			if (running?.running) apply(latest.current.game, stopped(running, now()));
		},
		resume: () => {
			const running = latest.current.clock;
			if (running && !running.running && !isOver(latest.current.game)) {
				apply(latest.current.game, { ...running, running: turnOf(fenOf(latest.current.game)), since: now() });
			}
		},
	};
}

/**
 * Writes a game where it lives: this browser without a session (at once), the account with
 * one (debounced; at once for a finished game or when the page goes), and the browser
 * again if the account's write fails.
 */
function useGameSaver(signedIn: boolean) {
	const queryClient = useQueryClient();
	const pending = useRef<LocalGameRecord | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const session = useRef(signedIn);
	session.current = signedIn;

	const [api] = useState(() => {
		const send = (record: LocalGameRecord) => {
			queryClient.setQueryData(chaalKeys.localGame(record.id), record);
			void import("./queries")
				.then(({ saveLocalGameOnAccount }) => saveLocalGameOnAccount(record))
				.then(() => queryClient.invalidateQueries({ queryKey: chaalKeys.localGames(), exact: true }))
				.catch(() => {
					// Kept here until a page with the session imports it (useImportLocalGames).
					writeBrowserGame(record);
				});
		};
		const flush = () => {
			if (timer.current) clearTimeout(timer.current);
			timer.current = null;
			const record = pending.current;
			pending.current = null;
			if (record) send(record);
		};
		const queue = (record: LocalGameRecord, now: boolean) => {
			if (!session.current) {
				writeBrowserGame(record);
				return;
			}
			pending.current = record;
			if (timer.current) clearTimeout(timer.current);
			timer.current = now ? null : setTimeout(flush, SAVE_DEBOUNCE_MS);
			if (now) flush();
		};
		return { queue, flush };
	});

	// The page going away (a closed tab, a phone switching apps) writes what's waiting.
	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") api.flush();
		};
		window.addEventListener("pagehide", api.flush);
		document.addEventListener("visibilitychange", onHide);
		return () => {
			window.removeEventListener("pagehide", api.flush);
			document.removeEventListener("visibilitychange", onHide);
		};
	}, [api]);

	return api;
}
