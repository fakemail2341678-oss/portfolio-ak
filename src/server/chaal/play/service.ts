import "@tanstack/react-start/server-only";
import { featureOn } from "@/features/chaal/features";
import type { ChaalColor, ChaalEventChallenge } from "@/features/chaal/live/events";
import { ndjsonLines, parseLine } from "@/features/chaal/live/ndjson";
import { ratingRangeOf, readPlayLimits } from "@/features/chaal/play/controls";
import type {
	ChaalChallenges,
	ChaalLiveGame,
	ChaalOpenChallenge,
	ChaalPlaying,
	ChaalSeek,
	ChallengeAiInput,
	ChallengeColor,
	ChallengePlayerInput,
	DeclineReason,
	GameAction,
	OpenChallengeInput,
	SeekInput,
} from "@/features/chaal/play/schema";
import { AppError } from "@/lib/errors";
import { recordActivity } from "../activity";
import { type ConnectDeps, requireFeature, withToken } from "../connect/service";
import { playLane, userLane } from "../lichess/lanes";
import {
	accountRatingsAnswer,
	aiGameAnswer,
	challengeAnswer,
	challengeListAnswer,
	chatHistoryAnswer,
	gameFullAnswer,
	openChallengeAnswer,
	playingAnswer,
	seekAnswer,
} from "../lichess/schemas";

/**
 * Online play through the Board API (PLAN 13.5, "Live play"; decision 0266): challenges, the
 * Lichess AI and a game's actions, each with the caller's token for `play` (the switch, the
 * scopes and a working connection: `withToken`). Moves and a game's actions run on the
 * connection's play lane, so they never wait behind a read. Lichess judges every move; Chaal
 * checks only the shapes. A challenge kept open for a clock goes through the stream route
 * (src/server/chaal/stream.ts), not here.
 */

/** What a challenge or an AI game asks Lichess for, as its form. */
export function paceForm(pace: ChallengePlayerInput["pace"]): Record<string, string> {
	return pace.kind === "clock"
		? { "clock.limit": String(pace.clock.initial), "clock.increment": String(pace.clock.increment) }
		: { days: String(pace.days) };
}

/** Refuses what the admin's limits don't allow: a rated game when rated play is off. */
async function requireRated(deps: ConnectDeps, rated: boolean): Promise<void> {
	if (!rated) return;
	const limits = readPlayLimits((await deps.controls.settings()).play);
	if (!limits.rated) throw new AppError("FORBIDDEN", "Rated games are off");
}

/** The form of a challenge to a player (POST /api/challenge/{username}), with `extra` for the stream's keepAlive. */
export function challengeForm(input: ChallengePlayerInput, extra: Record<string, string> = {}): Record<string, string> {
	return {
		...paceForm(input.pace),
		rated: String(input.rated),
		color: input.color,
		variant: "standard",
		...extra,
	};
}

export async function checkChallenge(deps: ConnectDeps, input: ChallengePlayerInput): Promise<void> {
	await requireRated(deps, input.rated);
}

/** GET /api/challenge: the caller's challenges, incoming and outgoing. */
export function listChallenges(deps: ConnectDeps, userId: string): Promise<ChaalChallenges> {
	return withToken(deps, userId, "play", (token) =>
		deps.lichess.json(
			{ endpoint: "challenge-list", path: "/api/challenge", token, lane: userLane(userId) },
			challengeListAnswer,
		),
	);
}

/** A correspondence challenge to a player (a clock's goes through the stream, which keeps it open). */
export async function challengePlayer(
	deps: ConnectDeps,
	userId: string,
	input: ChallengePlayerInput,
): Promise<ChaalEventChallenge> {
	if (input.pace.kind !== "days") throw new AppError("BAD_REQUEST", "A clock challenge is kept open by its stream");
	await checkChallenge(deps, input);
	return withToken(deps, userId, "play", (token) =>
		deps.lichess.json(
			{
				endpoint: "challenge-create",
				method: "POST",
				path: `/api/challenge/${encodeURIComponent(input.username)}`,
				form: challengeForm(input),
				token,
				lane: userLane(userId),
			},
			challengeAnswer,
		),
	);
}

/** A game against the Lichess AI (POST /api/challenge/ai), up to the admin's highest level; its id, to open it. */
export async function challengeAi(deps: ConnectDeps, userId: string, input: ChallengeAiInput): Promise<{ id: string }> {
	const limits = readPlayLimits((await deps.controls.settings()).play);
	if (input.level > limits.aiMaxLevel) throw new AppError("BAD_REQUEST", "That level is above the admin's limit");
	const game = await withToken(deps, userId, "play", (token) =>
		deps.lichess.json(
			{
				endpoint: "challenge-ai",
				method: "POST",
				path: "/api/challenge/ai",
				form: { level: String(input.level), ...paceForm(input.pace), color: input.color, variant: "standard" },
				token,
				lane: userLane(userId),
			},
			aiGameAnswer,
		),
	);
	await recordActivity(deps.db, { userId, kind: "game", mode: "ai", ref: game.id });
	return game;
}

