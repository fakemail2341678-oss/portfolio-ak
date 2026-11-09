import "@tanstack/react-start/server-only";
import { z } from "zod";
import type { Score } from "@/features/chaal/chess/eval";
import { play, START_FEN, turnOf } from "@/features/chaal/chess/rules";
import type {
	ChaalChallengeLine,
	ChaalEvent,
	ChaalEventChallenge,
	ChaalEventGame,
	ChaalEventPlayer,
	ChaalGameFull,
	ChaalGameLine,
	ChaalGamePlayer,
	ChaalGameState,
} from "@/features/chaal/live/events";
import {
	type ActivityDay,
	type ActivityGames,
	type ChaalCrosstable,
	type ChaalGameSummary,
	type ChaalLeaderboard,
	type ChaalPerfStats,
	type ChaalPlayer,
	type ChaalReplay,
	type FollowedPlayer,
	type GamePlayerSummary,
	JUDGEMENTS,
	type Judgement,
	type LeaderboardPerf,
	type MoveAnalysis,
	PLAYER_PERFS,
	type PlayerPerf,
	type PlayerRating,
	type PlayerSuggestion,
	type RatingMoment,
	type RatingOpponent,
	type RatingSeries,
	type ReplayPlayer,
} from "@/features/chaal/players/schema";
import type { ChaalPuzzle, LichessPuzzleDashboard, PuzzleGlicko } from "@/features/chaal/puzzles/schema";
import type {
	ChaalCloudEval,
	ChaalExplorer,
	ChaalExplorerGame,
	ChaalExplorerMove,
	ChaalTablebase,
	ExplorerDatabase,
	TablebaseResult,
} from "@/features/chaal/schema";
import {
	BOARD_RESULTS,
	type BoardResult,
	type BroadcastBoard,
	type BroadcastInfo,
	type BroadcastPlayer,
	type BroadcastRoundSummary,
	type BroadcastTourSummary,
	type ChaalBroadcastRound,
	type ChaalBroadcastSearch,
	type ChaalBroadcasts,
	type ChaalBroadcastTour,
	type ChaalStreamer,
} from "@/features/chaal/watch/schema";

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

/** GET /api/account/playing (Task 78): the games in progress, as the event stream shapes them; one that doesn't read is dropped. */
export const playingAnswer = z
	.object({ nowPlaying: z.array(eventGame.nullable().catch(null)) })
	.transform((answer) => ({
		games: answer.nowPlaying.filter((game): game is ChaalEventGame => game !== null),
	}));

/** GET /api/account with its ratings (Task 78): the player's rating by speed, for a seek's rating range. */
export const accountRatingsAnswer = z
	.object({
		perfs: z.record(z.string(), z.object({ rating: z.number().nullish() }).nullable().catch(null)).nullish(),
	})
	.transform((account) => {
		const ratings: Record<string, number> = {};
		for (const [speed, perf] of Object.entries(account.perfs ?? {})) {
			if (perf?.rating) ratings[speed] = perf.rating;
		}
		return ratings;
	});

/** POST /api/board/seek with days: the correspondence seek's id. */
export const seekAnswer = z.object({ id: z.string().min(1).max(32) }).transform((seek) => ({ id: seek.id }));

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

// --- Players and games (Task 81, decision 0271) ----------------------------------------------

const count = z
	.number()
	.nullish()
	.transform((value) => value ?? 0);

const gameUser = z
	.object({
		user: z.object({ id: z.string().nullish(), name: z.string().nullish(), title: z.string().nullish() }).nullish(),
		name: z.string().nullish(),
		rating: z.number().nullish(),
		ratingDiff: z.number().nullish(),
		aiLevel: z.number().nullish(),
		analysis: z
			.object({
				inaccuracy: z.number().nullish(),
				mistake: z.number().nullish(),
				blunder: z.number().nullish(),
				acpl: z.number().nullish(),
				accuracy: z.number().nullish(),
			})
			.nullish(),
	})
	.nullish();

/** A game as Lichess exports it (one ndjson line, or GET /game/export/{id} as JSON). */
const lichessGame = z.object({
	id: z.string().regex(/^[A-Za-z0-9]{8}$/),
	rated: z.boolean().nullish(),
	variant: z.string(),
	perf: z.string().nullish(),
	speed: z.string().nullish(),
	createdAt: z.number().nullish(),
	lastMoveAt: z.number().nullish(),
	status: z.string(),
	winner: color.nullish(),
	players: z.object({ white: gameUser, black: gameUser }).nullish(),
	opening: z.object({ eco: z.string().max(8), name: z.string().max(200) }).nullish(),
	moves: z.string().nullish(),
	initialFen: z.string().max(100).nullish(),
	clock: z.object({ initial: z.number(), increment: z.number() }).nullish(),
	daysPerTurn: z.number().nullish(),
	clocks: z.array(z.number()).max(4_000).nullish(),
	analysis: z
		.array(
			z.object({
				eval: z.number().nullish(),
				mate: z.number().nullish(),
				best: z.string().nullish(),
				judgment: z.object({ name: z.string() }).nullish(),
			}),
		)
		.max(4_000)
		.nullish(),
	lastFen: z.string().max(100).nullish(),
	lastMove: z.string().max(5).nullish(),
});

/** Lichess's statuses for a game that hasn't ended yet. */
const UNFINISHED = new Set(["created", "started"]);

