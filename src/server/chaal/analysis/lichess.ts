import "@tanstack/react-start/server-only";
import type { z } from "zod";
import { checkFen } from "@/features/chaal/chess/rules";
import { ndjsonLines, parseLine } from "@/features/chaal/live/ndjson";
import type {
	ChaalCloudEval,
	ChaalExplorer,
	ChaalExplorerResult,
	ChaalImportedGame,
	ChaalTablebase,
	ExplorerDatabase,
	ExplorerRating,
	ExplorerSpeed,
} from "@/features/chaal/schema";
import { AppError, isAppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import { connectionOf } from "../connect/repository";
import { requireFeature, withToken } from "../connect/service";
import type { ChaalPublic } from "../context";
import { type LaneKey, userLane } from "../lichess/lanes";
import { cloudEvalAnswer, explorerAnswer, gameExportAnswer, tablebaseAnswer } from "../lichess/schemas";

/**
 * Lichess's analysis data for the analysis board (PLAN Task 75, decision 0264): cloud
 * eval, the opening explorer (masters, Lichess, a player), the tablebase and importing a
 * game. Public: every call goes through the client's lanes and the cache, with the TTLs
 * of PLAN 13.5 (masters 7 d, Lichess 1 h, the tablebase 30 d, cloud eval 1 d). The data
 * isn't personal, so the cache is shared even when a user's token made the call.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const TTL = {
	cloudEval: DAY,
	/** A position Lichess hasn't evaluated may be later: asked again after an hour. */
	cloudEvalMissing: HOUR,
	masters: 7 * DAY,
	lichess: HOUR,
	player: HOUR,
	/** A player still being indexed: asked again soon, as the numbers grow. */
	playerIndexing: MINUTE,
	tablebase: 30 * DAY,
	/** A finished game doesn't change. */
	game: DAY,
	/** A game still being played: its export changes as it goes on. */
	ongoingGame: 30_000,
} as const;

/** How long a player's explorer stream is read before answering with what it has (it's still indexing). */
const PLAYER_STREAM_MS = 5_000;

/** The tablebase answers positions of seven pieces or fewer. */
export const TABLEBASE_MAX_PIECES = 7;

const pieceCount = (fen: string) => (fen.split(" ")[0]?.match(/[prnbqk]/gi) ?? []).length;

/** A FEN the board accepted; anything else is refused before Lichess is asked. */
function legalFen(fen: string): string {
	const check = checkFen(fen);
	if (!check.ok) throw new AppError("BAD_REQUEST", `Not a position (${check.reason})`);
	return check.fen;
}

const notFoundIsNull = <T>(call: Promise<T>): Promise<T | null> =>
	call.catch((error: unknown) => {
		if (isAppError(error) && error.code === "NOT_FOUND") return null;
		throw error;
	});

/** Lichess's cached evaluation of a position, or null when it has none (it evaluates a few positions only). */
export async function cloudEval(chaal: ChaalPublic, fen: string, multiPv: number): Promise<ChaalCloudEval | null> {
	requireFeature(chaal.settings, "engine");
	const position = legalFen(fen);
	const params = { fen: position, multiPv: Math.min(5, Math.max(1, Math.round(multiPv))) };
	return chaal.cache.read(
		{ endpoint: "cloud-eval", path: "/api/cloud-eval", params, epoch: chaal.settings.cacheEpoch },
		// "Not found" is kept an hour only: Lichess may evaluate the position later.
		(found) => (found ? TTL.cloudEval : TTL.cloudEvalMissing),
		() =>
			notFoundIsNull(
				chaal.lichess.json(
					{ endpoint: "cloud-eval", path: "/api/cloud-eval", params, lane: "public" },
					cloudEvalAnswer,
				),
			),
	);
}

export type ExplorerQuery = {
	database: ExplorerDatabase;
	fen: string;
	speeds?: ReadonlyArray<ExplorerSpeed>;
	ratings?: ReadonlyArray<ExplorerRating>;
	/** For a player's games: their username and the side they played. */
	player?: string;
	color?: "white" | "black";
};

/** Neither the visitor nor the app has a token: thrown inside the cache's read, so it's never kept. */
class NoExplorerToken extends Error {}

/**
 * The explorer needs a token (any, no scope; decision 0257): a connected user's own, on
 * their lane, else LICHESS_APP_TOKEN on the public lane. A visitor without either gets
 * `{ ok: false, reason: "token" }`: "Connect Lichess to see the explorer".
 */
async function withExplorerToken<T>(
	chaal: ChaalPublic,
	session: Session | null,
	use: (token: string, lane: LaneKey) => Promise<T>,
): Promise<T> {
	if (session && chaal.connectConfigured) {
		const deps = await chaal.connectDeps();
		const row = await connectionOf(deps.db, session.user.id);
		if (row && !row.revokedAt) {
			try {
				return await withToken(deps, session.user.id, "explorer", (token) => use(token, userLane(session.user.id)));
			} catch (error) {
				// A token Lichess refused (now marked revoked) falls back to the app's, when there is one.
				if (!(isAppError(error) && error.reason === "lichess-reconnect" && chaal.appToken)) throw error;
			}
		}
	}
	if (!chaal.appToken) throw new NoExplorerToken();
	return use(chaal.appToken, "public");
}

const speedsParam = (speeds: ReadonlyArray<string> | undefined) =>
	speeds && speeds.length > 0 ? [...speeds].sort().join(",") : undefined;