const pick = (color: ChallengeColor, random: () => number): ChaalColor =>
	color === "random" ? (random() < 0.5 ? "white" : "black") : color;

/**
 * An open challenge (POST /api/challenge/open) the caller joins at once as their side, so the
 * link is for the friend: whoever opens it on Lichess plays the other side. Lichess keeps it
 * a day; the caller can cancel it.
 */
export async function openChallenge(
	deps: ConnectDeps,
	userId: string,
	input: OpenChallengeInput,
	random: () => number = Math.random,
): Promise<ChaalOpenChallenge> {
	await requireRated(deps, input.rated);
	const color = pick(input.color, random);
	return withToken(deps, userId, "play", async (token) => {
		const challenge = await deps.lichess.json(
			{
				endpoint: "challenge-open",
				method: "POST",
				path: "/api/challenge/open",
				form: { ...paceForm(input.pace), rated: String(input.rated), variant: "standard" },
				token,
				lane: userLane(userId),
			},
			openChallengeAnswer,
		);
		await deps.lichess.send({
			endpoint: "challenge-accept",
			method: "POST",
			path: `/api/challenge/${challenge.id}/accept`,
			params: { color },
			token,
			lane: userLane(userId),
		});
		const link = color === "white" ? challenge.urlBlack : challenge.urlWhite;
		return { id: challenge.id, link: lichessLink(link, challenge.id, deps.lichess.config.apiBase), color };
	});
}

