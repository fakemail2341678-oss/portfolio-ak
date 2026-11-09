/**
 * The fake Lichess's online play (Task 77, decision 0266): challenges (to a player, kept
 * open by `keepAliveStream`, open links, the AI), games on the Board API with clocks and
 * moves checked by chess.js, a scripted Lichess AI, offers, endings, chat and "opponent
 * gone", in the shapes Lichess sends. The rival's side is played by the tests through
 * `/e2e/lichess/*` controls. Everything lives in memory until `DELETE /e2e/lichess`.
 *
 * Task 78 adds seeks (a clock's held open with keepalives and cancelled when it closes, a
 * correspondence one answered with its id; the rival accepts one through
 * `POST /e2e/lichess/seek-accept`), `GET /api/account/playing`, and arena games
 * (`POST /e2e/lichess/arena`) with berserk.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { Chess } from "chess.js";

export type Account = "e2e_player" | "e2e_rival";
type Color = "white" | "black";

const ACCOUNTS: Record<Account, { id: Account; name: string; title: string | null; rating: number }> = {
	e2e_player: { id: "e2e_player", name: "E2E_Player", title: null, rating: 1603 },
	e2e_rival: { id: "e2e_rival", name: "E2E_Rival", title: "FM", rating: 2210 },
};

const accountByName = (name: string): Account | null => {
	const lower = name.toLowerCase();
	return lower === "e2e_player" || lower === "e2e_rival" ? lower : null;
};

/** The AI's moves, by its colour, played when legal (else its first legal move in SAN order). */
const AI_SCRIPT: Record<Color, string[]> = {
	// White plays 1. e4, 2. Bc4, 3. Qh5, 4. Qxf7#: the AI as Black walks into it.
	black: ["e7e5", "b8c6", "g8f6", "a7a6", "h7h6"],
	white: ["e2e4", "g1f3", "f1c4", "b1c3", "d2d3"],
};

type Side = { account: Account } | { ai: number };
type Clock = { initial: number; increment: number };

type Game = {
	id: string;
	white: Side;
	black: Side;
	clock: Clock | null;
	days: number | null;
	rated: boolean;
	source: "ai" | "friend" | "lobby";
	tournamentId: string | null;
	chess: Chess;
	moves: string[];
	wtime: number;
	btime: number;
	lastMoveAt: number;
	status: string;
	winner: Color | null;
	offers: { wdraw: boolean; bdraw: boolean; wtakeback: boolean; btakeback: boolean };
	chat: Array<{ user: string; text: string }>;
	streams: Map<Account, Set<ServerResponse>>;
	timer?: ReturnType<typeof setTimeout>;
	createdAt: number;
};

/** A seek in the lobby: a clock's keeps its response open; a correspondence one waits. */
type Seek = {
	id: string;
	account: Account;
	clock: Clock | null;
	days: number | null;
	rated: boolean;
	response: ServerResponse | null;
};

type Challenge = {
	id: string;
	challenger: Account | null;
	dest: Account | null;
	clock: Clock | null;
	days: number | null;
	color: "white" | "black" | "random";
	rated: boolean;
	status: "created" | "accepted" | "declined" | "canceled";
	keepAlive: ServerResponse | null;
	/** An open challenge: who joined, by colour. */
	open: Partial<Record<Color, Account>> | null;
};

export type PlayDeps = {
	/** Sends an event to the account's open event streams. */
	emit: (account: Account, event: unknown) => void;
};

let next = 0;
const newId = () => {
	next += 1;
	return `g${String(next).padStart(3, "0")}${Math.random().toString(36).slice(2, 6)}`.slice(0, 8).padEnd(8, "x");
};

const json = (response: ServerResponse, status: number, body: unknown) => {
	response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
	response.end(JSON.stringify(body));
};

const readForm = async (request: IncomingMessage) => {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(chunk as Buffer);
	return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
};

const other = (color: Color): Color => (color === "white" ? "black" : "white");
const speedOf = (clock: Clock | null) => {
	if (!clock) return "correspondence";
	const estimate = clock.initial / 1000 + (40 * clock.increment) / 1000;
	return estimate < 180 ? "bullet" : estimate < 480 ? "blitz" : estimate < 1500 ? "rapid" : "classical";
};

