import "@tanstack/react-start/server-only";
import { z } from "zod";
import type { ChaalEvent, ChaalEventChallenge, ChaalEventGame, ChaalEventPlayer } from "@/features/chaal/live/events";
import type {
	ChaalCloudEval,
	ChaalExplorer,
	ChaalExplorerGame,
	ChaalExplorerMove,
	ChaalTablebase,
	ExplorerDatabase,
	TablebaseResult,
} from "@/features/chaal/schema";

/**
 * Lichess's answers, kept lean (PLAN 13.5): each schema reads only the fields Chaal uses
 * and maps them to its own shape, because the dehydrated state is in the page's HTML.
 * Unknown fields are dropped; a missing optional field becomes null.
 */

// --- OAuth and the account -------------------------------------------------------------

/** POST /api/token. */
export const tokenAnswer = z
	.object({ token_type: z.string(), access_token: z.string().regex(/^[A-Za-z0-9_]{1,512}$/), expires_in: z.number() })
	.transform((answer) => ({ token: answer.access_token, expiresInSeconds: answer.expires_in }));

/** GET /api/account. */
export const accountAnswer = z
	.object({
		id: z.string(),
		username: z.string(),
		title: z.string().nullish(),
		disabled: z.boolean().nullish(),
		tosViolation: z.boolean().nullish(),
	})
	.transform((account) => ({
		id: account.id.toLowerCase(),
		username: account.username,
		title: account.title ?? null,
		closed: account.disabled === true,
	}));
// --- The event stream (GET /api/stream/event) --------------------------------------------

const color = z.enum(["white", "black"]);

const gamePlayer = z
	.object({
		id: z.string().nullish(),
		username: z.string().nullish(),
		name: z.string().nullish(),
		title: z.string().nullish(),
		rating: z.number().nullish(),
		ai: z.number().nullish(),
	})
	.transform(
		(player): ChaalEventPlayer => ({
			id: player.id ?? null,
			name: player.username ?? player.name ?? (player.ai ? `Stockfish level ${player.ai}` : "?"),
			title: player.title ?? null,
			rating: player.rating ?? null,
			aiLevel: player.ai ?? null,
		}),
	);

const named = z.union([z.string(), z.object({ name: z.string().optional(), key: z.string().optional() })]);
const nameOf = (value: z.output<typeof named> | null | undefined, field: "name" | "key") =>
	typeof value === "string" ? value : (value?.[field] ?? value?.name ?? "");

const eventGame = z
	.object({
		gameId: z.string(),
		color,
		fen: z.string(),
		lastMove: z.string().nullish(),
		source: z.string().nullish(),
		status: named.nullish(),
		variant: named.nullish(),
		speed: z.string().nullish(),
		rated: z.boolean().nullish(),
		hasMoved: z.boolean().nullish(),
		isMyTurn: z.boolean().nullish(),
		secondsLeft: z.number().nullish(),
		opponent: gamePlayer,
		winner: color.nullish(),
		ratingDiff: z.number().nullish(),
		compat: z.object({ board: z.boolean().nullish() }).nullish(),
		tournamentId: z.string().nullish(),
	})
	.transform(
		(game): ChaalEventGame => ({
			id: game.gameId,
			color: game.color,
			fen: game.fen,
			lastMove: game.lastMove ?? "",
			source: game.source ?? "",
			status: nameOf(game.status, "name"),
			variant: nameOf(game.variant, "key"),
			speed: game.speed ?? "",
			rated: game.rated === true,
			hasMoved: game.hasMoved === true,
			isMyTurn: game.isMyTurn === true,
			secondsLeft: game.secondsLeft ?? null,
			opponent: game.opponent,
			winner: game.winner ?? null,
			ratingDiff: game.ratingDiff ?? null,
			boardCompatible: game.compat?.board !== false,
			tournamentId: game.tournamentId ?? null,
		}),
	);