function summaryPlayer(player: z.output<typeof gameUser>): GamePlayerSummary {
	const aiLevel = player?.aiLevel ?? null;
	return {
		id: player?.user?.id ?? null,
		name: player?.user?.name ?? player?.name ?? (aiLevel ? `Stockfish level ${aiLevel}` : "?"),
		title: player?.user?.title ?? null,
		rating: player?.rating ?? null,
		ratingDiff: player?.ratingDiff ?? null,
		aiLevel,
	};
}

function gameSummaryOf(game: z.output<typeof lichessGame>): ChaalGameSummary {
	return {
		id: game.id,
		rated: game.rated === true,
		perf: game.perf ?? game.speed ?? "",
		standard: game.variant === "standard" || game.variant === "fromPosition",
		ongoing: UNFINISHED.has(game.status),
		status: game.status,
		winner: game.winner ?? null,
		createdAt: game.createdAt ?? 0,
		lastMoveAt: game.lastMoveAt ?? game.createdAt ?? 0,
		white: summaryPlayer(game.players?.white),
		black: summaryPlayer(game.players?.black),
		opening: game.opening ? { eco: game.opening.eco, name: game.opening.name } : null,
		clock: game.clock ? { initial: game.clock.initial, increment: game.clock.increment } : null,
		daysPerTurn: game.daysPerTurn ?? null,
		plies: (game.moves ?? "").split(" ").filter(Boolean).length,
		lastFen: game.lastFen ?? null,
		lastMove: game.lastMove ?? null,
	};
}

/** One line of GET /api/games/user/{username} (ndjson): a game in a list. */
export const gameLineAnswer = lichessGame.transform(gameSummaryOf);

const perfEntry = z
	.object({
		games: z.number().nullish(),
		rating: z.number().nullish(),
		prog: z.number().nullish(),
		prov: z.boolean().nullish(),
	})
	.nullable()
	.catch(null);

/** Lichess's user (GET /api/user/{username}, a line of /api/rel/following): what a profile shows. */
const lichessUser = z.object({
	id: z.string(),
	username: z.string(),
	title: z.string().nullish(),
	disabled: z.boolean().nullish(),
	tosViolation: z.boolean().nullish(),
	closed: z.boolean().nullish(),
	online: z.boolean().nullish(),
	following: z.boolean().nullish(),
	createdAt: z.number().nullish(),
	seenAt: z.number().nullish(),
	playTime: z.object({ total: z.number().nullish() }).nullish(),
	profile: z
		.object({
			flag: z.string().max(16).nullish(),
			country: z.string().max(16).nullish(),
			location: z.string().nullish(),
			realName: z.string().nullish(),
			bio: z.string().nullish(),
			fideRating: z.number().nullish(),
			links: z.string().nullish(),
		})
		.nullish(),
	count: z.object({ all: count, rated: count, win: count, loss: count, draw: count }).nullish(),
	perfs: z.record(z.string(), perfEntry).nullish(),
});

/** Text a player wrote, kept short: the page shows it as text. */
const clip = (text: string | null | undefined, max: number) => {
	const trimmed = text?.trim();
	return trimmed ? trimmed.slice(0, max) : null;
};

/** A profile's links: one per line, web addresses only. */
function linksOf(text: string | null | undefined): string[] {
	return (text ?? "")
		.split(/\s+/)
		.map((link) => link.trim())
		.filter((link) => link.length > 3 && link.length < 200 && /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(link))
		.slice(0, 5);
}

function playerOf(user: z.output<typeof lichessUser>): ChaalPlayer {
	const closed = user.disabled === true || user.closed === true || user.tosViolation === true;
	const perfs = user.perfs ?? {};
	const ratings: PlayerRating[] = [];
	for (const perf of PLAYER_PERFS) {
		const entry = perfs[perf];
		if (!entry?.rating || !entry.games) continue;
		ratings.push({
			perf,
			rating: Math.round(entry.rating),
			games: entry.games,
			progress: entry.prog ?? 0,
			provisional: entry.prov === true,
		});
	}
	const puzzle = perfs.puzzle;
	return {
		id: user.id.toLowerCase(),
		username: user.username,
		title: user.title ?? null,
		closed,
		online: user.online === true,
		playingId: null,
		createdAt: user.createdAt ?? null,
		seenAt: user.seenAt ?? null,
		playSeconds: user.playTime?.total ?? null,
		profile: closed
			? { flag: null, location: null, realName: null, bio: null, fideRating: null, links: [] }
			: {
					flag: user.profile?.flag ?? user.profile?.country ?? null,
					location: clip(user.profile?.location, 80),
					realName: clip(user.profile?.realName, 80),
					bio: clip(user.profile?.bio, 400),
					fideRating: user.profile?.fideRating ?? null,
					links: linksOf(user.profile?.links),
				},
		count: user.count ?? { all: 0, rated: 0, win: 0, loss: 0, draw: 0 },
		ratings: closed ? [] : ratings,
		puzzle:
			!closed && puzzle?.rating && puzzle.games ? { rating: Math.round(puzzle.rating), games: puzzle.games } : null,
	};
}

/** GET /api/user/{username}; with a token, `following` says whether its owner follows them. */
export const userAnswer = lichessUser.transform((user) => ({
	player: playerOf(user),
	following: user.following ?? null,
}));

/** A line of GET /api/rel/following (ndjson). */
export const followedAnswer = lichessUser.transform(
	(user): FollowedPlayer => ({
		id: user.id.toLowerCase(),
		username: user.username,
		title: user.title ?? null,
		online: user.online === true,
	}),
);

