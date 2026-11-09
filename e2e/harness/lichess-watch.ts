/**
 * The fake Lichess's watch (Task 82, decision 0272), for e2e. The TV's channels, their games'
 * export, the streamers and the broadcasts are recordings (`pnpm lichess:record watch`); this
 * adds what's live, and one game it plays itself:
 *
 * - **A game being played, `e2eWatch`** (a rapid game, four moves in): it's the TV's rapid
 *   channel (the recorded channels answer, with this game in its place), its export
 *   (`/game/export/e2eWatch`, and in `/api/games/export/_ids`) and its spectators' stream
 *   (`/api/stream/game/e2eWatch`: the description, every position so far, then each new one).
 * - **The TV's feeds** (`/api/tv/{channel}/feed`): a `featured` line for the channel's game
 *   (from the recordings, or `e2eWatch`), then the feed stays open.
 * - **A live round:** the recorded tournament's first round is played now (its tour and round
 *   answers say so, and its first board's result is `*`), and its PGN stream
 *   (`/api/stream/broadcast/round/{id}.pgn`) sends the recorded board, then what a test pushes.
 *
 * Test controls: `POST /e2e/lichess/watch-reset` (the game back to its fourth move, the streams closed),
 * `POST /e2e/lichess/watch-move` (`{ uci, wc?, bc? }`: the game plays a move,
 * its feed and streams say so), `POST /e2e/lichess/watch-end` (`{ status, winner }`: the
 * description again, and its streams close), `POST /e2e/lichess/round-push` (`{ round, pgn }`
 * to the round's open streams), `GET /e2e/lichess/watch-streams` (how many the browser holds).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { Chess } from "chess.js";

type Json = (response: ServerResponse, status: number, body: unknown) => void;

export const WATCH_GAME = "e2eWatch";
const WATCH_CHANNEL = "rapid";
/** The recorded tournament (scripts/record-lichess-fixtures.ts, BROADCAST_TOUR). */
const BROADCAST_TOUR = "9NE16qcS";
const OPENING = ["e2e4", "e7e5", "g1f3", "b8c6"];
const CLOCK = { initial: 600, increment: 5 };
const PLAYERS = {
	white: { user: { name: "Watch_White", id: "watch_white" }, rating: 2010 },
	black: { user: { name: "Watch_Black", id: "watch_black" }, rating: 1995 },
} as const;
const CREATED_AT = 1_794_000_000_000;

type Position = { fen: string; lm?: string; wc: number; bc: number };

const NDJSON = { "content-type": "application/x-ndjson", "access-control-allow-origin": "*" };