const eventChallenge = z
	.object({
		id: z.string(),
		status: z.string().nullish(),
		challenger: gamePlayer.nullish(),
		destUser: gamePlayer.nullish(),
		variant: named.nullish(),
		rated: z.boolean().nullish(),
		speed: z.string().nullish(),
		timeControl: z
			.object({
				type: z.string(),
				limit: z.number().nullish(),
				increment: z.number().nullish(),
				daysPerTurn: z.number().nullish(),
			})
			.nullish(),
		color: z.string().nullish(),
		finalColor: color.nullish(),
		declineReasonKey: z.string().nullish(),
	})
	.transform(
		(challenge): ChaalEventChallenge => ({
			id: challenge.id,
			status: challenge.status ?? "",
			challenger: challenge.challenger ?? null,
			destUser: challenge.destUser ?? null,
			variant: nameOf(challenge.variant, "key"),
			rated: challenge.rated === true,
			speed: challenge.speed ?? "",
			timeControl: {
				type: challenge.timeControl?.type ?? "unlimited",
				limit: challenge.timeControl?.limit ?? null,
				increment: challenge.timeControl?.increment ?? null,
				daysPerTurn: challenge.timeControl?.daysPerTurn ?? null,
			},
			color: challenge.color ?? "random",
			finalColor: challenge.finalColor ?? null,
			declineReasonKey: challenge.declineReasonKey ?? null,
		}),
	);

const streamEvent = z.discriminatedUnion("type", [
	z.object({ type: z.enum(["gameStart", "gameFinish"]), game: eventGame }),
	z.object({ type: z.enum(["challenge", "challengeCanceled", "challengeDeclined"]), challenge: eventChallenge }),
]);

/**
 * One line of Lichess's event stream as Chaal's event, or null when it isn't one Chaal
 * knows (a new event type, or a shape that changed): those are dropped, never passed on.
 */
export function mapStreamEvent(value: unknown): ChaalEvent | null {
	const parsed = streamEvent.safeParse(value);
	return parsed.success ? parsed.data : null;
}

// --- Small public answers the lab reads ----------------------------------------------------

/** GET /api/puzzle/daily: the lab's public-lane check reads only the puzzle's id and rating. */
export const dailyPuzzleAnswer = z
	.object({ puzzle: z.object({ id: z.string(), rating: z.number().nullish() }) })
	.transform((answer) => ({ id: answer.puzzle.id, rating: answer.puzzle.rating ?? null }));

// --- Analysis (Task 75, decision 0264) -------------------------------------------------------

/** GET /api/cloud-eval: Lichess's cached evaluation, scores from White's side. */
export const cloudEvalAnswer = z
	.object({
		depth: z.number(),
		knodes: z.number(),
		pvs: z.array(z.object({ moves: z.string(), cp: z.number().nullish(), mate: z.number().nullish() })),
	})
	.transform(
		(answer): ChaalCloudEval => ({
			depth: answer.depth,
			knodes: answer.knodes,
			lines: answer.pvs.flatMap((pv) => {
				const score =
					typeof pv.mate === "number" ? { mate: pv.mate } : typeof pv.cp === "number" ? { cp: pv.cp } : null;
				return score ? [{ score, moves: pv.moves.split(" ").filter(Boolean) }] : [];
			}),
		}),
	);

/** The explorer's games keep only what a row shows; at most this many. */
const EXPLORER_GAMES = 4;

const explorerPlayer = z.object({ name: z.string(), rating: z.number().nullish() });
const explorerGame = z
	.object({
		uci: z.string().nullish(),
		// It becomes a lichess.org link: a game's id, nothing else.
		id: z.string().regex(/^[A-Za-z0-9]{8}$/),
		winner: z.enum(["white", "black"]).nullish(),
		white: explorerPlayer,
		black: explorerPlayer,
		year: z.number().nullish(),
	})
	.transform(
		(game): ChaalExplorerGame => ({
			id: game.id,
			white: { name: game.white.name, rating: game.white.rating ?? null },
			black: { name: game.black.name, rating: game.black.rating ?? null },
			winner: game.winner ?? null,
			year: game.year ?? null,
			uci: game.uci ?? null,
		}),
	);

const explorerMove = z
	.object({
		uci: z.string(),
		san: z.string(),
		white: z.number(),
		draws: z.number(),
		black: z.number(),
		averageRating: z.number().nullish(),
		averageOpponentRating: z.number().nullish(),
	})
	.transform(
		(move): ChaalExplorerMove => ({
			uci: move.uci,
			san: move.san,
			white: move.white,
			draws: move.draws,
			black: move.black,
			rating: move.averageRating ?? move.averageOpponentRating ?? null,
		}),
	);