/** GET /api/users/status?ids=…&withGameIds=true: online and playing. */
export const userStatusAnswer = z
	.array(
		z.object({
			id: z.string(),
			online: z.boolean().nullish(),
			playing: z.boolean().nullish(),
			playingId: z.string().nullish(),
		}),
	)
	.max(100)
	.transform((list) =>
		list.map((each) => ({
			id: each.id.toLowerCase(),
			online: each.online === true,
			playingId: each.playing && each.playingId && /^[A-Za-z0-9]{8}$/.test(each.playingId) ? each.playingId : null,
		})),
	);

/** GET /api/player/top/{nb}/{perf}. */
export const leaderboardAnswer = (perf: LeaderboardPerf) =>
	z
		.object({
			users: z
				.array(
					z.object({
						id: z.string(),
						username: z.string(),
						title: z.string().nullish(),
						online: z.boolean().nullish(),
						perfs: z.record(z.string(), z.object({ rating: z.number(), progress: z.number().nullish() })),
					}),
				)
				.max(200),
		})
		.transform(
			(answer): ChaalLeaderboard => ({
				perf,
				players: answer.users.flatMap((user) => {
					const entry = user.perfs[perf];
					return entry
						? [
								{
									id: user.id.toLowerCase(),
									username: user.username,
									title: user.title ?? null,
									online: user.online === true,
									rating: Math.round(entry.rating),
									progress: entry.progress ?? 0,
								},
							]
						: [];
				}),
			}),
		);

/** Lichess's names for the rating history's series. */
const HISTORY_NAMES: Readonly<Record<string, PlayerPerf>> = {
	ultrabullet: "ultraBullet",
	bullet: "bullet",
	blitz: "blitz",
	rapid: "rapid",
	classical: "classical",
	correspondence: "correspondence",
};

const pad = (value: number) => String(value).padStart(2, "0");

/** GET /api/user/{username}/rating-history: standard chess's series, days as `YYYY-MM-DD` (Lichess's months count from 0). */
export const ratingHistoryAnswer = z
	.array(
		z.object({
			name: z.string(),
			points: z.array(z.tuple([z.number(), z.number(), z.number(), z.number()])).max(20_000),
		}),
	)
	.transform((series): RatingSeries[] =>
		series.flatMap((each) => {
			const perf = HISTORY_NAMES[each.name.toLowerCase()];
			if (!perf || each.points.length === 0) return [];
			return [
				{
					perf,
					points: each.points.map(
						([year, month, date, rating]) => [`${year}-${pad(month + 1)}-${pad(date)}`, rating] as const,
					),
				},
			];
		}),
	);

const moment = z
	.object({ int: z.number(), at: z.string(), gameId: z.string().nullish() })
	.nullish()
	.catch(null)
	.transform((value): RatingMoment | null =>
		value ? { rating: value.int, at: value.at, gameId: value.gameId ?? null } : null,
	);

const opponents = z
	.object({
		results: z.array(
			z.object({
				opRating: z.number(),
				opId: z.object({ name: z.string(), id: z.string().nullish() }),
				at: z.string(),
				gameId: z.string().nullish(),
			}),
		),
	})
	.nullish()
	.catch(null)
	.transform((value): RatingOpponent[] =>
		(value?.results ?? []).slice(0, 5).map((result) => ({
			name: result.opId.name,
			rating: result.opRating,
			at: result.at,
			gameId: result.gameId ?? null,
		})),
	);

const streakValue = z
	.object({ v: z.number().nullish() })
	.nullish()
	.transform((value) => value?.v ?? 0);

/** GET /api/user/{username}/perf/{perf}: one rating's details. */
export const perfStatsAnswer = (perf: PlayerPerf) =>
	z
		.object({
			perf: z.object({
				glicko: z.object({ rating: z.number(), deviation: z.number(), provisional: z.boolean().nullish() }),
				nb: z.number().nullish(),
				progress: z.number().nullish(),
			}),
			rank: z.number().nullish(),
			percentile: z.number().nullish(),
			stat: z.object({
				highest: moment,
				lowest: moment,
				bestWins: opponents,
				worstLosses: opponents,
				count: z
					.object({
						all: count,
						rated: count,
						win: count,
						loss: count,
						draw: count,
						tour: count,
						berserk: count,
						opAvg: z.number().nullish(),
					})
					.nullish(),
				resultStreak: z
					.object({
						win: z.object({ cur: streakValue, max: streakValue }).nullish(),
						loss: z.object({ cur: streakValue, max: streakValue }).nullish(),
					})
					.nullish(),
			}),
		})
		.transform(
			(answer): ChaalPerfStats => ({
				perf,
				rating: Math.round(answer.perf.glicko.rating),
				deviation: Math.round(answer.perf.glicko.deviation),
				provisional: answer.perf.glicko.provisional === true,
				games: answer.perf.nb ?? 0,
				progress: answer.perf.progress ?? 0,
				rank: answer.rank ?? null,
				percentile: answer.percentile ?? null,
				highest: answer.stat.highest,
				lowest: answer.stat.lowest,
				count: {
					all: answer.stat.count?.all ?? 0,
					rated: answer.stat.count?.rated ?? 0,
					win: answer.stat.count?.win ?? 0,
					loss: answer.stat.count?.loss ?? 0,
					draw: answer.stat.count?.draw ?? 0,
					tournament: answer.stat.count?.tour ?? 0,
					berserk: answer.stat.count?.berserk ?? 0,
				},
				opponentAverage: answer.stat.count?.opAvg ? Math.round(answer.stat.count.opAvg) : null,
				streak: {
					win: answer.stat.resultStreak?.win?.cur ?? 0,
					winBest: answer.stat.resultStreak?.win?.max ?? 0,
					loss: answer.stat.resultStreak?.loss?.cur ?? 0,
					lossBest: answer.stat.resultStreak?.loss?.max ?? 0,
				},
				bestWins: answer.stat.bestWins,
				worstLosses: answer.stat.worstLosses,
			}),
		);