export function createWatch({ read, json }: { read: (name: string) => string | undefined; json: Json }) {
	let positions: Position[] = [];
	let sans: string[] = [];
	let ending: { status: string; winner: "white" | "black" | null } | null = null;
	const feeds = new Map<string, Set<ServerResponse>>();
	const gameStreams = new Set<ServerResponse>();
	const roundStreams = new Map<string, Set<ServerResponse>>();

	const reset = () => {
		const chess = new Chess();
		positions = [{ fen: chess.fen(), wc: CLOCK.initial, bc: CLOCK.initial }];
		sans = [];
		ending = null;
		for (const uci of OPENING) playMove(chess, uci, CLOCK.initial, CLOCK.initial);
		for (const set of [...feeds.values(), gameStreams, ...roundStreams.values()]) {
			for (const stream of set) stream.end();
			set.clear();
		}
	};

	function playMove(chess: Chess, uci: string, wc: number, bc: number): boolean {
		try {
			const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
			sans.push(move.san);
			positions.push({ fen: chess.fen(), lm: uci, wc, bc });
			return true;
		} catch {
			return false;
		}
	}

	const now = () => positions.at(-1) as Position;

	const open = (response: ServerResponse, set: Set<ServerResponse>, headers: Record<string, string> = NDJSON) => {
		response.writeHead(200, headers);
		set.add(response);
		response.on("close", () => set.delete(response));
	};
	const setOf = <K>(map: Map<K, Set<ServerResponse>>, key: K) => {
		let set = map.get(key);
		if (!set) {
			set = new Set();
			map.set(key, set);
		}
		return set;
	};
	const line = (value: unknown) => `${JSON.stringify(value)}\n`;

	/** The game as the export says it (one ndjson line of `_ids`, or GET /game/export/{id}). */
	const exported = (withPgn: boolean) => {
		const status = ending?.status ?? "started";
		const moves = sans.join(" ");
		return {
			id: WATCH_GAME,
			rated: true,
			variant: "standard",
			speed: "rapid",
			perf: "rapid",
			createdAt: CREATED_AT,
			lastMoveAt: CREATED_AT + positions.length * 10_000,
			status,
			...(ending?.winner ? { winner: ending.winner } : {}),
			players: PLAYERS,
			clock: { ...CLOCK, totalTime: CLOCK.initial + 40 * CLOCK.increment },
			lastFen: now().fen,
			...(now().lm ? { lastMove: now().lm } : {}),
			...(withPgn
				? {
						moves,
						pgn: `[Event "Rated rapid game"]\n[White "Watch_White"]\n[Black "Watch_Black"]\n[Result "*"]\n\n${moves} *\n`,
					}
				: {}),
		};
	};

	const featured = (channel: string) => {
		if (channel === WATCH_CHANNEL)
			return {
				t: "featured",
				d: {
					id: WATCH_GAME,
					orientation: "white",
					players: [
						{ color: "white", ...PLAYERS.white, seconds: now().wc },
						{ color: "black", ...PLAYERS.black, seconds: now().bc },
					],
					fen: now().fen,
				},
			};
		const channels = JSON.parse(read("api_tv_channels.json") ?? "{}") as Record<
			string,
			{ gameId: string; color: string } | undefined
		>;
		const entry = channels[channel];
		const game = recordedGames().find((each) => each.id === entry?.gameId);
		if (!entry || !game) return null;
		const side = (color: "white" | "black") => {
			const player = game.players?.[color] ?? {};
			return {
				color,
				user: player.user ?? { name: "?", id: "?" },
				...(player.aiLevel ? { ai: player.aiLevel } : {}),
				rating: player.rating ?? 1500,
				seconds: game.clock?.initial ?? 180,
			};
		};
		return {
			t: "featured",
			d: { id: game.id, orientation: entry.color, players: [side("white"), side("black")], fen: game.lastFen },
		};
	};

	type Recorded = {
		id: string;
		players?: Record<"white" | "black", { user?: { name: string; id: string }; rating?: number; aiLevel?: number }>;
		clock?: { initial: number };
		lastFen?: string;
	};
	const recordedGames = (): Recorded[] =>
		(read("api_games_export__ids.1d7e91bc.ndjson") ?? "")
			.split("\n")
			.filter((each) => each.trim())
			.map((each) => JSON.parse(each) as Recorded);

	const firstRound = () =>
		(JSON.parse(read(`api_broadcast_${BROADCAST_TOUR}.json`) ?? "{}") as { rounds?: Array<{ id: string }> }).rounds?.[0]
			?.id;

	/** A round as played now: not finished, its first board's game still going on. */
	const liveRound = (round: Record<string, unknown>) => {
		const { finished: _finished, finishedAt: _at, ...rest } = round;
		return { ...rest, ongoing: true };
	};

	reset();

	return {
		reset,
		async control(route: string, body: Record<string, unknown>, response: ServerResponse): Promise<boolean> {
			if (route === "POST /e2e/lichess/watch-reset") {
				reset();
				json(response, 200, { ok: true });
				return true;
			}
			if (route === "POST /e2e/lichess/watch-move") {
				const chess = new Chess(now().fen);
				const uci = String(body.uci ?? "");
				const wc = typeof body.wc === "number" ? body.wc : now().wc;
				const bc = typeof body.bc === "number" ? body.bc : now().bc;
				if (ending || !playMove(chess, uci, wc, bc)) {
					json(response, 400, { error: "illegal" });
					return true;
				}
				const position = now();
				for (const stream of setOf(feeds, WATCH_CHANNEL))
					stream.write(line({ t: "fen", d: { fen: position.fen, lm: position.lm, wc: position.wc, bc: position.bc } }));
				for (const stream of gameStreams) stream.write(line(position));
				json(response, 200, { fen: position.fen, plies: positions.length - 1 });
				return true;
			}
			if (route === "POST /e2e/lichess/watch-end") {
				ending = {
					status: String(body.status ?? "resign"),
					winner: body.winner === "white" || body.winner === "black" ? body.winner : null,
				};
				const description = {
					id: WATCH_GAME,
					variant: { key: "standard" },
					status: ending.status,
					...(ending.winner ? { winner: ending.winner } : {}),
					players: PLAYERS,
				};
				for (const stream of gameStreams) stream.end(line(description));
				gameStreams.clear();
				json(response, 200, { ok: true });
				return true;
			}
			if (route === "POST /e2e/lichess/round-push") {
				const round = String(body.round ?? "");
				let sent = 0;
				for (const stream of setOf(roundStreams, round)) {
					stream.write(`${String(body.pgn ?? "").trim()}\n\n\n`);
					sent += 1;
				}
				json(response, 200, { sent });
				return true;
			}
			if (route === "GET /e2e/lichess/watch-streams") {
				json(response, 200, {
					feeds: Object.fromEntries([...feeds].map(([channel, set]) => [channel, set.size])),
					game: gameStreams.size,
					rounds: Object.fromEntries([...roundStreams].map(([round, set]) => [round, set.size])),
				});
				return true;
			}
			return false;
		},
		/** Answers a watch path, or returns false for the recordings to answer. */
		async serve(pathname: string, request: IncomingMessage, response: ServerResponse): Promise<boolean> {
			if (request.method === "GET" && pathname === "/api/tv/channels") {
				const channels = JSON.parse(read("api_tv_channels.json") ?? "{}") as Record<string, unknown>;
				json(response, 200, {
					...channels,
					[WATCH_CHANNEL]: {
						user: PLAYERS.white.user,
						rating: PLAYERS.white.rating,
						gameId: WATCH_GAME,
						color: "white",
					},
				});
				return true;
			}
			if (request.method === "POST" && pathname === "/api/games/export/_ids") {
				const chunks: Buffer[] = [];
				for await (const chunk of request) chunks.push(chunk as Buffer);
				const ids = new Set(Buffer.concat(chunks).toString("utf8").split(","));
				const games = [
					...recordedGames().filter((game) => ids.has(game.id)),
					...(ids.has(WATCH_GAME) ? [exported(false)] : []),
				];
				response.writeHead(200, NDJSON);
				response.end(games.map(line).join(""));
				return true;
			}
			const feed = pathname.match(/^\/api\/tv\/(\w+)\/feed$/);
			if (request.method === "GET" && feed) {
				const channel = feed[1] as string;
				const first = featured(channel);
				if (!first) {
					json(response, 404, { error: "Not found" });
					return true;
				}
				open(response, setOf(feeds, channel));
				response.write(line(first));
				return true;
			}
			if (request.method === "GET" && pathname === `/game/export/${WATCH_GAME}`) {
				json(response, 200, exported(true));
				return true;
			}
			if (request.method === "GET" && pathname === `/api/stream/game/${WATCH_GAME}`) {
				open(response, gameStreams);
				response.write(
					line({
						id: WATCH_GAME,
						variant: { key: "standard" },
						speed: "rapid",
						perf: "rapid",
						rated: true,
						createdAt: CREATED_AT,
						players: PLAYERS,
					}),
				);
				for (const position of positions) response.write(line(position));
				if (ending) {
					response.end(line({ id: WATCH_GAME, status: ending.status, winner: ending.winner }));
					gameStreams.delete(response);
				}
				return true;
			}
			const live = firstRound();
			if (request.method === "GET" && pathname === `/api/broadcast/${BROADCAST_TOUR}` && live) {
				const tour = JSON.parse(read(`api_broadcast_${BROADCAST_TOUR}.json`) ?? "{}") as {
					rounds: Array<Record<string, unknown>>;
				};
				json(response, 200, {
					...tour,
					rounds: tour.rounds.map((round) => (round.id === live ? liveRound(round) : round)),
				});
				return true;
			}
			if (request.method === "GET" && live && pathname === `/api/broadcast/-/-/${live}`) {
				const answer = JSON.parse(read(`api_broadcast_-_-_${live}.json`) ?? "{}") as {
					round: Record<string, unknown>;
					games: Array<{ status?: string }>;
				};
				json(response, 200, {
					...answer,
					round: liveRound(answer.round),
					games: answer.games.map((game, index) => (index === 0 ? { ...game, status: "*" } : game)),
				});
				return true;
			}
			const stream = pathname.match(/^\/api\/stream\/broadcast\/round\/(\w{8})\.pgn$/);
			if (request.method === "GET" && stream) {
				const round = stream[1] as string;
				const answer = JSON.parse(read(`api_broadcast_-_-_${round}.json`) ?? "null") as {
					games: Array<{ id: string }>;
				} | null;
				if (!answer) {
					json(response, 404, { error: "Not found" });
					return true;
				}
				open(response, setOf(roundStreams, round), {
					"content-type": "application/x-chess-pgn",
					"access-control-allow-origin": "*",
				});
				for (const game of answer.games) {
					const pgn = read(`api_study_${round}_${game.id}.pgn`);
					if (pgn) response.write(`${pgn.trim()}\n\n\n`);
				}
				return true;
			}
			return false;
		},
	};
}