/** explorer.lichess.org/masters, /lichess and each line of /player (ndjson). */
export const explorerAnswer = (database: ExplorerDatabase) =>
	z
		.object({
			opening: z.object({ eco: z.string(), name: z.string() }).nullish(),
			white: z.number(),
			draws: z.number(),
			black: z.number(),
			moves: z.array(explorerMove),
			// A game that doesn't read is dropped, not the whole answer.
			topGames: z.array(explorerGame.nullable().catch(null)).nullish(),
			recentGames: z.array(explorerGame.nullable().catch(null)).nullish(),
			queuePosition: z.number().nullish(),
		})
		.transform(
			(answer): ChaalExplorer => ({
				database,
				opening: answer.opening ?? null,
				white: answer.white,
				draws: answer.draws,
				black: answer.black,
				moves: answer.moves,
				games: ((database === "player" ? answer.recentGames : answer.topGames) ?? [])
					.filter((game): game is ChaalExplorerGame => game !== null)
					.slice(0, EXPLORER_GAMES),
				indexing: false,
			}),
		);

/**
 * The tablebase's categories are from the side to move's view; a move's is from the
 * side that moves next. Chaal reads them as wins, draws and losses, with Syzygy's own
 * kinds folded in ("syzygy-win" is a win known by DTZ only).
 */
const TABLEBASE_CATEGORY: Readonly<Record<string, TablebaseResult>> = {
	win: "win",
	"syzygy-win": "win",
	"maybe-win": "maybe-win",
	"cursed-win": "cursed-win",
	draw: "draw",
	"blessed-loss": "blessed-loss",
	"maybe-loss": "maybe-loss",
	"syzygy-loss": "loss",
	loss: "loss",
	unknown: "unknown",
};
/** The same result seen by the other side. */
const OTHER_SIDE: Readonly<Record<TablebaseResult, TablebaseResult>> = {
	win: "loss",
	"maybe-win": "maybe-loss",
	"cursed-win": "blessed-loss",
	draw: "draw",
	"blessed-loss": "cursed-win",
	"maybe-loss": "maybe-win",
	loss: "win",
	unknown: "unknown",
};
const categoryOf = (value: string | null | undefined): TablebaseResult =>
	TABLEBASE_CATEGORY[value ?? "unknown"] ?? "unknown";
const distance = z.number().nullish();

/** tablebase.lichess.org/standard: the position's result and each move's, for the side that plays it. */
export const tablebaseAnswer = z
	.object({
		category: z.string().nullish(),
		dtz: distance,
		precise_dtz: distance,
		dtm: distance,
		checkmate: z.boolean().nullish(),
		stalemate: z.boolean().nullish(),
		insufficient_material: z.boolean().nullish(),
		moves: z
			.array(
				z.object({
					uci: z.string(),
					san: z.string(),
					category: z.string().nullish(),
					dtz: distance,
					dtm: distance,
				}),
			)
			.nullish(),
	})
	.transform(
		(answer): ChaalTablebase => ({
			result: categoryOf(answer.category),
			dtz: answer.dtz ?? null,
			dtm: answer.dtm ?? null,
			checkmate: answer.checkmate === true,
			stalemate: answer.stalemate === true,
			insufficientMaterial: answer.insufficient_material === true,
			// Lichess lists the best first; the result is turned to the mover's side.
			moves: (answer.moves ?? []).map((move) => ({
				uci: move.uci,
				san: move.san,
				result: OTHER_SIDE[categoryOf(move.category)],
				dtz: typeof move.dtz === "number" ? -move.dtz : null,
				dtm: typeof move.dtm === "number" ? -move.dtm : null,
			})),
		}),
	);

/** GET /game/export/{id} as JSON with `pgnInJson`: what importing a game needs. */
export const gameExportAnswer = z
	.object({
		id: z.string(),
		variant: z.string(),
		status: z.string(),
		pgn: z.string(),
	})
	.transform((game) => ({
		id: game.id,
		standard: game.variant === "standard" || game.variant === "fromPosition",
		// Lichess's statuses for a game that hasn't ended yet.
		finished: game.status !== "created" && game.status !== "started",
		pgn: game.pgn,
	}));