const score = z
	.object({
		win: count,
		loss: count,
		draw: count,
		rp: z.object({ before: z.number(), after: z.number() }).nullish(),
	})
	.nullable()
	.catch(null);

/** GET /api/user/{username}/activity: the latest days, standard chess's games only. */
export const activityAnswer = z
	.array(
		z.object({
			interval: z.object({ start: z.number(), end: z.number() }),
			games: z.record(z.string(), score).nullish(),
			puzzles: z.object({ score }).nullish(),
			tournaments: z.object({ nb: z.number().nullish() }).nullish(),
			follows: z
				.object({ in: z.object({ ids: z.array(z.string()).nullish(), nb: z.number().nullish() }).nullish() })
				.nullish(),
			correspondenceMoves: z.object({ nb: z.number().nullish() }).nullish(),
		}),
	)
	.max(100)
	.transform((days): ActivityDay[] =>
		days.map((day) => {
			const games: ActivityGames[] = [];
			for (const perf of PLAYER_PERFS) {
				const entry = day.games?.[perf];
				if (entry)
					games.push({
						perf,
						win: entry.win,
						loss: entry.loss,
						draw: entry.draw,
						before: entry.rp?.before ?? 0,
						after: entry.rp?.after ?? 0,
					});
			}
			const puzzles = day.puzzles?.score;
			return {
				start: day.interval.start,
				games,
				puzzles: puzzles
					? {
							win: puzzles.win,
							loss: puzzles.loss,
							before: puzzles.rp?.before ?? 0,
							after: puzzles.rp?.after ?? 0,
						}
					: null,
				tournaments: day.tournaments?.nb ?? 0,
				followers: day.follows?.in?.nb ?? day.follows?.in?.ids?.length ?? 0,
				correspondenceMoves: day.correspondenceMoves?.nb ?? 0,
			};
		}),
	);

/** GET /api/crosstable/{a}/{b}: the score between two players, from `you`'s side. */
export const crosstableAnswer = (you: string, them: string) =>
	z.object({ users: z.record(z.string(), z.number()), nbGames: z.number() }).transform(
		(answer): ChaalCrosstable => ({
			you: answer.users[you.toLowerCase()] ?? 0,
			them: answer.users[them.toLowerCase()] ?? 0,
			games: answer.nbGames,
		}),
	);

/** GET /api/player/autocomplete?object=true. */
export const autocompleteAnswer = z
	.object({
		result: z
			.array(
				z.object({
					id: z.string(),
					name: z.string(),
					title: z.string().nullish(),
					online: z.boolean().nullish(),
				}),
			)
			.max(50),
	})
	.transform((answer): PlayerSuggestion[] =>
		answer.result.map((user) => ({
			id: user.id.toLowerCase(),
			username: user.name,
			title: user.title ?? null,
			online: user.online === true,
		})),
	);

/**
 * GET /game/export/{id} as JSON with `pgnInJson`, clocks, evals and the opening: what
 * importing a game into analysis needs (Task 75) and what its replay shows (Task 81). Both
 * read it under one cache key, so both use this one shape (see "Pitfalls" in chaal.md).
 */
export const gameExportAnswer = z
	.object({ pgn: z.string() })
	.and(lichessGame)
	.transform((game): ChaalReplay & { finished: boolean } => {
		const summary = gameSummaryOf(game);
		const moves = summary.plies > 0 ? (game.moves ?? "").split(" ").filter(Boolean) : [];
		const analysis = game.analysis
			? moves.map((_, index): MoveAnalysis => {
					const entry = game.analysis?.[index];
					if (!entry) return { eval: null, judgement: null, best: null };
					const score: Score | null =
						typeof entry.mate === "number"
							? { mate: entry.mate }
							: typeof entry.eval === "number"
								? { cp: entry.eval }
								: null;
					const name = entry.judgment?.name.toLowerCase();
					return {
						eval: score,
						judgement: (JUDGEMENTS as ReadonlyArray<string>).includes(name ?? "") ? (name as Judgement) : null,
						best: entry.best && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(entry.best) ? entry.best : null,
					};
				})
			: null;
		const side = (color: "white" | "black"): ReplayPlayer => {
			const player = game.players?.[color];
			const own = player?.analysis;
			return {
				...summary[color],
				analysis: own
					? {
							inaccuracy: own.inaccuracy ?? 0,
							mistake: own.mistake ?? 0,
							blunder: own.blunder ?? 0,
							acpl: own.acpl ?? 0,
							accuracy: own.accuracy ?? null,
						}
					: null,
			};
		};
		return {
			id: summary.id,
			rated: summary.rated,
			perf: summary.perf,
			standard: summary.standard,
			ongoing: summary.ongoing,
			finished: !summary.ongoing,
			status: summary.status,
			winner: summary.winner,
			createdAt: summary.createdAt,
			lastMoveAt: summary.lastMoveAt,
			initialFen: game.initialFen ?? null,
			clock: summary.clock,
			daysPerTurn: summary.daysPerTurn,
			white: side("white"),
			black: side("black"),
			opening: summary.opening,
			moves,
			// Lichess counts clocks in centiseconds.
			clocks: game.clocks && game.clocks.length > 0 ? game.clocks.map((cs) => cs * 10) : null,
			analysis,
			pgn: game.pgn,
		};
	});