/** A link from Lichess, kept only when it's Lichess's own page for this challenge (else that page's plain address). */
function lichessLink(value: string, id: string, apiBase: string): string {
	const page = `${apiBase.replace(/\/$/, "")}/${id}`;
	return value.startsWith(page) && !/[\s"'<>]/.test(value) ? value : page;
}

const challengeCall = (
	deps: ConnectDeps,
	userId: string,
	id: string,
	verb: "accept" | "cancel" | "decline",
	form?: Record<string, string>,
) =>
	withToken(deps, userId, "play", (token) =>
		deps.lichess.send({
			endpoint: `challenge-${verb}`,
			method: "POST",
			path: `/api/challenge/${id}/${verb}`,
			...(form ? { form } : {}),
			token,
			lane: userLane(userId),
		}),
	);

/** Accepts a challenge to the caller; the game's id is the challenge's. */
export async function acceptChallenge(deps: ConnectDeps, userId: string, id: string): Promise<{ id: string }> {
	await challengeCall(deps, userId, id, "accept");
	await recordActivity(deps.db, { userId, kind: "game", mode: "challenge", ref: id });
	return { id };
}

export function declineChallenge(deps: ConnectDeps, userId: string, id: string, reason: DeclineReason): Promise<void> {
	return challengeCall(deps, userId, id, "decline", { reason });
}

export function cancelChallenge(deps: ConnectDeps, userId: string, id: string): Promise<void> {
	return challengeCall(deps, userId, id, "cancel");
}

/**
 * A game the caller plays, for its page's first paint: the first line of its Board API
 * stream (`gameFull`), then the stream is closed. A game the caller isn't in is NOT_FOUND.
 */
export function liveGame(deps: ConnectDeps, userId: string, gameId: string): Promise<ChaalLiveGame> {
	return withToken(deps, userId, "play", async (token, connection) => {
		const abort = new AbortController();
		const body = await deps.lichess.stream({
			endpoint: "stream:game-first",
			path: `/api/board/game/stream/${gameId}`,
			token,
			lane: userLane(userId),
			signal: abort.signal,
		});
		let first: unknown;
		try {
			for await (const line of ndjsonLines(body)) {
				if (line === "") continue;
				first = parseLine(line);
				break;
			}
		} finally {
			abort.abort();
		}
		const parsed = gameFullAnswer.safeParse(first && typeof first === "object" ? first : {});
		if (!parsed.success) throw new AppError("UPSTREAM_UNAVAILABLE", "Lichess game stream: unexpected first line");
		const game = parsed.data;
		const color: ChaalColor | null =
			game.white.id === connection.lichessId ? "white" : game.black.id === connection.lichessId ? "black" : null;
		if (!color) throw new AppError("NOT_FOUND", "Not a game of this player");
		return { game, color };
	});
}

/** POST /api/board/game/{id}/move/{uci}: Lichess judges it; a refusal comes back as BAD_REQUEST. */
export function playMove(
	deps: ConnectDeps,
	userId: string,
	gameId: string,
	uci: string,
	offeringDraw = false,
): Promise<void> {
	return withToken(deps, userId, "play", (token) =>
		deps.lichess.send({
			endpoint: "board-move",
			method: "POST",
			path: `/api/board/game/${gameId}/move/${uci}`,
			...(offeringDraw ? { params: { offeringDraw: true } } : {}),
			token,
			lane: playLane(userId),
		}),
	);
}

/** Each action's Board API path after `/api/board/game/{id}/`. */
const ACTION_PATHS: Readonly<Record<GameAction, string>> = {
	resign: "resign",
	abort: "abort",
	"draw-offer": "draw/yes",
	"draw-decline": "draw/no",
	"takeback-offer": "takeback/yes",
	"takeback-decline": "takeback/no",
	"claim-victory": "claim-victory",
	"claim-draw": "claim-draw",
	berserk: "berserk",
};

/**
 * Resigning, aborting, offering or answering a draw or a takeback, the claims when the
 * opponent has gone, and berserk (an arena game before the player's first move: Lichess
 * refuses it anywhere else, BAD_REQUEST).
 */
export function gameAction(deps: ConnectDeps, userId: string, gameId: string, action: GameAction): Promise<void> {
	return withToken(deps, userId, "play", (token) =>
		deps.lichess.send({
			endpoint: `board-${action}`,
			method: "POST",
			path: `/api/board/game/${gameId}/${ACTION_PATHS[action]}`,
			token,
			lane: playLane(userId),
		}),
	);
}

/** Writes in the players' chat; refused while the admin has chat off. */
export async function sendChat(deps: ConnectDeps, userId: string, gameId: string, text: string): Promise<void> {
	requireFeature(await deps.controls.settings(), "chat");
	await withToken(deps, userId, "play", (token) =>
		deps.lichess.send({
			endpoint: "board-chat",
			method: "POST",
			path: `/api/board/game/${gameId}/chat`,
			form: { room: "player", text },
			token,
			lane: userLane(userId),
		}),
	);
}

/** The players' chat so far; nothing while the admin has chat off. */
export async function chatHistory(deps: ConnectDeps, userId: string, gameId: string) {
	if (!featureOn((await deps.controls.settings()).features, "chat")) return [];
	return withToken(deps, userId, "play", (token) =>
		deps.lichess.json(
			{ endpoint: "board-chat-read", path: `/api/board/game/${gameId}/chat`, token, lane: userLane(userId) },
			chatHistoryAnswer,
		),
	);
}

// --- Quick pairing and the games in progress (Task 78, decision 0267) ----------------------

/** The speed a seek's pace plays at, as Lichess names its ratings. */
export function seekSpeed(pace: SeekInput["pace"]): "rapid" | "classical" | "correspondence" {
	if (pace.kind === "days") return "correspondence";
	return pace.clock.initial + 40 * pace.clock.increment < 1_500 ? "rapid" : "classical";
}

/**
 * The form of a seek (POST /api/board/seek): a clock in minutes and seconds, or days, and no
 * colour (Lichess balances it). A rating range is read around the player's own rating at the
 * seek's speed (their account); without one there yet, anyone may join.
 */
export async function seekForm(
	deps: ConnectDeps,
	userId: string,
	token: string,
	input: SeekInput,
): Promise<Record<string, string>> {
	await requireRated(deps, input.rated);
	let range: string | null = null;
	if (input.range !== "any") {
		const ratings = await deps.lichess.json(
			{ endpoint: "account-ratings", path: "/api/account", token, lane: userLane(userId) },
			accountRatingsAnswer,
		);
		range = ratingRangeOf(input.range, ratings[seekSpeed(input.pace)] ?? null);
	}
	const pace: Record<string, string> =
		input.pace.kind === "clock"
			? { time: String(input.pace.clock.initial / 60), increment: String(input.pace.clock.increment) }
			: { days: String(input.pace.days) };
	return { ...pace, rated: String(input.rated), variant: "standard", ...(range ? { ratingRange: range } : {}) };
}

/**
 * A correspondence seek: Lichess answers at once with its id, and it waits in the lobby
 * until someone joins (the game arrives on the event stream; Lichess has no call to take
 * it back). A clock's seek is kept open by the stream route (src/server/chaal/stream.ts).
 */
export async function seekCorrespondence(deps: ConnectDeps, userId: string, input: SeekInput): Promise<ChaalSeek> {
	if (input.pace.kind !== "days") throw new AppError("BAD_REQUEST", "A clock seek is kept open by its stream");
	return withToken(deps, userId, "play", async (token) => {
		const form = await seekForm(deps, userId, token, input);
		return deps.lichess.json(
			{ endpoint: "board-seek", method: "POST", path: "/api/board/seek", form, token, lane: userLane(userId) },
			seekAnswer,
		);
	});
}

/**
 * GET /api/account/playing: the player's games in progress, real-time and correspondence,
 * the most urgent first, with whose turn it is and the time left. The event stream says
 * when a game starts or ends, never when a move is made, so the tab leader reads this for
 * correspondence turns (decision 0267).
 */
export function playingGames(deps: ConnectDeps, userId: string): Promise<ChaalPlaying> {
	return withToken(deps, userId, "play", (token) =>
		deps.lichess.json(
			{ endpoint: "account-playing", path: "/api/account/playing", params: { nb: 50 }, token, lane: userLane(userId) },
			playingAnswer,
		),
	);
}