export async function explorer(
	chaal: ChaalPublic,
	session: Session | null,
	query: ExplorerQuery,
): Promise<ChaalExplorerResult> {
	requireFeature(chaal.settings, "explorer");
	const fen = legalFen(query.fen);
	const { database } = query;
	const path = `/${database}`;
	const params =
		database === "masters"
			? { fen, topGames: 4, moves: 12 }
			: database === "lichess"
				? {
						variant: "standard",
						fen,
						speeds: speedsParam(query.speeds),
						ratings: speedsParam(query.ratings?.map(String)),
						topGames: 4,
						recentGames: 0,
						moves: 12,
					}
				: {
						variant: "standard",
						fen,
						player: query.player?.trim().toLowerCase(),
						color: query.color ?? "white",
						speeds: speedsParam(query.speeds),
						recentGames: 4,
						moves: 12,
					};
	if (database === "player" && !params.player) throw new AppError("BAD_REQUEST", "Which player?");
	const key = { endpoint: `explorer:${database}`, path, params, epoch: chaal.settings.cacheEpoch };
	const ttl = database === "masters" ? TTL.masters : database === "lichess" ? TTL.lichess : TTL.player;

	const read = async (): Promise<ChaalExplorer> =>
		withExplorerToken(chaal, session, async (token, lane) => {
			const request = { endpoint: `explorer:${database}`, host: "explorer" as const, path, params, token, lane };
			if (database !== "player") return chaal.lichess.json(request, explorerAnswer(database));
			// A stream takes no lane of its own: this one waits its turn, as one request at a time asks.
			return chaal.lichess.lanes.run(lane, () => readPlayerStream(chaal, request));
		});
	try {
		// A player still being indexed is asked again in a minute.
		const data = await chaal.cache.read(key, (answer) => (answer.indexing ? TTL.playerIndexing : ttl), read);
		return { ok: true, data };
	} catch (error) {
		if (error instanceof NoExplorerToken) return { ok: false, reason: "token" };
		throw error;
	}
}

/**
 * A player's explorer is an ndjson stream that sends the numbers again as more of their
 * games are indexed, and ends when they all are. Read it for a few seconds at most: the
 * last line is the answer, marked `indexing` when the stream hadn't ended.
 */
async function readPlayerStream(
	chaal: ChaalPublic,
	request: Parameters<ChaalPublic["lichess"]["stream"]>[0],
): Promise<ChaalExplorer> {
	const deadline = AbortSignal.timeout(PLAYER_STREAM_MS);
	const schema = explorerAnswer("player");
	let last: ChaalExplorer | null = null;
	let ended = false;
	try {
		const body = await chaal.lichess.stream({ ...request, signal: deadline });
		for await (const line of ndjsonLines(body)) {
			const parsed = schema.safeParse(parseLine(line));
			if (parsed.success) last = parsed.data;
		}
		ended = true;
	} catch (error) {
		if (!deadline.aborted) throw error;
	}
	if (!last) throw new AppError("UPSTREAM_UNAVAILABLE", "Lichess explorer:player: no answer in time");
	return { ...last, indexing: !ended };
}

/** The tablebase's answer for a position of seven pieces or fewer; null for more. */
export async function tablebase(chaal: ChaalPublic, fen: string): Promise<ChaalTablebase | null> {
	requireFeature(chaal.settings, "explorer");
	const position = legalFen(fen);
	if (pieceCount(position) > TABLEBASE_MAX_PIECES) return null;
	const params = { fen: position };
	return chaal.cache.read(
		{ endpoint: "tablebase", path: "/standard", params, epoch: chaal.settings.cacheEpoch },
		TTL.tablebase,
		() =>
			notFoundIsNull(
				chaal.lichess.json(
					{ endpoint: "tablebase", host: "tablebase", path: "/standard", params, lane: "public" },
					tablebaseAnswer,
				),
			),
	);
}

/**
 * A game as Lichess exports it, with its clocks, evals and opening, or null when Lichess
 * has no such game: importing it into analysis (Task 75) and its replay (Task 81) share
 * this read and its cache key. The caller checks its own feature's switch. A finished game
 * is kept a day; one still being played half a minute (Lichess delays its moves anyway).
 */
export function exportedGame(
	chaal: Pick<ChaalPublic, "cache" | "lichess" | "settings">,
	id: string,
): Promise<z.output<typeof gameExportAnswer> | null> {
	const params = { pgnInJson: true, clocks: true, evals: true, opening: true, literate: false };
	const path = `/game/export/${id}`;
	return chaal.cache.read(
		{ endpoint: "game-export", path, params, epoch: chaal.settings.cacheEpoch },
		(game) => (game && !game.ongoing ? TTL.game : TTL.ongoingGame),
		() =>
			notFoundIsNull(chaal.lichess.json({ endpoint: "game-export", path, params, lane: "public" }, gameExportAnswer)),
	);
}

/**
 * A finished standard game from Lichess as PGN, for analysis. A game still being played
 * isn't opened (fair play: PLAN 13.5; Lichess delays an ongoing game's moves anyway), and
 * a variant isn't standard chess.
 */
export async function importGame(chaal: ChaalPublic, id: string): Promise<ChaalImportedGame> {
	requireFeature(chaal.settings, "analysis");
	const game = await exportedGame(chaal, id);
	if (!game) return { ok: false, reason: "not-found" };
	if (game.ongoing) return { ok: false, reason: "in-progress" };
	if (!game.standard) return { ok: false, reason: "variant" };
	return { ok: true, id: game.id, pgn: game.pgn };
}