// --- Online play (Task 77, decision 0266) ----------------------------------------------------

/** A move as Lichess's Board API writes it. */
const uciMove = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

const gameStreamPlayer = z
	.object({
		id: z.string().nullish(),
		name: z.string().nullish(),
		title: z.string().nullish(),
		rating: z.number().nullish(),
		provisional: z.boolean().nullish(),
		aiLevel: z.number().nullish(),
		ratingDiff: z.number().nullish(),
	})
	.transform(
		(player): ChaalGamePlayer => ({
			id: player.id ?? null,
			name: player.name ?? "",
			title: player.title ?? null,
			rating: player.rating ?? null,
			provisional: player.provisional === true,
			aiLevel: player.aiLevel ?? null,
			ratingDiff: player.ratingDiff ?? null,
		}),
	);

const gameStateShape = z
	.object({
		moves: z.string(),
		wtime: z.number(),
		btime: z.number(),
		winc: z.number().nullish(),
		binc: z.number().nullish(),
		status: z.string(),
		winner: color.nullish(),
		wdraw: z.boolean().nullish(),
		bdraw: z.boolean().nullish(),
		wtakeback: z.boolean().nullish(),
		btakeback: z.boolean().nullish(),
		expiration: z.object({ idleMillis: z.number(), millisToMove: z.number() }).nullish(),
	})
	.refine((state) => state.moves.split(" ").every((move) => move === "" || uciMove.test(move)))
	.transform(
		(state): ChaalGameState => ({
			moves: state.moves.split(" ").filter(Boolean),
			wtime: state.wtime,
			btime: state.btime,
			winc: state.winc ?? 0,
			binc: state.binc ?? 0,
			status: state.status,
			winner: state.winner ?? null,
			wdraw: state.wdraw === true,
			bdraw: state.bdraw === true,
			wtakeback: state.wtakeback === true,
			btakeback: state.btakeback === true,
			expiration: state.expiration ?? null,
		}),
	);

const gameFullShape = z
	.object({
		id: z.string().regex(/^[A-Za-z0-9]{8}$/),
		variant: named.nullish(),
		clock: z.object({ initial: z.number(), increment: z.number() }).nullish(),
		speed: z.string().nullish(),
		rated: z.boolean().nullish(),
		createdAt: z.number().nullish(),
		white: gameStreamPlayer,
		black: gameStreamPlayer,
		initialFen: z.string().nullish(),
		state: gameStateShape,
		daysPerTurn: z.number().nullish(),
		tournamentId: z.string().nullish(),
	})
	.transform(
		(game): ChaalGameFull => ({
			id: game.id,
			rated: game.rated === true,
			speed: game.speed ?? "",
			variant: nameOf(game.variant, "key"),
			clock: game.clock ?? null,
			daysPerTurn: game.daysPerTurn ?? null,
			initialFen: !game.initialFen || game.initialFen === "startpos" ? null : game.initialFen,
			white: game.white,
			black: game.black,
			state: game.state,
			tournamentId: game.tournamentId ?? null,
			createdAt: game.createdAt ?? 0,
		}),
	);

const chatLine = z.object({
	room: z.enum(["player", "spectator"]),
	username: z.string(),
	text: z.string().max(2_000),
});
const opponentGone = z.object({ gone: z.boolean(), claimWinInSeconds: z.number().nullish() });

/**
 * One line of a Board API game's stream as Chaal's, or null when it isn't one Chaal knows
 * (a new type, or a shape that changed): those are dropped, never passed on.
 */
export function mapGameLine(value: unknown): ChaalGameLine | null {
	const type = value && typeof value === "object" ? (value as { type?: unknown }).type : undefined;
	if (type === "gameFull") {
		const game = gameFullShape.safeParse(value);
		return game.success ? { type: "gameFull", game: game.data } : null;
	}
	if (type === "gameState") {
		const state = gameStateShape.safeParse(value);
		return state.success ? { type: "gameState", state: state.data } : null;
	}
	if (type === "chatLine") {
		const line = chatLine.safeParse(value);
		return line.success ? { type: "chatLine", ...line.data } : null;
	}
	if (type === "opponentGone") {
		const gone = opponentGone.safeParse(value);
		return gone.success
			? { type: "opponentGone", gone: gone.data.gone, claimWinInSeconds: gone.data.claimWinInSeconds ?? null }
			: null;
	}
	return null;
}

/** A game's first line, read for the page's first paint (getChaalLiveGame). */
export const gameFullAnswer = gameFullShape;

/** Lichess answers a challenge either as the challenge or wrapped in `{ challenge }`. */
const challengeOrWrapped = z.preprocess(
	(value) =>
		value && typeof value === "object" && "challenge" in value && !("id" in value)
			? (value as { challenge: unknown }).challenge
			: value,
	eventChallenge,
);

/** POST /api/challenge/{username}: the challenge made (correspondence, or a kept-open stream's first line). */
export const challengeAnswer = challengeOrWrapped;

/** GET /api/challenge: incoming and outgoing; a challenge that doesn't read is dropped, not the list. */
export const challengeListAnswer = z
	.object({
		in: z.array(eventChallenge.nullable().catch(null)).nullish(),
		out: z.array(eventChallenge.nullable().catch(null)).nullish(),
	})
	.transform((answer) => ({
		incoming: (answer.in ?? []).filter((challenge): challenge is ChaalEventChallenge => challenge !== null),
		outgoing: (answer.out ?? []).filter((challenge): challenge is ChaalEventChallenge => challenge !== null),
	}));