export function createPlay({ emit }: PlayDeps) {
	const games = new Map<string, Game>();
	const challenges = new Map<string, Challenge>();
	const seeks = new Map<string, Seek>();

	const accountOf = (side: Side): Account | null => ("account" in side ? side.account : null);
	const colorOf = (game: Game, account: Account): Color | null =>
		accountOf(game.white) === account ? "white" : accountOf(game.black) === account ? "black" : null;
	const turn = (game: Game): Color => (game.chess.turn() === "w" ? "white" : "black");
	const over = (game: Game) => game.status !== "started";

	const player = (side: Side) =>
		"account" in side
			? {
					id: ACCOUNTS[side.account].id,
					name: ACCOUNTS[side.account].name,
					title: ACCOUNTS[side.account].title,
					rating: ACCOUNTS[side.account].rating,
				}
			: { aiLevel: side.ai };

	const stateOf = (game: Game) => {
		const now = Date.now();
		const running = !over(game) && game.clock && game.moves.length >= 2 ? turn(game) : null;
		const left = (color: Color) => {
			const base = color === "white" ? game.wtime : game.btime;
			return running === color ? Math.max(0, base - (now - game.lastMoveAt)) : base;
		};
		return {
			type: "gameState",
			moves: game.moves.join(" "),
			wtime: left("white"),
			btime: left("black"),
			winc: game.clock?.increment ?? 0,
			binc: game.clock?.increment ?? 0,
			status: game.status,
			...(game.winner ? { winner: game.winner } : {}),
			...(game.offers.wdraw ? { wdraw: true } : {}),
			...(game.offers.bdraw ? { bdraw: true } : {}),
			...(game.offers.wtakeback ? { wtakeback: true } : {}),
			...(game.offers.btakeback ? { btakeback: true } : {}),
		};
	};

	/** A side's time now: its clock, or for correspondence the days a move less the time since the last one. */
	const timeLeft = (game: Game, color: Color) => {
		if (!game.clock) {
			const allowed = (game.days ?? 3) * 86_400_000;
			return !over(game) && turn(game) === color ? Math.max(0, allowed - (Date.now() - game.lastMoveAt)) : allowed;
		}
		const base = color === "white" ? game.wtime : game.btime;
		const running = !over(game) && game.moves.length >= 2 && turn(game) === color;
		return running ? Math.max(0, base - (Date.now() - game.lastMoveAt)) : base;
	};

	const fullOf = (game: Game) => ({
		type: "gameFull",
		id: game.id,
		variant: { key: "standard", name: "Standard", short: "Std" },
		speed: speedOf(game.clock),
		perf: { name: speedOf(game.clock) },
		rated: game.rated,
		createdAt: game.createdAt,
		white: player(game.white),
		black: player(game.black),
		initialFen: "startpos",
		...(game.clock ? { clock: game.clock } : { daysPerTurn: game.days }),
		...(game.tournamentId ? { tournamentId: game.tournamentId } : {}),
		state: stateOf(game),
	});

	/** A game as the event stream tells one player of it. */
	const eventGame = (game: Game, account: Account) => {
		const color = colorOf(game, account) ?? "white";
		const opponent = color === "white" ? game.black : game.white;
		const theirs = "account" in opponent ? ACCOUNTS[opponent.account] : null;
		return {
			fullId: `${game.id}abcd`,
			gameId: game.id,
			id: game.id,
			fen: game.chess.fen(),
			color,
			lastMove: game.moves.at(-1) ?? "",
			source: game.source,
			status: { id: over(game) ? 30 : 20, name: game.status },
			variant: { key: "standard", name: "Standard" },
			speed: speedOf(game.clock),
			perf: speedOf(game.clock),
			rated: game.rated,
			hasMoved: game.moves.length >= (color === "white" ? 1 : 2),
			opponent: theirs
				? { id: theirs.id, username: theirs.name, rating: theirs.rating }
				: {
						id: null,
						username: `Stockfish level ${"ai" in opponent ? opponent.ai : 1}`,
						ai: "ai" in opponent ? opponent.ai : 1,
					},
			isMyTurn: !over(game) && turn(game) === color,
			secondsLeft: Math.round(timeLeft(game, color) / 1000),
			...(game.tournamentId ? { tournamentId: game.tournamentId } : {}),
			...(game.winner ? { winner: game.winner } : {}),
			...(over(game) && game.rated ? { ratingDiff: game.winner === color ? 8 : game.winner ? -8 : 0 } : {}),
			compat: { bot: false, board: true },
		};
	};

	const send = (response: ServerResponse, value: unknown) => {
		if (!response.writableEnded) response.write(`${JSON.stringify(value)}\n`);
	};

	const broadcast = (game: Game, value: unknown) => {
		for (const set of game.streams.values()) for (const response of set) send(response, value);
	};

	const players = (game: Game) =>
		[accountOf(game.white), accountOf(game.black)].filter((a): a is Account => a !== null);

	const finish = (game: Game, status: string, winner: Color | null) => {
		game.status = status;
		game.winner = winner;
		clearTimeout(game.timer);
		broadcast(game, stateOf(game));
		for (const set of game.streams.values()) for (const response of set) response.end();
		game.streams.clear();
		for (const account of players(game)) emit(account, { type: "gameFinish", game: eventGame(game, account) });
	};

	/** Starts the side to move's clock running out (a flag ends the game). */
	const armFlag = (game: Game) => {
		clearTimeout(game.timer);
		if (!game.clock || over(game) || game.moves.length < 2) return;
		const side = turn(game);
		const left = side === "white" ? game.wtime : game.btime;
		game.timer = setTimeout(() => finish(game, "outoftime", other(side)), left);
	};

	const changed = (game: Game) => {
		broadcast(game, stateOf(game));
		armFlag(game);
		scheduleAi(game);
	};

	const endsOnBoard = (game: Game) => {
		if (game.chess.isCheckmate()) finish(game, "mate", other(turn(game)));
		else if (game.chess.isStalemate()) finish(game, "stalemate", null);
		else if (game.chess.isInsufficientMaterial()) finish(game, "draw", null);
	};

	/** Plays a move for the side to move; false when it isn't legal. */
	const playMove = (game: Game, uci: string, offeringDraw = false): boolean => {
		const mover = turn(game);
		try {
			game.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });
		} catch {
			return false;
		}
		const now = Date.now();
		if (game.clock && game.moves.length >= 2) {
			const key = mover === "white" ? "wtime" : "btime";
			game[key] = Math.max(0, game[key] - (now - game.lastMoveAt)) + game.clock.increment;
		}
		game.moves.push(uci);
		game.lastMoveAt = now;
		game.offers = {
			wdraw: mover === "white" && offeringDraw,
			bdraw: mover === "black" && offeringDraw,
			wtakeback: false,
			btakeback: false,
		};
		endsOnBoard(game);
		if (!over(game)) changed(game);
		return true;
	};

	const scheduleAi = (game: Game) => {
		const side = turn(game);
		const mover = side === "white" ? game.white : game.black;
		if (over(game) || !("ai" in mover)) return;
		setTimeout(() => {
			if (over(game) || turn(game) !== side) return;
			const index = Math.floor(game.moves.length / 2);
			const scripted = AI_SCRIPT[side][index];
			const legal = game.chess.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ""}`);
			const uci = scripted && legal.includes(scripted) ? scripted : [...legal].sort()[0];
			if (uci) playMove(game, uci);
		}, 250);
	};

	const startGame = (
		white: Side,
		black: Side,
		from: {
			clock: Clock | null;
			days: number | null;
			rated: boolean;
			source: "ai" | "friend" | "lobby";
			id?: string;
			tournamentId?: string;
		},
	) => {
		const day = 86_400_000;
		const game: Game = {
			id: from.id ?? newId(),
			white,
			black,
			clock: from.clock,
			days: from.days,
			rated: from.rated,
			source: from.source,
			tournamentId: from.tournamentId ?? null,
			chess: new Chess(),
			moves: [],
			wtime: from.clock?.initial ?? (from.days ?? 3) * day,
			btime: from.clock?.initial ?? (from.days ?? 3) * day,
			lastMoveAt: Date.now(),
			status: "started",
			winner: null,
			offers: { wdraw: false, bdraw: false, wtakeback: false, btakeback: false },
			chat: [],
			streams: new Map(),
			createdAt: Date.now(),
		};
		games.set(game.id, game);
		for (const account of players(game)) emit(account, { type: "gameStart", game: eventGame(game, account) });
		scheduleAi(game);
		return game;
	};

	const challengeJson = (challenge: Challenge, base: string) => ({
		id: challenge.id,
		url: `${base}/${challenge.id}`,
		status: challenge.status,
		challenger: challenge.challenger ? { ...ACCOUNTS[challenge.challenger], online: true } : null,
		destUser: challenge.dest ? { ...ACCOUNTS[challenge.dest], online: true } : null,
		variant: { key: "standard", name: "Standard", short: "Std" },
		rated: challenge.rated,
		speed: speedOf(challenge.clock),
		timeControl: challenge.clock
			? { type: "clock", limit: challenge.clock.initial / 1000, increment: challenge.clock.increment / 1000, show: "" }
			: { type: "correspondence", daysPerTurn: challenge.days },
		color: challenge.color,
		finalColor: challenge.color === "random" ? "white" : challenge.color,
		perf: { icon: "", name: speedOf(challenge.clock) },
	});

	const paceOf = (form: URLSearchParams) => {
		const limit = form.get("clock.limit");
		if (limit !== null)
			return {
				clock: { initial: Number(limit) * 1000, increment: Number(form.get("clock.increment") ?? 0) * 1000 },
				days: null,
			};
		return { clock: null, days: Number(form.get("days") ?? 3) };
	};

	/** The challenge's game, once both sides are known. */
	const accept = (challenge: Challenge, by: Account, color?: Color) => {
		if (challenge.open) {
			const side = color ?? (challenge.open.white ? "black" : "white");
			challenge.open[side] = by;
			if (!challenge.open.white || !challenge.open.black) return;
		}
		challenge.status = "accepted";
		const challengerColor: Color = challenge.color === "random" ? "white" : challenge.color;
		const white = challenge.open?.white ?? (challengerColor === "white" ? challenge.challenger : challenge.dest);
		const black = challenge.open?.black ?? (challengerColor === "white" ? challenge.dest : challenge.challenger);
		if (!white || !black) return;
		startGame(
			{ account: white },
			{ account: black },
			{ clock: challenge.clock, days: challenge.days, rated: challenge.rated, source: "friend", id: challenge.id },
		);
		if (challenge.keepAlive) {
			send(challenge.keepAlive, { done: "accepted" });
			challenge.keepAlive.end();
		}
	};

	const close = (challenge: Challenge, status: "declined" | "canceled", reason = "generic") => {
		challenge.status = status;
		const event = { ...challengeJson(challenge, ""), declineReasonKey: reason };
		if (status === "declined" && challenge.challenger)
			emit(challenge.challenger, { type: "challengeDeclined", challenge: event });
		if (status === "canceled" && challenge.dest) emit(challenge.dest, { type: "challengeCanceled", challenge: event });
		if (challenge.keepAlive && !challenge.keepAlive.writableEnded) {
			send(challenge.keepAlive, { done: status });
			challenge.keepAlive.end();
		}
	};

	/** Undoes the proposer's last move (and the reply after it). */
	const takeBack = (game: Game, proposer: Color) => {
		let undone = false;
		while (game.moves.length > 0 && (!undone || turn(game) !== proposer)) {
			game.chess.undo();
			const uci = game.moves.pop();
			if (uci && turn(game) === proposer) undone = true;
		}
		game.offers = { wdraw: false, bdraw: false, wtakeback: false, btakeback: false };
		game.lastMoveAt = Date.now();
		changed(game);
	};

	/** A player's action on a game: the Board API's endpoints and the tests' rival. */
	const act = (
		game: Game,
		account: Account,
		action: string,
		extra: { uci?: string; text?: string; claimWinInSeconds?: number } = {},
	): boolean => {
		const color = colorOf(game, account);
		if (!color || (over(game) && action !== "chat-read")) return false;
		const opponentSide = color === "white" ? game.black : game.white;
		const ai = "ai" in opponentSide;
		const mine = color === "white" ? "w" : "b";
		const theirs = color === "white" ? "b" : "w";
		switch (action) {
			case "move":
				return turn(game) === color && Boolean(extra.uci) && playMove(game, extra.uci ?? "");
			case "draw-yes":
				if (game.offers[`${theirs}draw`]) {
					finish(game, "draw", null);
					return true;
				}
				if (ai) return true;
				game.offers[`${mine}draw`] = true;
				broadcast(game, stateOf(game));
				return true;
			case "draw-no":
				game.offers[`${theirs}draw`] = false;
				broadcast(game, stateOf(game));
				return true;
			case "takeback-yes":
				if (game.offers[`${theirs}takeback`]) {
					takeBack(game, other(color));
					return true;
				}
				if (ai) {
					takeBack(game, color);
					return true;
				}
				game.offers[`${mine}takeback`] = true;
				broadcast(game, stateOf(game));
				return true;
			case "takeback-no":
				game.offers[`${theirs}takeback`] = false;
				broadcast(game, stateOf(game));
				return true;
			case "berserk": {
				// An arena game with a clock, before this side's first move: half the time.
				const moved = game.moves.length > (color === "white" ? 0 : 1);
				if (!game.tournamentId || !game.clock || moved) return false;
				if (color === "white") game.wtime = game.clock.initial / 2;
				else game.btime = game.clock.initial / 2;
				broadcast(game, stateOf(game));
				return true;
			}
			case "resign":
				finish(game, "resign", other(color));
				return true;
			case "abort":
				if (game.moves.length >= 2) return false;
				finish(game, "aborted", null);
				return true;
			case "claim-victory":
				finish(game, "timeout", color);
				return true;
			case "claim-draw":
				finish(game, "draw", null);
				return true;
			case "chat": {
				const line = { user: ACCOUNTS[account].name, text: extra.text ?? "" };
				game.chat.push(line);
				broadcast(game, { type: "chatLine", room: "player", username: line.user, text: line.text });
				return true;
			}
			case "gone": {
				// Tells the other player this one left.
				const them = accountOf(opponentSide);
				for (const response of (them && game.streams.get(them)) || [])
					send(response, { type: "opponentGone", gone: true, claimWinInSeconds: extra.claimWinInSeconds ?? 0 });
				return true;
			}
			default:
				return false;
		}
	};

	const BOARD =
		/^\/api\/board\/game\/([A-Za-z0-9]{8})\/(move\/[a-h1-8qrbn]+|draw\/(yes|no|true|false)|takeback\/(yes|no|true|false)|resign|abort|claim-victory|claim-draw|chat|berserk)$/;

	return {
		/** What the event stream restates when it opens: the account's challenges, then its games. */
		restate(account: Account, base: string): unknown[] {
			const events: unknown[] = [];
			for (const challenge of challenges.values()) {
				if (challenge.status === "created" && (challenge.challenger === account || challenge.dest === account))
					events.push({ type: "challenge", challenge: challengeJson(challenge, base) });
			}
			for (const game of games.values()) {
				if (!over(game) && colorOf(game, account)) events.push({ type: "gameStart", game: eventGame(game, account) });
			}
			return events;
		},

		reset() {
			for (const game of games.values()) {
				clearTimeout(game.timer);
				for (const set of game.streams.values()) for (const response of set) response.end();
			}
			for (const challenge of challenges.values()) challenge.keepAlive?.end();
			for (const seek of seeks.values()) seek.response?.end();
			games.clear();
			challenges.clear();
			seeks.clear();
		},

		/** Ends every game stream of an account: a dropped connection, or Lichess restarting. */
		drop(account: Account) {
			for (const game of games.values()) {
				for (const response of game.streams.get(account) ?? []) response.destroy();
				game.streams.delete(account);
			}
		},

		gameStreams(account: Account) {
			let count = 0;
			for (const game of games.values()) count += game.streams.get(account)?.size ?? 0;
			return count;
		},

		/** The Board API and the challenges, for a token's account; false when the path isn't one of them. */
		async serve(
			pathname: string,
			request: IncomingMessage,
			response: ServerResponse,
			account: Account,
			base: string,
		): Promise<boolean> {
			const method = request.method ?? "GET";
			const stream = /^\/api\/board\/game\/stream\/([A-Za-z0-9]{8})$/.exec(pathname);
			if (stream && method === "GET") {
				const game = games.get(stream[1] ?? "");
				if (!game || !colorOf(game, account)) {
					json(response, 404, { error: "No such game" });
					return true;
				}
				response.writeHead(200, { "content-type": "application/x-ndjson", "access-control-allow-origin": "*" });
				send(response, fullOf(game));
				if (over(game)) {
					response.end();
					return true;
				}
				const set = game.streams.get(account) ?? new Set();
				set.add(response);
				game.streams.set(account, set);
				const keepalive = setInterval(() => !response.writableEnded && response.write("\n"), 2_000);
				response.on("close", () => {
					clearInterval(keepalive);
					game.streams.get(account)?.delete(response);
				});
				return true;
			}
			const board = BOARD.exec(pathname);
			if (board && method === "POST") {
				const game = games.get(board[1] ?? "");
				if (!game || !colorOf(game, account)) {
					json(response, 404, { error: "No such game" });
					return true;
				}
				const what = board[2] ?? "";
				const url = new URL(request.url ?? "/", "http://fake");
				const form = await readForm(request);
				const yes = (value: string) => value === "yes" || value === "true";
				const action = what.startsWith("move/")
					? "move"
					: what.startsWith("draw/")
						? yes(what.slice(5))
							? "draw-yes"
							: "draw-no"
						: what.startsWith("takeback/")
							? yes(what.slice(9))
								? "takeback-yes"
								: "takeback-no"
							: what;
				const ok =
					action === "move"
						? act(game, account, "move", { uci: what.slice(5) }) &&
							(url.searchParams.get("offeringDraw") !== "true" || act(game, account, "draw-yes"))
						: act(game, account, action, { text: form.get("text") ?? "" });
				if (ok) json(response, 200, { ok: true });
				else json(response, 400, { error: "Not your turn, or game already over" });
				return true;
			}
			const chatRead = /^\/api\/board\/game\/([A-Za-z0-9]{8})\/chat$/.exec(pathname);
			if (chatRead && method === "GET") {
				const game = games.get(chatRead[1] ?? "");
				if (!game || !colorOf(game, account)) json(response, 404, { error: "No such game" });
				else json(response, 200, game.chat);
				return true;
			}
			if (pathname === "/api/board/seek" && method === "POST") {
				const form = await readForm(request);
				const days = form.get("days");
				const time = form.get("time");
				const seek: Seek = {
					id: `seek${newId()}`,
					account,
					clock:
						time === null
							? null
							: { initial: Number(time) * 60_000, increment: Number(form.get("increment") ?? 0) * 1000 },
					days: days === null ? null : Number(days),
					rated: form.get("rated") === "true",
					response: null,
				};
				if (!seek.clock && !seek.days) {
					json(response, 400, { error: "time and increment, or days" });
					return true;
				}
				seeks.set(seek.id, seek);
				if (!seek.clock) {
					json(response, 200, { id: seek.id });
					return true;
				}
				seek.response = response;
				response.writeHead(200, { "content-type": "application/x-ndjson" });
				response.write("\n");
				const keepalive = setInterval(() => !response.writableEnded && response.write("\n"), 2_000);
				response.on("close", () => {
					clearInterval(keepalive);
					// Closing the connection cancels the seek, as on Lichess.
					seeks.delete(seek.id);
				});
				return true;
			}
			if (pathname === "/api/account/playing" && method === "GET") {
				const mine = [...games.values()].filter((game) => !over(game) && colorOf(game, account));
				const nowPlaying = mine
					.map((game) => ({ ...eventGame(game, account), rating: ACCOUNTS[account].rating }))
					.sort((a, b) => Number(b.isMyTurn) - Number(a.isMyTurn) || a.secondsLeft - b.secondsLeft);
				json(response, 200, { nowPlaying, nbMyTurn: nowPlaying.filter((game) => game.isMyTurn).length });
				return true;
			}
			if (pathname === "/api/challenge" && method === "GET") {
				const mine = [...challenges.values()].filter((challenge) => challenge.status === "created");
				json(response, 200, {
					in: mine.filter((challenge) => challenge.dest === account).map((challenge) => challengeJson(challenge, base)),
					out: mine
						.filter((challenge) => challenge.challenger === account)
						.map((challenge) => challengeJson(challenge, base)),
				});
				return true;
			}
			if (pathname === "/api/challenge/ai" && method === "POST") {
				const form = await readForm(request);
				const pace = paceOf(form);
				const level = Number(form.get("level") ?? 1);
				const wanted = form.get("color") ?? "random";
				const color: Color = wanted === "black" ? "black" : "white";
				const me: Side = { account };
				const ai: Side = { ai: level };
				const game = startGame(color === "white" ? me : ai, color === "white" ? ai : me, {
					...pace,
					rated: false,
					source: "ai",
				});
				json(response, 201, { id: game.id, rated: false, status: { id: 20, name: "started" }, player: color });
				return true;
			}
			if (pathname === "/api/challenge/open" && method === "POST") {
				const form = await readForm(request);
				const id = newId();
				const challenge: Challenge = {
					id,
					challenger: null,
					dest: null,
					...paceOf(form),
					color: "random",
					rated: form.get("rated") === "true",
					status: "created",
					keepAlive: null,
					open: {},
				};
				challenges.set(id, challenge);
				json(response, 200, {
					...challengeJson(challenge, base),
					urlWhite: `${base}/${id}?color=white`,
					urlBlack: `${base}/${id}?color=black`,
					open: {},
				});
				return true;
			}
			const verb = /^\/api\/challenge\/([A-Za-z0-9]{8})\/(accept|decline|cancel)$/.exec(pathname);
			if (verb && method === "POST") {
				const challenge = challenges.get(verb[1] ?? "");
				const form = await readForm(request);
				if (!challenge || challenge.status !== "created") {
					json(response, 404, { error: "No such challenge" });
					return true;
				}
				if (verb[2] === "accept") {
					const color = new URL(request.url ?? "/", "http://fake").searchParams.get("color");
					if (!challenge.open && challenge.dest !== account) {
						json(response, 404, { error: "No such challenge" });
						return true;
					}
					accept(challenge, account, color === "white" || color === "black" ? color : undefined);
				} else if (verb[2] === "decline") {
					close(challenge, "declined", form.get("reason") ?? "generic");
				} else {
					close(challenge, "canceled");
				}
				json(response, 200, { ok: true });
				return true;
			}
			const create = /^\/api\/challenge\/([A-Za-z0-9_-]{2,30})$/.exec(pathname);
			if (create && method === "POST") {
				const dest = accountByName(create[1] ?? "");
				const form = await readForm(request);
				if (!dest) {
					json(response, 404, { error: "No such user" });
					return true;
				}
				const challenge: Challenge = {
					id: newId(),
					challenger: account,
					dest,
					...paceOf(form),
					color: (form.get("color") as Challenge["color"]) ?? "random",
					rated: form.get("rated") === "true",
					status: "created",
					keepAlive: null,
					open: null,
				};
				challenges.set(challenge.id, challenge);
				for (const who of [account, dest]) emit(who, { type: "challenge", challenge: challengeJson(challenge, base) });
				if (form.get("keepAliveStream") === "true") {
					challenge.keepAlive = response;
					response.writeHead(200, { "content-type": "application/x-ndjson" });
					send(response, { challenge: challengeJson(challenge, base), socketVersion: 0 });
					const keepalive = setInterval(() => !response.writableEnded && response.write("\n"), 2_000);
					response.on("close", () => {
						clearInterval(keepalive);
						// The challenger went away: Lichess drops the challenge.
						if (challenge.status === "created") close(challenge, "canceled");
					});
				} else {
					json(response, 200, challengeJson(challenge, base));
				}
				return true;
			}
			return false;
		},

		/** The tests' controls: a challenge from the rival, an answer to one, and the rival's moves and actions. */
		async control(
			route: string,
			body: Record<string, unknown>,
			response: ServerResponse,
			base: string,
		): Promise<boolean> {
			if (route === "POST /e2e/lichess/challenge") {
				const from = (body.from as Account) ?? "e2e_rival";
				const to = (body.to as Account) ?? "e2e_player";
				const clock = body.clock as { limit: number; increment: number } | undefined;
				const challenge: Challenge = {
					id: newId(),
					challenger: from,
					dest: to,
					clock: clock ? { initial: clock.limit * 1000, increment: clock.increment * 1000 } : null,
					days: clock ? null : Number(body.days ?? 3),
					color: (body.color as Challenge["color"]) ?? "white",
					rated: body.rated === true,
					status: "created",
					keepAlive: null,
					open: null,
				};
				challenges.set(challenge.id, challenge);
				for (const who of [from, to]) emit(who, { type: "challenge", challenge: challengeJson(challenge, base) });
				json(response, 200, { id: challenge.id });
				return true;
			}
			if (route === "POST /e2e/lichess/respond") {
				const challenge = challenges.get(String(body.id ?? ""));
				const account = (body.account as Account) ?? challenge?.dest ?? "e2e_rival";
				if (!challenge || challenge.status !== "created") {
					json(response, 404, { error: "No such challenge" });
					return true;
				}
				if (body.decision === "accept") accept(challenge, account);
				else close(challenge, "declined", String(body.reason ?? "generic"));
				json(response, 200, { ok: true, status: challenge.status });
				return true;
			}
			if (route === "POST /e2e/lichess/act") {
				const game = games.get(String(body.game ?? ""));
				const account = (body.account as Account) ?? "e2e_rival";
				const ok = game
					? act(game, account, String(body.action ?? ""), {
							uci: typeof body.uci === "string" ? body.uci : undefined,
							text: typeof body.text === "string" ? body.text : undefined,
							claimWinInSeconds: typeof body.claimWinInSeconds === "number" ? body.claimWinInSeconds : undefined,
						})
					: false;
				json(response, ok ? 200 : 400, { ok });
				return true;
			}
			if (route === "POST /e2e/lichess/seek-accept") {
				// The rival accepts the account's oldest seek: the game starts, the seek's stream closes.
				const account = (body.account as Account) ?? "e2e_player";
				const seek = [...seeks.values()].find((candidate) => candidate.account === account);
				if (!seek) {
					json(response, 404, { error: "No seek" });
					return true;
				}
				seeks.delete(seek.id);
				const seekerWhite = body.color !== "black";
				const seeker: Side = { account };
				const rival: Side = { account: account === "e2e_player" ? "e2e_rival" : "e2e_player" };
				const game = startGame(seekerWhite ? seeker : rival, seekerWhite ? rival : seeker, {
					clock: seek.clock,
					days: seek.days,
					rated: seek.rated,
					source: "lobby",
				});
				seek.response?.end();
				json(response, 200, { id: game.id });
				return true;
			}
			if (route === "GET /e2e/lichess/seeks") {
				json(
					response,
					200,
					[...seeks.values()].map((seek) => ({
						id: seek.id,
						account: seek.account,
						clock: seek.clock,
						days: seek.days,
						rated: seek.rated,
						open: seek.response !== null,
					})),
				);
				return true;
			}
			if (route === "POST /e2e/lichess/arena") {
				// An arena game between the player (White) and the rival, before either has moved.
				const clock = (body.clock as { limit: number; increment: number } | undefined) ?? { limit: 300, increment: 0 };
				const game = startGame(
					{ account: "e2e_player" },
					{ account: "e2e_rival" },
					{
						clock: { initial: clock.limit * 1000, increment: clock.increment * 1000 },
						days: null,
						rated: true,
						source: "friend",
						tournamentId: "arena123",
					},
				);
				json(response, 200, { id: game.id });
				return true;
			}
			if (route === "GET /e2e/lichess/challenges") {
				json(
					response,
					200,
					[...challenges.values()].map((challenge) => ({
						id: challenge.id,
						challenger: challenge.challenger,
						dest: challenge.dest,
						status: challenge.status,
					})),
				);
				return true;
			}
			if (route === "GET /e2e/lichess/games") {
				json(
					response,
					200,
					[...games.values()].map((game) => ({
						id: game.id,
						status: game.status,
						moves: game.moves,
						winner: game.winner,
					})),
				);
				return true;
			}
			return false;
		},
	};
}