/** A kept-open challenge's lines: the challenge, then how it ended. */
export function mapChallengeLine(value: unknown): ChaalChallengeLine | null {
	if (value && typeof value === "object" && "done" in value) {
		const done = (value as { done: unknown }).done;
		return done === "accepted" || done === "declined" || done === "canceled" ? { type: "done", done } : null;
	}
	const challenge = challengeOrWrapped.safeParse(value);
	return challenge.success ? { type: "challenge", challenge: challenge.data } : null;
}

/** POST /api/challenge/ai: the game started with the Lichess AI. */
export const aiGameAnswer = z
	.object({ id: z.string().regex(/^[A-Za-z0-9]{8}$/) })
	.transform((game) => ({ id: game.id }));

/** POST /api/challenge/open: the challenge and its links (only lichess.org addresses are kept). */
export const openChallengeAnswer = z
	.object({
		id: z.string().regex(/^[A-Za-z0-9]{8}$/),
		url: z.string(),
		urlWhite: z.string(),
		urlBlack: z.string(),
	})
	.transform((answer) => ({ id: answer.id, url: answer.url, urlWhite: answer.urlWhite, urlBlack: answer.urlBlack }));

/** GET /api/board/game/{id}/chat: the players' chat so far. */
export const chatHistoryAnswer = z
	.array(
		z
			.object({ user: z.string(), text: z.string().max(2_000) })
			.nullable()
			.catch(null),
	)
	.transform((lines) =>
		lines.flatMap((line) => (line ? [{ room: "player" as const, username: line.user, text: line.text }] : [])),
	);

// --- Puzzles (Task 80, decision 0269) --------------------------------------------------------

const puzzlePlayer = z.object({
	name: z.string().max(60),
	title: z.string().max(8).nullish(),
	rating: z.number().nullish(),
	color: z.enum(["white", "black"]),
});

const puzzleAndGame = z.object({
	game: z.object({
		id: z.string().max(12),
		perf: z.object({ key: z.string().max(20) }).nullish(),
		clock: z.string().max(20).nullish(),
		pgn: z.string().max(20_000),
		players: z.array(puzzlePlayer).length(2),
	}),
	puzzle: z.object({
		id: z.string().regex(/^[A-Za-z0-9]{4,10}$/),
		rating: z.number(),
		plays: z.number().nullish(),
		solution: z
			.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/))
			.min(1)
			.max(40),
		themes: z.array(z.string().max(40)).max(30),
	}),
});

/**
 * A puzzle as Chaal shows it. Lichess's game PGN ends where the puzzle starts, so replaying
 * it gives the position before the opponent's last move and that move (the batch's puzzles
 * carry no FEN); the solution must then play out from there. Null when it doesn't.
 */
function puzzleOf(answer: z.output<typeof puzzleAndGame>): ChaalPuzzle | null {
	const sans = answer.game.pgn
		.split(/\s+/)
		.filter((token) => token !== "" && !/^\d+\.+$/.test(token) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token));
	let fen = START_FEN;
	let before = fen;
	let last: { uci: string; san: string } | null = null;
	for (const san of sans) {
		const played = play(fen, san);
		if (!played) return null;
		before = fen;
		fen = played.fen;
		last = { uci: played.uci, san: played.san };
	}
	if (!last) return null;
	let position = fen;
	for (const uci of answer.puzzle.solution) {
		const played = play(position, uci);
		if (!played) return null;
		position = played.fen;
	}
	const player = (color: "white" | "black") => {
		const found = answer.game.players.find((entry) => entry.color === color);
		return { name: found?.name ?? "?", title: found?.title ?? null, rating: found?.rating ?? null };
	};
	return {
		id: answer.puzzle.id,
		rating: Math.round(answer.puzzle.rating),
		plays: answer.puzzle.plays ?? 0,
		themes: answer.puzzle.themes,
		before,
		lastMove: last,
		fen,
		color: turnOf(fen),
		solution: answer.puzzle.solution,
		game: {
			id: answer.game.id,
			perf: answer.game.perf?.key ?? "",
			clock: answer.game.clock ?? null,
			white: player("white"),
			black: player("black"),
		},
	};
}

/** GET /api/puzzle/daily and /api/puzzle/{id}. */
export const puzzleAnswer = puzzleAndGame.transform((answer, context) => {
	const puzzle = puzzleOf(answer);
	if (!puzzle) {
		context.addIssue({ code: "custom", message: "The puzzle doesn't replay" });
		return z.NEVER;
	}
	return puzzle;
});

/** Each puzzle of a batch on its own: one that doesn't replay is dropped, not the batch. */
const puzzleList = z
	.array(z.unknown())
	.max(50)
	.transform((list) =>
		list.flatMap((item) => {
			const read = puzzleAnswer.safeParse(item);
			return read.success ? [read.data] : [];
		}),
	);

const glicko = z
	.object({ rating: z.number(), provisional: z.boolean().nullish() })
	.nullish()
	.transform((value): PuzzleGlicko | null =>
		value ? { rating: Math.round(value.rating), provisional: value.provisional === true } : null,
	);

/** GET /api/puzzle/batch/{angle}. */
export const puzzleBatchAnswer = z.object({ puzzles: puzzleList, glicko });

/** POST /api/puzzle/batch/{angle}: each solution's rating change, and the next batch when `nb` asked for one. */
export const puzzleSolveAnswer = z.object({
	puzzles: puzzleList.nullish().transform((list) => list ?? []),
	glicko,
	rounds: z
		.array(z.object({ id: z.string(), win: z.boolean(), ratingDiff: z.number().nullish() }))
		.nullish()
		.transform((rounds) => (rounds ?? []).map((round) => ({ id: round.id, ratingDiff: round.ratingDiff ?? null }))),
});

const puzzlePerformance = z.object({ nb: z.number(), firstWins: z.number(), performance: z.number() });

/** GET /api/puzzle/dashboard/{days}: the totals, then each theme, the most played first. */
export const puzzleDashboardAnswer = z
	.object({
		days: z.number(),
		global: puzzlePerformance,
		themes: z.record(z.string(), z.object({ results: puzzlePerformance })).nullish(),
	})
	.transform(
		(answer): LichessPuzzleDashboard => ({
			days: answer.days,
			nb: answer.global.nb,
			firstWins: answer.global.firstWins,
			performance: answer.global.performance,
			themes: Object.entries(answer.themes ?? {})
				.map(([key, entry]) => ({
					key,
					nb: entry.results.nb,
					firstWins: entry.results.firstWins,
					performance: entry.results.performance,
				}))
				.sort((a, b) => b.nb - a.nb || a.key.localeCompare(b.key)),
		}),
	);

/** GET /api/puzzle/replay/{days}/{theme}: the misses still to replay. */
export const puzzleReplayAnswer = z
	.object({
		replay: z.object({
			theme: z.string(),
			remaining: z.array(z.string().regex(/^[A-Za-z0-9]{4,10}$/)).max(1_000),
		}),
	})
	.transform((answer) => ({ theme: answer.replay.theme, remaining: answer.replay.remaining }));

// --- Watch (Task 82, decision 0272) -----------------------------------------------------------

/** A web address Lichess passed on from someone (a website, a stream): http or https only, else null. */
function webAddress(value: string | null | undefined): string | null {
	if (!value || value.length > 300) return null;
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
	} catch {
		return null;
	}
}

/** Someone else's words, clipped: shown as text, never HTML. */
const clipped = (max: number) =>
	z
		.string()
		.nullish()
		.transform((text) => {
			const trimmed = text?.trim() ?? "";
			return trimmed ? trimmed.slice(0, max) : null;
		});

/** GET /api/tv/channels: each channel's game and the side it follows, by channel. */
export const tvChannelsAnswer = z.record(
	z.string(),
	z.object({ gameId: z.string().regex(/^[A-Za-z0-9]{8}$/), color: color.nullish() }).nullish(),
);

/** GET /api/streamer/live: the streamers live now, with a link to the stream they're on. */
export const streamersAnswer = z
	.array(
		z.object({
			id: z.string().max(30),
			name: z.string().max(30),
			title: z.string().max(4).nullish(),
			stream: z.object({ service: z.string(), status: clipped(200), lang: z.string().max(10).nullish() }),
			streamer: z
				.object({
					name: clipped(60),
					headline: clipped(200),
					twitch: z.string().nullish(),
					youtube: z.string().nullish(),
				})
				.nullish(),
		}),
	)
	.max(200)
	.transform((list) =>
		list.flatMap((entry): ChaalStreamer[] => {
			const service =
				entry.stream.service === "youtube" ? "youtube" : entry.stream.service === "twitch" ? "twitch" : null;
			const url = service ? webAddress(entry.streamer?.[service]) : null;
			if (!service || !url) return [];
			return [
				{
					id: entry.id,
					username: entry.name,
					title: entry.title ?? null,
					name: entry.streamer?.name ?? entry.name,
					status: entry.stream.status ?? "",
					lang: entry.stream.lang ?? null,
					service,
					url,
				},
			];
		}),
	);

const broadcastInfo = z
	.object({
		format: clipped(120),
		tc: clipped(80),
		location: clipped(120),
		players: clipped(200),
		website: z.string().nullish(),
		standings: z.string().nullish(),
	})
	.nullish()
	.transform(
		(info): BroadcastInfo => ({
			format: info?.format ?? null,
			timeControl: info?.tc ?? null,
			location: info?.location ?? null,
			players: info?.players ?? null,
			website: webAddress(info?.website),
			standings: webAddress(info?.standings),
		}),
	);

const broadcastTour = z.object({
	id: z.string().regex(/^[A-Za-z0-9]{8}$/),
	name: z.string().max(200),
	tier: z.number().int().nullish(),
	dates: z.array(z.number()).max(2).nullish(),
	info: broadcastInfo,
	url: z.string().nullish(),
});

const broadcastRound = z
	.object({
		id: z.string().regex(/^[A-Za-z0-9]{8}$/),
		name: z.string().max(100),
		startsAt: z.number().nullish(),
		finishedAt: z.number().nullish(),
		finished: z.boolean().nullish(),
		ongoing: z.boolean().nullish(),
		url: z.string().nullish(),
	})
	.transform((round): BroadcastRoundSummary & { url: string } => ({
		id: round.id,
		name: round.name,
		state: round.finished ? "finished" : round.ongoing ? "ongoing" : "upcoming",
		startsAt: round.startsAt ?? null,
		finishedAt: round.finishedAt ?? null,
		url: webAddress(round.url) ?? "https://lichess.org/broadcast",
	}));

const roundSummary = ({ url: _url, ...round }: z.output<typeof broadcastRound>): BroadcastRoundSummary => round;

function tourSummary(
	tour: z.output<typeof broadcastTour>,
	round: z.output<typeof broadcastRound> | null,
): BroadcastTourSummary {
	return {
		id: tour.id,
		name: tour.name,
		tier: tour.tier ?? null,
		dates: tour.dates ?? [],
		info: tour.info,
		round: round ? roundSummary(round) : null,
	};
}

/** A broadcast in Lichess's lists (top, search): the tournament and a round to open. */
const broadcastPreview = z
	.object({ tour: broadcastTour, round: broadcastRound.nullish(), roundToLink: broadcastRound.nullish() })
	.transform((entry) => tourSummary(entry.tour, entry.roundToLink ?? entry.round ?? null));

const previewList = z.array(broadcastPreview).max(200);

const paged = z.object({
	currentPage: z.number().int(),
	currentPageResults: previewList,
	nextPage: z.number().int().nullish(),
});

/** GET /api/broadcast/top: what's live, what's coming, and a page of the past. */
export const broadcastTopAnswer = z
	.object({ active: previewList.nullish(), upcoming: previewList.nullish(), past: paged })
	.transform(
		(answer): ChaalBroadcasts => ({
			active: answer.active ?? [],
			upcoming: answer.upcoming ?? [],
			past: answer.past.currentPageResults,
			page: answer.past.currentPage,
			next: answer.past.nextPage ?? null,
		}),
	);

/** GET /api/broadcast/search: a page of broadcasts whose names match. */
export const broadcastSearchAnswer = paged.transform(
	(answer): ChaalBroadcastSearch => ({
		results: answer.currentPageResults,
		page: answer.currentPage,
		next: answer.nextPage ?? null,
	}),
);

/** The round to open in a tournament with all its rounds: Lichess's choice, else the one being played, else the latest finished. */
function roundToOpen(rounds: ReadonlyArray<z.output<typeof broadcastRound>>, preferred: string | null | undefined) {
	return (
		rounds.find((round) => round.id === preferred) ??
		rounds.find((round) => round.state === "ongoing") ??
		[...rounds].reverse().find((round) => round.state === "finished") ??
		rounds[0] ??
		null
	);
}

const tourWithRounds = z.object({
	tour: broadcastTour,
	rounds: z.array(broadcastRound).max(300),
	defaultRoundId: z.string().nullish(),
	group: z.union([z.string(), z.object({ name: z.string() })]).nullish(),
});

/** One line of GET /api/broadcast (ndjson): an official broadcast with its rounds. */
export const officialBroadcastAnswer = tourWithRounds.transform((entry) =>
	tourSummary(entry.tour, roundToOpen(entry.rounds, entry.defaultRoundId)),
);

/** GET /api/broadcast/{id}: a tournament and its rounds. */
export const broadcastTourAnswer = tourWithRounds.transform(
	(entry): ChaalBroadcastTour => ({
		id: entry.tour.id,
		name: entry.tour.name,
		tier: entry.tour.tier ?? null,
		dates: entry.tour.dates ?? [],
		info: entry.tour.info,
		group: typeof entry.group === "string" ? entry.group.slice(0, 200) : (entry.group?.name.slice(0, 200) ?? null),
		rounds: entry.rounds.map(roundSummary),
		defaultRound: roundToOpen(entry.rounds, entry.defaultRoundId)?.id ?? null,
		url: webAddress(entry.tour.url) ?? "https://lichess.org/broadcast",
	}),
);

const NO_PLAYER: BroadcastPlayer = { name: "?", title: null, rating: null, fed: null, clock: null };

const broadcastPlayer = z
	.object({
		name: z.string().max(100).nullish(),
		title: z.string().max(4).nullish(),
		rating: z.number().int().nullish(),
		fed: z
			.string()
			.regex(/^[A-Z]{3}$/)
			.nullish()
			.catch(null),
		clock: z.number().nullish(),
	})
	.nullish()
	.transform(
		(player): BroadcastPlayer => ({
			name: player?.name?.trim() || NO_PLAYER.name,
			title: player?.title ?? null,
			rating: player?.rating ?? null,
			fed: player?.fed ?? null,
			// Lichess counts a board's clock in centiseconds.
			clock: typeof player?.clock === "number" ? player.clock * 10 : null,
		}),
	);

const broadcastBoard = z
	.object({
		id: z.string().regex(/^[A-Za-z0-9]{8}$/),
		fen: z.string().max(100).nullish(),
		lastMove: z.string().max(5).nullish(),
		status: z.string().nullish(),
		players: z.array(broadcastPlayer).max(2).nullish(),
	})
	.transform(
		(board): BroadcastBoard => ({
			id: board.id,
			fen: board.fen ?? START_FEN,
			lastMove: board.lastMove && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(board.lastMove) ? board.lastMove : null,
			result: (BOARD_RESULTS as ReadonlyArray<string>).includes(board.status ?? "")
				? (board.status as BoardResult)
				: "*",
			white: board.players?.[0] ?? NO_PLAYER,
			black: board.players?.[1] ?? NO_PLAYER,
		}),
	);

/** GET /api/broadcast/-/-/{roundId}: a round, its tournament and its boards. */
export const broadcastRoundAnswer = z
	.object({
		round: broadcastRound,
		tour: z.object({ id: z.string(), name: z.string().max(200) }),
		games: z.array(broadcastBoard).max(1_000).nullish(),
	})
	.transform(
		(answer): ChaalBroadcastRound => ({
			tour: { id: answer.tour.id, name: answer.tour.name },
			round: answer.round,
			boards: answer.games ?? [],
		}),
	);
